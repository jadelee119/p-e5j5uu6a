// v1.0 人生手牌雛形（國中三年）引擎。規格：design/v1.0-deck-prototype.md；數值：data/deck/*.json
import { Game } from './engine';
import { makeRng, type Rng } from './rng';
import { STATS, type GameData, type StatId } from './types';

export type CardType = 'action' | 'burden' | 'growth' | 'forced';
export interface CardDef {
  id: string; name: string; type: CardType; cost: number | null; age_min: number; age_max: number; expires_age: number | null;
  line: string; effects: Partial<Record<StatId, number>>; tags?: string[]; adds?: string[]; removes?: string[]; clears?: string[];
  requires_wealth?: number; result_event?: string; result_text?: string; echo?: { age: number; text: string };
  in_hand?: { academic_play_stress?: number; stress_at_least?: number; burden_cost_minus?: number }; unplayed_end?: Partial<Record<StatId, number>>;
  growth_per_play?: number; slot_cost?: number; once_in_deck?: boolean;
  /** 打牌花的錢算投資，不扣變化分數（§5.2-1） */ invest?: boolean;
  /** 第 2 次以後改用這組效果（§5.2-4 遞減） */ repeat_effects?: Partial<Record<StatId, number>>;
}
export interface DeckConfig {
  ages: number[]; hand_size: number; time_slots: number; academic_tags: string[];
  start_deck: { common: string[]; by_quintile: Record<string, string[]> };
  forced: { f_teacher: { base_chance: number; tag_chance: number; county_tags_any: string[] }; f_sick: { stress_at_least: number } };
  talent: { points: number; per_point_weight: number; options: Record<string, { name: string; cards: string[] }> };
  score: { weights: Partial<Record<StatId, number>>; tag_bonus: number; level_size: number; tag_min_count?: number };
  tag_names: Record<string, string>;
  rest_stress_per_slot?: number;
  passive: { _note?: string; max_plays_per_year: number; endings: { quintiles: number[]; text: string }[] };
}
export interface Inst { uid: number; id: string }
export interface Missed { id: string; name: string; age: number; echo?: { age: number; text: string } }
export interface PlayResult { card: CardDef; text: string; eventId?: string; deltas: Partial<Record<StatId, number>>; sick?: { text: string; eventId?: string } }
export interface CardVariant { name?: string | null; line?: string | null; icons?: string[] }
export interface EraCardVariants { by_birth_year: { from: number; to: number; label?: string; cards: Record<string, CardVariant> }[] }
export type DeckPhase = 'talent' | 'play' | 'yearEnd' | 'review';

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

export class DeckGame {
  rng: Rng; base: Game; cards: Map<string, CardDef>;
  stats: Record<StatId, number>; start: Record<StatId, number>;
  talent: Record<string, number> = {};
  draw: Inst[] = []; discard: Inst[] = []; hand: Inst[] = []; removed: Inst[] = [];
  ageIdx = 0; slotsLeft = 0; sickThisYear = false; sickCount = 0; phase: DeckPhase = 'talent';
  playedThisYear: Inst[] = []; playCount: Record<string, number> = {}; tags: Record<string, number> = {};
  missed: Missed[] = []; flags = new Set<string>(); everPlayed = new Set<string>();
  yearNotes: string[] = []; log: { age: number; played: string[] }[] = [];
  private uid = 0; investSpent = 0;

  constructor(public data: GameData, public cfg: DeckConfig, cardList: CardDef[], seed = Math.floor(Math.random() * 2 ** 31), public eraVariants?: EraCardVariants) {
    this.base = new Game(data, seed); // 沿用原本開局：縣市、出生年、家境五分位、初始屬性
    this.rng = makeRng(seed ^ 0x5bd1e995);
    this.cards = new Map(cardList.map((c) => [c.id, c]));
    this.stats = { ...this.base.s.stats }; this.start = { ...this.stats };
    const q = String(this.base.s.quintile);
    for (const id of [...cfg.start_deck.common, ...(cfg.start_deck.by_quintile[q] ?? [])]) this.draw.push(this.mk(id));
    const ft = cfg.forced.f_teacher; const tagged = this.base.s.county.event_tags.some((t) => ft.county_tags_any.includes(t));
    if (this.rng.next() < (tagged ? ft.tag_chance : ft.base_chance)) this.draw.push(this.mk('f_teacher'));
    for (const k of Object.keys(cfg.talent.options)) this.talent[k] = 0;
  }
  /** 依出生年換牌面（era_terms.json deck_card_variants）；回傳顯示用名稱、一句話、圖示候選 id */
  view(id: string): { name: string; line: string; icons: string[] } {
    const c = this.cards.get(id)!; const by = this.base.s.birthYear;
    const v = this.eraVariants?.by_birth_year.find((x) => by >= x.from && by <= x.to)?.cards[id];
    return { name: v?.name ?? c.name, line: v?.line ?? c.line, icons: v?.icons?.length ? v.icons : [id] };
  }
  get quintile() { return this.base.s.quintile; }
  get age() { return this.cfg.ages[this.ageIdx]; }
  card(i: Inst) { return this.cards.get(i.id)!; }
  private mk(id: string): Inst { if (!this.cards.has(id)) throw new Error(`未知牌 ${id}`); return { uid: ++this.uid, id }; }

  // ----- 天賦（原本的點數分配，開局一次） -----
  talentLeft() { return this.cfg.talent.points - Object.values(this.talent).reduce((a, b) => a + b, 0); }
  setTalent(alloc: Record<string, number>) { this.talent = { ...this.talent, ...alloc }; this.phase = 'play'; this.beginYear(); }
  private drawWeight(id: string) {
    let w = 1;
    for (const [k, o] of Object.entries(this.cfg.talent.options)) if (o.cards.includes(id)) w += (this.talent[k] ?? 0) * this.cfg.talent.per_point_weight;
    return w;
  }
  private eligible(i: Inst) { const c = this.card(i); return this.age >= c.age_min && this.age <= c.age_max; }

  // ----- 每年 -----
  private beginYear() {
    this.slotsLeft = this.cfg.time_slots; this.sickThisYear = false; this.playedThisYear = []; this.yearNotes = [];
    while (this.hand.length < this.cfg.hand_size) {
      let pool = this.draw.filter((i) => this.eligible(i));
      if (!pool.length && this.discard.length) { this.draw.push(...this.discard); this.discard = []; pool = this.draw.filter((i) => this.eligible(i)); }
      if (!pool.length) break;
      const pick = this.rng.weighted(pool, (i) => this.drawWeight(i.id))!;
      this.draw.splice(this.draw.indexOf(pick), 1); this.hand.push(pick);
    }
    // 強制事件：翻開就生效，佔一格手牌；病倒另外吃掉時間格
    for (const i of this.hand) { const c = this.card(i); if (c.type !== 'forced') continue;
      this.apply(c.effects); this.slotsLeft = Math.max(0, this.slotsLeft - (c.slot_cost ?? 0));
      this.yearNotes.push(`${c.name}：${c.line}`); }
  }
  costOf(i: Inst): number | null {
    const c = this.card(i); if (c.cost === null) return null;
    let cost = c.cost;
    if (c.type === 'burden' && this.hand.some((h) => this.card(h).in_hand?.burden_cost_minus)) cost -= Math.max(...this.hand.map((h) => this.card(h).in_hand?.burden_cost_minus ?? 0));
    return Math.max(0, cost);
  }
  lockReason(i: Inst): string | null {
    const c = this.card(i); const cost = this.costOf(i);
    if (c.type === 'forced') return '躲不掉的事。';
    if (cost === null) return '它就是佔著位置。';
    if (cost > this.slotsLeft) return '今年沒時間了。';
    if (c.requires_wealth !== undefined && this.stats.wealth < c.requires_wealth) return '家裡負擔不起。';
    return null;
  }
  playable(): Inst[] { return this.hand.filter((i) => !this.lockReason(i)); }
  play(uid: number): PlayResult {
    const i = this.hand.find((h) => h.uid === uid)!; const c = this.card(i);
    if (this.lockReason(i)) throw new Error('不能打這張');
    this.slotsLeft -= this.costOf(i)!;
    this.hand.splice(this.hand.indexOf(i), 1); this.playedThisYear.push(i);
    const { eff, expect } = this.effectsFor(i);
    this.playCount[c.id] = (this.playCount[c.id] ?? 0) + 1; this.everPlayed.add(c.id);
    let text = c.result_text ?? c.line;
    if (expect) text += `\n${this.cards.get('b_expect')!.result_text}`;
    const deltas = this.apply(eff);
    if (c.invest && (deltas.wealth ?? 0) < 0) this.investSpent -= deltas.wealth!;
    for (const t of c.tags ?? []) this.tags[t] = (this.tags[t] ?? 0) + 1;
    for (const id of c.removes ?? []) {
      if (id === c.id) { this.playedThisYear.splice(this.playedThisYear.indexOf(i), 1); this.removed.push(i); continue; }
      for (const pile of [this.draw, this.discard]) { const x = pile.find((y) => y.id === id); if (x) { pile.splice(pile.indexOf(x), 1); this.removed.push(x); break; } }
    }
    for (const id of c.clears ?? []) { const b = this.hand.find((h) => h.id === id); if (b) { this.hand.splice(this.hand.indexOf(b), 1); this.discard.push(b); } }
    for (const id of c.adds ?? []) {
      const d = this.cards.get(id)!; const exists = [...this.draw, ...this.discard, ...this.hand, ...this.playedThisYear].some((x) => x.id === id);
      if (!(d.once_in_deck && exists)) this.draw.push(this.mk(id));
    }
    // afb123a：每打一張牌就檢查壓力；超過門檻立刻病倒，今年剩下的時間作廢（不算休息）
    let sick: PlayResult['sick'];
    if (!this.sickThisYear && this.stats.stress >= this.cfg.forced.f_sick.stress_at_least) {
      const f = this.cards.get('f_sick')!; this.sickThisYear = true; this.sickCount++; this.slotsLeft = 0;
      this.apply(f.effects); this.yearNotes.push(`${f.name}：${f.line}`);
      sick = { text: (f as any).result_text ?? f.line, eventId: f.result_event };
    }
    return { card: c, text, eventId: c.result_event, deltas, sick };
  }
  /** 這張牌現在打出去會有的效果（含成長、遞減、期待） */
  effectsFor(i: Inst): { eff: Partial<Record<StatId, number>>; expect: boolean } {
    const c = this.card(i); const n = this.playCount[c.id] ?? 0;
    const mult = 1 + (c.growth_per_play ?? 0) * n;
    const src = n >= 1 && c.repeat_effects ? c.repeat_effects : c.effects;
    const eff: Partial<Record<StatId, number>> = {};
    for (const [k, v] of Object.entries(src)) eff[k as StatId] = Math.round((v ?? 0) * mult);
    let expect = false;
    if (c.tags?.some((t) => this.cfg.academic_tags.includes(t))) {
      const ex = this.hand.filter((h) => h !== i).map((h) => { const ih = this.card(h).in_hand;
        return ih?.academic_play_stress && this.stats.stress >= (ih.stress_at_least ?? 0) ? ih.academic_play_stress : 0; }).reduce((a, b) => a + b, 0);
      if (ex) { eff.stress = (eff.stress ?? 0) + ex; expect = true; }
    }
    return { eff, expect };
  }
  /** 打這張牌對變化分數的立即影響（模擬用） */
  scoreValue(i: Inst): number {
    const w = this.cfg.score.weights; const c = this.card(i); const { eff } = this.effectsFor(i);
    return Object.entries(eff).reduce((a, [k, v]) => a + (k === 'wealth' && c.invest && (v ?? 0) < 0 ? 0 : (w[k as StatId] ?? 0) * (v ?? 0)), 0);
  }
  /** 躺平：整局出牌數 ≤ 每年 passive.max_plays_per_year × 年數 */
  isPassive() { return Object.values(this.playCount).reduce((a, b) => a + b, 0) <= this.cfg.passive.max_plays_per_year * this.cfg.ages.length; }
  passiveEnding(): string | undefined {
    if (!this.isPassive()) return undefined;
    return this.cfg.passive.endings.find((e) => e.quintiles.includes(this.quintile))?.text;
  }
  endYear() {
    // §5.3：沒用到的時間格算休息
    if (!this.sickThisYear && this.slotsLeft > 0 && this.cfg.rest_stress_per_slot) this.apply({ stress: -this.cfg.rest_stress_per_slot * this.slotsLeft });
    for (const i of this.hand) { const c = this.card(i); if (c.unplayed_end) this.apply(c.unplayed_end); }
    for (const i of this.hand) (this.card(i).removes?.includes(i.id) && this.card(i).type === 'forced' ? this.removed : this.discard).push(i);
    this.discard.push(...this.playedThisYear); this.hand = [];
    this.log.push({ age: this.age, played: this.playedThisYear.map((i) => i.id) });
    // 錯過年紀：移出遊戲，沒打過的記進「沒走的路」
    for (const pile of [this.draw, this.discard]) for (const i of [...pile]) { const c = this.card(i);
      if (c.expires_age !== null && c.expires_age <= this.age) { pile.splice(pile.indexOf(i), 1); this.removed.push(i);
        if (!this.everPlayed.has(c.id) && !this.missed.some((m) => m.id === c.id)) {
          this.missed.push({ id: c.id, name: c.name, age: this.age, echo: c.echo }); this.flags.add(`missed_${c.id}`); } } }
    // 年底不再另外檢查：病倒只在打牌當下觸發（afb123a），避免同一份壓力被罰兩次
    if (this.ageIdx + 1 >= this.cfg.ages.length) { this.phase = 'review'; return; }
    this.ageIdx++; this.beginYear();
  }
  private apply(eff: Partial<Record<StatId, number>>) {
    const d: Partial<Record<StatId, number>> = {};
    for (const [k, v] of Object.entries(eff)) { const s = k as StatId; const nv = clamp(this.stats[s] + (v ?? 0)); d[s] = nv - this.stats[s]; this.stats[s] = nv; }
    return d;
  }
  // ----- §5 變化量 -----
  deltas() { const o = {} as Record<StatId, number>; for (const k of STATS) o[k] = this.stats[k] - this.start[k]; return o; }
  score() {
    const w = this.cfg.score.weights; const d = this.deltas();
    d.wealth += this.investSpent; // invest 牌花的錢不扣分
    const statPart = STATS.reduce((a, k) => a + (w[k] ?? 0) * d[k], 0);
    return statPart + this.tagBonus();
  }
  /** 軌跡標籤：同一種標籤打滿 tag_min_count 次才算 */
  tagBonus() {
    const m = this.cfg.score.tag_min_count ?? 1;
    return Object.values(this.tags).filter((n) => n >= m).length * this.cfg.score.tag_bonus;
  }
  trajectory(): string[] {
    return Object.entries(this.tags).sort((a, b) => b[1] - a[1]).filter(([, n]) => n >= (this.cfg.score.tag_min_count ?? 2)).slice(0, 3).map(([t]) => this.cfg.tag_names[t] ?? t);
  }
}

/** §6：每個分位、每個年齡可能出現在牌庫裡的牌（起始牌＋可洗入的牌＋強制事件） */
export function drawablePool(cfg: DeckConfig, cards: CardDef[], quintile: number, age: number): string[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const set = new Set([...cfg.start_deck.common, ...(cfg.start_deck.by_quintile[String(quintile)] ?? []), 'f_teacher', 'f_sick']);
  let grew = true; while (grew) { grew = false; for (const id of [...set]) for (const a of byId.get(id)?.adds ?? []) if (!set.has(a)) { set.add(a); grew = true; } }
  return [...set].filter((id) => { const c = byId.get(id)!; return age >= c.age_min && age <= c.age_max; });
}
