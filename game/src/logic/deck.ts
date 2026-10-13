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
  growth_per_play?: number; slot_cost?: number; once_in_deck?: boolean; held_per_year?: Record<string, number>;
  /** 打牌花的錢算投資，不扣變化分數（§5.2-1） */ invest?: boolean;
  max_in_deck?: number; grant_after?: { count: number; flag?: string; adds?: string[] };
  weight_quintile?: Record<string, number>; weight_if_played?: Record<string, number>;
  album_text?: string; regret_text?: string; accent?: string;
  /** 選校後的路線 flag（hs_general／hs_vocational／hs_5yr）才抽得到 */ requires_track?: string | string[];
  /** 牌庫（任一疊）裡有其中一張才能打（§9 b_judged：有 g_skill） */ requires_in_deck?: string[];
  /** 打滿 n 次後移出牌庫（§9 b_track_regret） */ remove_after?: number;
  /** 同一年打第 2 次時洗入（§11 s_skip→b_comfort） */ adds_if_twice_in_year?: string[];
  /** 不過期；整局都沒打過，局末記進沒走的路（§11 誘惑牌） */ missed_if_never_played?: boolean;
  /** 要先打過其中任一張才能打（別人的眼光：一技之長暫代） */ requires_played?: string[];
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
  regret_ratio?: number; regret_min_pool?: number;
  /** §10：升高中的暑假（進入 school_choice.age 前）壓力乘這個數 */ summer_stress_mult?: number;
  school_choice?: SchoolChoice;
  passive: { _note?: string; max_plays_per_year: number; endings: { quintiles: number[]; text: string }[] };
}
export interface SchoolOption { name: string; result: string; academic_min?: boolean; adds: string[]; adds_at_age?: Record<string, string[]> }
export interface SchoolChoice { age: number; general_academic_min: number | null; hint_under: string; options: Record<string, SchoolOption>;
  sim_policy: { general_if_eligible: number; five_year: number } }
export interface Inst { uid: number; id: string }
export interface Missed { id: string; name: string; age: number; echo?: { age: number; text: string } }
export interface PlayResult { card: CardDef; text: string; eventId?: string; deltas: Partial<Record<StatId, number>>; sick?: { text: string; eventId?: string } }
export interface CardVariant { name?: string | null; line?: string | null; icons?: string[]; result_text?: string | null; album_text?: string | null; regret_text?: string | null }
export interface EraCardVariants { by_birth_year: { from: number; to: number; label?: string; cards: Record<string, CardVariant> }[]; opening_lines?: { by_birth_year: { from: number; to: number; text: string }[] } }
export type DeckPhase = 'talent' | 'choice' | 'play' | 'yearEnd' | 'review';

const trackOk = (req: string | string[] | undefined, t: string | null | undefined) => !req || (!!t && (Array.isArray(req) ? req.includes(t) : req === t));
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
  private uid = 0; investSpent = 0; track: string | null = null; sickAges: number[] = [];

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
  /** 開場句：依出生年換掉「民國 xx 年，你在…出生。」那一句（畫面不顯示年份），其餘家境句照舊 */
  openingText(): string {
    const by = this.base.s.birthYear; const base = this.base.openingText();
    const line = this.eraVariants?.opening_lines?.by_birth_year.find((x) => by >= x.from && by <= x.to)?.text;
    const rest = base.replace(/^[^。]*出生。/, '');
    return line ? line.split('{city}').join(this.base.s.county.name) + rest : rest;
  }
  /** 依出生年換牌面（era_terms.json deck_card_variants）；回傳顯示用名稱、一句話、圖示候選 id */
  view(id: string): { name: string; line: string; icons: string[] } {
    const c = this.cards.get(id)!; const by = this.base.s.birthYear;
    const v = this.eraVariants?.by_birth_year.find((x) => by >= x.from && by <= x.to)?.cards[id];
    return { name: v?.name ?? c.name, line: v?.line ?? c.line, icons: v?.icons?.length ? v.icons : [id] };
  }
  /** 依出生年取文字欄位（變體沒填就用 cards.json） */
  text(id: string, f: 'result_text' | 'album_text' | 'regret_text'): string | undefined {
    const c = this.cards.get(id)!; const by = this.base.s.birthYear;
    const v = this.eraVariants?.by_birth_year.find((x) => by >= x.from && by <= x.to)?.cards[id];
    return v?.[f] ?? c[f];
  }
  get quintile() { return this.base.s.quintile; }
  get age() { return this.cfg.ages[this.ageIdx]; }
  card(i: Inst) { return this.cards.get(i.id)!; }
  private mk(id: string): Inst { if (!this.cards.has(id)) throw new Error(`未知牌 ${id}`); return { uid: ++this.uid, id }; }

  // ----- 天賦（原本的點數分配，開局一次） -----
  talentLeft() { return this.cfg.talent.points - Object.values(this.talent).reduce((a, b) => a + b, 0); }
  setTalent(alloc: Record<string, number>) { this.talent = { ...this.talent, ...alloc }; this.phase = 'play'; this.beginYear(); }
  private drawWeight(id: string) {
    let w = 1; const c = this.cards.get(id)!;
    w *= c.weight_quintile?.[String(this.quintile)] ?? 1;
    for (const [p, m] of Object.entries(c.weight_if_played ?? {})) if (this.everPlayed.has(p)) w *= m;
    for (const [k, o] of Object.entries(this.cfg.talent.options)) if (o.cards.includes(id)) w += (this.talent[k] ?? 0) * this.cfg.talent.per_point_weight;
    return w;
  }
  private eligible(i: Inst) { const c = this.card(i); return this.age >= c.age_min && this.age <= c.age_max && trackOk(c.requires_track, this.track); }

  // ----- 選校（cb9b590 §8：16 歲第一回合開頭，選了就算數） -----
  needsSchoolChoice() { const sc = this.cfg.school_choice; return !!sc && this.age === sc.age && !this.track; }
  /** 可選的路線；普高要學業 ≥ 門檻 */
  schoolOptions(): { key: string; opt: SchoolOption; locked: string | null }[] {
    const sc = this.cfg.school_choice!;
    return Object.entries(sc.options).map(([key, opt]) => ({ key, opt,
      locked: opt.academic_min && sc.general_academic_min !== null && this.stats.academic < sc.general_academic_min ? sc.hint_under : null }));
  }
  chooseSchool(key: string) {
    const o = this.schoolOptions().find((x) => x.key === key);
    if (this.phase !== 'choice' || !o || o.locked) throw new Error('不能選這個');
    this.track = key; this.flags.add(key);
    for (const id of o.opt.adds) this.draw.push(this.mk(id));
    this.phase = 'play'; this.beginYear();
    this.yearNotes.unshift(`選校：${o.opt.result}`);
  }
  /** 學段名稱：依年齡（國中／高中；選校後高職、五專顯示路線名） */
  stageOf(age: number) { return age <= 15 ? '國中' : !this.track ? '國中畢業' : this.track && this.track !== 'hs_general' ? this.cfg.school_choice!.options[this.track].name : '高中'; }
  /** 整局範圍：國中／高中／國中到高中 */
  runStageLabel() { const a = this.cfg.ages; const s0 = a[0] <= 15 ? '國中' : '高中'; const s1 = a[a.length - 1] <= 15 ? '國中' : '高中'; return s0 === s1 ? s0 : `${s0}到${s1}`; }

  // ----- 每年 -----
  private beginYear() {
    if (this.needsSchoolChoice()) { this.phase = 'choice'; return; }
    const late = this.track ? this.cfg.school_choice?.options[this.track]?.adds_at_age?.[String(this.age)] : undefined;
    for (const id of late ?? []) this.draw.push(this.mk(id));
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
    if (c.requires_played && !c.requires_played.some((p) => this.everPlayed.has(p))) return '你還沒有拿得出手的東西。';
    if (c.requires_in_deck && !c.requires_in_deck.some((p) => [...this.draw, ...this.discard, ...this.hand, ...this.playedThisYear].some((x) => x.id === p))) return '你還沒有拿得出手的東西。';
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
    let text = this.text(c.id, 'result_text') ?? this.view(c.id).line;
    if (expect) text += `\n${this.cards.get('b_expect')!.result_text}`;
    const deltas = this.apply(eff);
    if (c.invest && (deltas.wealth ?? 0) < 0) this.investSpent -= deltas.wealth!;
    for (const t of c.tags ?? []) this.tags[t] = (this.tags[t] ?? 0) + 1;
    const rem = [...(c.removes ?? []), ...(c.remove_after && this.playCount[c.id] % c.remove_after === 0 ? [c.id] : [])];
    for (const id of rem) {
      if (id === c.id) { this.playedThisYear.splice(this.playedThisYear.indexOf(i), 1); this.removed.push(i); continue; }
      for (const pile of [this.draw, this.discard]) { const x = pile.find((y) => y.id === id); if (x) { pile.splice(pile.indexOf(x), 1); this.removed.push(x); break; } }
    }
    for (const id of c.clears ?? []) { const b = this.hand.find((h) => h.id === id); if (b) { this.hand.splice(this.hand.indexOf(b), 1); this.discard.push(b); } }
    const twice = c.adds_if_twice_in_year && this.playedThisYear.filter((x) => x.id === c.id).length === 2 ? c.adds_if_twice_in_year : [];
    for (const id of [...(c.adds ?? []), ...twice]) {
      const d = this.cards.get(id)!; const exists = [...this.draw, ...this.discard, ...this.hand, ...this.playedThisYear].some((x) => x.id === id);
      const n = [...this.draw, ...this.discard, ...this.hand, ...this.playedThisYear].filter((x) => x.id === id).length;
      if (!(d.once_in_deck && exists) && !(d.max_in_deck !== undefined && n >= d.max_in_deck)) this.draw.push(this.mk(id));
    }
    const ga = c.grant_after;
    if (ga && this.playCount[c.id] === ga.count) { if (ga.flag) this.flags.add(ga.flag);
      for (const id of ga.adds ?? []) if (![...this.draw, ...this.discard, ...this.hand].some((x) => x.id === id)) this.draw.push(this.mk(id)); }
    // afb123a：每打一張牌就檢查壓力；超過門檻立刻病倒，今年剩下的時間作廢（不算休息）
    let sick: PlayResult['sick'];
    if (!this.sickThisYear && this.stats.stress >= this.cfg.forced.f_sick.stress_at_least) {
      const f = this.cards.get('f_sick')!; this.sickThisYear = true; this.sickCount++; this.sickAges.push(this.age); this.slotsLeft = 0;
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
  /** 遺憾多／少：抽到（打過或錯過）的會過期牌 < regret_min_pool → low；錯過÷抽到 ≥ regret_ratio → high */
  expiringDrawn(): string[] { return [...this.cards.values()].filter((c) => c.expires_age !== null && !c.missed_if_never_played && (this.everPlayed.has(c.id) || this.missed.some((m) => m.id === c.id))).map((c) => c.id); }
  /** b1205fe：誘惑牌只出現在沒走的路文字，不算進遺憾比例 */
  regretMissed() { return this.missed.filter((m) => !this.cards.get(m.id)?.missed_if_never_played); }
  regretLevel(): 'low' | 'high' {
    const drawn = this.expiringDrawn().length;
    if (drawn < (this.cfg.regret_min_pool ?? 2)) return 'low';
    return this.regretMissed().length / drawn >= (this.cfg.regret_ratio ?? 0.75) ? 'high' : 'low';
  }
  endYear() {
    // §5.3：沒用到的時間格算休息
    if (!this.sickThisYear && this.slotsLeft > 0 && this.cfg.rest_stress_per_slot) this.apply({ stress: -this.cfg.rest_stress_per_slot * this.slotsLeft });
    // 持有效果：牌庫裡（任何一疊）有這張牌，每年固定加
    for (const i of new Set([...this.draw, ...this.discard, ...this.hand, ...this.playedThisYear])) { const h = this.card(i).held_per_year; if (h) this.apply(h); }
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
    if (this.ageIdx + 1 >= this.cfg.ages.length) {
      // §11：不過期的誘惑牌，牌庫裡有、整局都沒打過 → 局末進沒走的路
      for (const i of new Set([...this.draw, ...this.discard, ...this.removed])) { const c = this.card(i);
        if (c.missed_if_never_played && !this.everPlayed.has(c.id) && !this.missed.some((m) => m.id === c.id)) this.missed.push({ id: c.id, name: this.view(c.id).name, age: this.age }); }
      this.phase = 'review'; return; }
    if (this.cfg.summer_stress_mult !== undefined && this.cfg.ages[this.ageIdx + 1] === this.cfg.school_choice?.age) this.stats.stress = clamp(this.stats.stress * this.cfg.summer_stress_mult);
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
export function drawablePool(cfg: DeckConfig, cards: CardDef[], quintile: number, age: number, track?: string): string[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const set = new Set([...cfg.start_deck.common, ...(cfg.start_deck.by_quintile[String(quintile)] ?? []), 'f_teacher', 'f_sick',
    ...(track ? [...(cfg.school_choice?.options[track]?.adds ?? []), ...Object.values(cfg.school_choice?.options[track]?.adds_at_age ?? {}).flat()] : [])]);
  let grew = true; while (grew) { grew = false; for (const id of [...set]) for (const a of [...(byId.get(id)?.adds ?? []), ...(byId.get(id)?.grant_after?.adds ?? [])]) if (!set.has(a)) { set.add(a); grew = true; } }
  return [...set].filter((id) => { const c = byId.get(id)!; return age >= c.age_min && age <= c.age_max && trackOk(c.requires_track, track); });
}
/** 假玩家選校（config.school_choice.sim_policy）：夠門檻→一定機率普高；否則小機率五專，其餘高職 */
export function botSchoolChoice(g: DeckGame, r: Rng): string {
  const sp = g.cfg.school_choice!.sim_policy; const ok = g.schoolOptions().filter((x) => !x.locked).map((x) => x.key);
  if (ok.includes('hs_general') && r.next() < sp.general_if_eligible) return 'hs_general';
  return r.next() < sp.five_year ? 'hs_5yr' : 'hs_vocational';
}
