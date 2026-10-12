import type { Balance } from './balance';
import { makeRng, type Rng } from './rng';
import {
  STATS, STAT_NAMES, STAGE_NAMES, type StatId, type StageId, type GameData, type GameEvent,
  type Requires, type County, type Choice, type Mountain, type EndingCond,
} from './types';

// ---------- 常數（對應 core-loop.md v0.2） ----------
export type ActionId = string;
export interface ActionDef { id: ActionId; name: string; from: StageId; desc: string; flavor?: string }
/** 效果方向（UI 不顯示數字）：↑／↓，|值| ≥ 5 用兩個箭頭 */
const arrowsOf = (eff: Record<string, number>) => Object.entries(eff).filter(([, v]) => v).map(([k, v]) => `${STAT_NAMES[k as StatId] ?? k}${(v > 0 ? '↑' : '↓').repeat(Math.abs(v) >= 5 ? 2 : 1)}`).join(' ');
const ACTION_NAMES: Record<string, string> = {
  study: '讀書', cram: '補習', play: '玩樂', socialize: '陪家人/交朋友', exercise: '運動', talent: '才藝', work: '打工', rest: '躺平',
  // 路線行動（design/path-actions.md v0.6，暫定名稱，文案之後改）
  voc_intern: '實習', voc_license: '考證照', uni_club: '社團', uni_date: '談戀愛',
  mil_drill: '操練', mil_guard: '站哨', mil_leave: '放假回家', job_overtime: '加班', job_hunt: '找下一份工作', job_drink: '下班喝一杯',
};
/** 行動清單由 balance.json 產生（名稱為 UI 文字） */
export function actionDefs(b: Balance): ActionDef[] {
  return Object.entries(b.actions).map(([id, a]) => ({
    id: id as ActionId, name: a.name ?? ACTION_NAMES[id] ?? id, from: a.from,
    // UI 不顯示數字：只寫方向（↑／↓），大幅（≥5）用兩個箭頭
    desc: arrowsOf(a.effects), flavor: a.desc,
  }));
}
const UNI_FLAGS = ['uni_top', 'uni_normal', 'uni_tech']; const STUDENT_LOAN_WEALTH = 30;
const STAGE_ORDER: StageId[] = ['infant', 'elementary', 'junior', 'senior', 'adult'];

export interface TurnDef { stage: StageId; age: number; ap: boolean; branch?: string; random: boolean; label?: string }
/** 16 回合表。B2、B4 為 §1 所說的「分岔點專屬回合」（無 AP、無隨機事件）。 */
export const TURNS: TurnDef[] = [
  { stage: 'infant', age: 0, ap: false, random: true },
  { stage: 'infant', age: 4, ap: false, random: true },
  { stage: 'elementary', age: 7, ap: true, random: true },
  { stage: 'elementary', age: 9, ap: true, random: false, branch: 'B1' },
  { stage: 'elementary', age: 11, ap: true, random: true },
  { stage: 'junior', age: 13, ap: true, random: true },
  { stage: 'junior', age: 14, ap: true, random: true },
  { stage: 'junior', age: 15, ap: true, random: true },
  { stage: 'junior', age: 15, ap: false, random: false, branch: 'B2', label: '{exam_name}' },
  { stage: 'senior', age: 16, ap: true, random: true },
  { stage: 'senior', age: 17, ap: true, random: false, branch: 'B3' },
  { stage: 'senior', age: 18, ap: true, random: true },
  { stage: 'adult', age: 18, ap: false, random: false, branch: 'B4', label: '畢業' },
  { stage: 'adult', age: 19, ap: true, random: true },
  { stage: 'adult', age: 20, ap: true, random: true },
  { stage: 'adult', age: 22, ap: true, random: true },
];
const BRANCH_ID_SUFFIX: Record<string, string> = { B1: '_B1', B2: '_B2', B3: '_B3', B4: '_B4' };

// ---------- 狀態 ----------
export interface LogEntry { turn: number; stage: StageId; eventId: string; title: string; choice: string; result: string; impact: number; priority: number; caption?: string }
export interface StageSummary { stage: StageId; title: string; text: string; deltas: Partial<Record<StatId, number>> }
export interface PendingEvent { event: GameEvent; forced?: 'breakdown' | 'sick' }
export type Phase = 'ap' | 'event' | 'result' | 'summary' | 'ending';

export interface GameState {
  seed: number; birthYear: number; county: County; quintile: number;
  stats: Record<StatId, number>; effort: number; regret: number; flags: Set<string>;
  turn: number; phase: Phase; apPenalty: number; apZero: boolean;
  queue: PendingEvent[]; current?: PendingEvent; lastResult?: { title: string; text: string; choice: string };
  seenEvents: Set<string>; log: LogEntry[]; breakdowns: number; povertyTurns: number; actionTotals: Record<string, number>;
  stageApUse: Record<string, Record<string, number>>; stageStart: Record<StatId, number>;
  summary?: StageSummary; notes: string[]; forcedDone?: boolean; startStats: Record<StatId, number>;
}

export const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

export class Game {
  opts: { birthYear?: number } = {};
  rng: Rng; s: GameState; b: Balance; actions: ActionDef[];
  constructor(public data: GameData, seed = Math.floor(Math.random() * 2 ** 31), opts: { birthYear?: number } = {}) {
    this.opts = opts;
    this.rng = makeRng(seed); this.b = data.balance; this.actions = actionDefs(this.b);
    this.s = this.generateStart(seed);
    this.beginTurn();
  }

  // ----- §6 開局 -----
  private generateStart(seed: number): GameState {
    const county = this.rng.weighted(this.data.counties, (c) => c.birth_weight)!;
    const r = county.income_vs_taiwan;
    const dist = county.income_quintile_dist;
    const q = dist
      ? this.rng.weighted([1, 2, 3, 4, 5], (k) => dist[k - 1])!
      : this.rng.weighted([1, 2, 3, 4, 5], (k) => Math.exp(this.b.quintile_shift_alpha * (r - 1) * (k - 3)))!; // fallback
    const Q = this.b.quintiles[String(q)];
    const I = this.b.initial_stats;
    const stats = { ...I, wealth: Q.wealth } as Record<StatId, number>;
    stats.academic += county.academic_mod; stats.social += county.social_mod;
    for (const [k, v] of Object.entries(Q.mods)) stats[k as StatId] += v;
    for (const k of STATS) stats[k] = clamp(stats[k]);
    return {
      seed, birthYear: this.drawBirthYear(), county, quintile: q, stats, effort: 0, regret: 0,
      flags: new Set(Q.flags), turn: 0, phase: 'ap', apPenalty: 0, apZero: false, queue: [],
      seenEvents: new Set(), log: [], breakdowns: 0, povertyTurns: 0, actionTotals: {}, stageApUse: {},
      stageStart: { ...stats }, startStats: { ...stats }, notes: [],
    };
  }

  get turnDef(): TurnDef { return TURNS[this.s.turn]; }
  /** 依 birth_years.json 的 weight 抽出生年（民國）；資料缺漏時退回 80–89 均勻 */
  private drawBirthYear(): number {
    if (this.opts.birthYear) return this.opts.birthYear;
    const by = this.data.birthYears;
    return by.length ? this.rng.weighted(by, (y) => y.weight)!.roc_year : this.rng.int(80, 89);
  }
  /** 出生年對應的時代用語（era_terms.json） */
  eraTerms(): Record<string, string> {
    return this.data.eraTerms.find((seg) => this.s.birthYear >= seg.from && this.s.birthYear <= seg.to)?.terms ?? {};
  }
  /** 所有文案共用的變數 */
  textVars(): Record<string, string | number> {
    return { ...this.eraTerms(), county: this.s.county.name, birth_year: this.s.birthYear, effort: this.s.effort, regret: this.s.regret };
  }
  /** 代入 {變數}；未知變數保留原樣並記錄提示 */
  t(str: string | undefined, extra: Record<string, string | number> = {}): string {
    if (!str) return '';
    const vars = { ...this.textVars(), ...extra };
    return str.replace(/\{(\w+)\}/g, (m, k) => {
      if (k in vars) return String(vars[k]);
      const n = `未知變數 ${m}`; if (!this.s.notes.includes(n)) this.s.notes.push(n);
      return m;
    });
  }
  /** 開局旁白（opening.json by_quintile） */
  openingText(): string { return this.t(this.data.opening[`Q${this.s.quintile}`]); }
  get minguoYear(): number { return this.s.birthYear + this.turnDef.age; }

  apForTurn(): number {
    const t = this.turnDef;
    if (!t.ap || this.s.apZero) return 0;
    return Math.max(0, (this.b.ap_by_stage[t.stage] ?? 0) - this.s.apPenalty);
  }
  availableActions(): ActionDef[] {
    const idx = STAGE_ORDER.indexOf(this.turnDef.stage);
    const f = this.s.flags;
    return this.actions.filter((a) => {
      const ab = this.b.actions[a.id];
      if (STAGE_ORDER.indexOf(a.from) > idx) return false;
      if (ab.until && STAGE_ORDER.indexOf(ab.until) < idx) return false;
      if (ab.flags_any?.length && !ab.flags_any.some((x) => f.has(x))) return false;
      if (ab.flags_none?.some((x) => f.has(x))) return false;
      return true;
    });
  }
  /** 選大學時依出身擲骰決定學貸（balance.student_loan_chance_by_quintile） */
  rollStudentLoan(): boolean {
    const p = (this.b as any).student_loan_chance_by_quintile?.[String(this.s.quintile)] ?? 0;
    return this.rng.int(1, 10000) <= Math.round(p * 10000);
  }

  /** 行動是否可用（§3 wealth≤0 鎖付費、§4 條件） */
  actionLock(a: ActionId, wealth = this.s.stats.wealth): string | null {
    const need = this.b.actions[a]?.requires_wealth;
    if (need === undefined) return null;
    const cost = -(this.actionEffects(a).wealth ?? 0);
    const min = cost > 0 ? cost : need; // §18：付得起實際花費就能做（BUG-6）
    return wealth < min ? '家裡負擔不起' : null; // UI 不顯示數字
  }
  /** 行動實際效果（補習費依縣市倍率縮放） */
  actionEffects(a: ActionId): Record<string, number> {
    const ab = this.b.actions[a]; const eff = { ...ab.effects };
    if (ab.wealth_scaled_by === 'cram_cost_mult' && eff.wealth) eff.wealth = eff.wealth * this.s.county.cram_cost_mult; // 兩個倍率乘完才取整（BUG-7）
    return this.scaleCost(eff);
  }
  /** 花費依出身打折：balance.json cost_mult_by_quintile（沒填就是 1，不影響現狀） */
  scaleCost(eff: Record<string, number>): Record<string, number> {
    const m = (this.b as any).cost_mult_by_quintile?.[String(this.s.quintile)];
    if (!(eff.wealth < 0)) return eff;
    return { ...eff, wealth: Math.round(eff.wealth * (m ?? 1)) };
  }

  private beginTurn() {
    const t = this.turnDef;
    this.s.queue = [];
    if (t.branch) {
      const ev = this.data.events.find((e) => e.type === 'branch' && e.id.endsWith(BRANCH_ID_SUFFIX[t.branch!]));
      if (ev) this.s.queue.push({ event: ev });
      else this.s.notes.push(`找不到分岔事件 ${t.branch}`);
    }
    if (t.random) {
      const ev = this.drawRandom(t.stage);
      if (ev) this.s.queue.push({ event: ev });
      else this.s.notes.push(`回合 ${this.s.turn + 1}（${STAGE_NAMES[t.stage]}）事件池已空`);
    }
    if (this.apForTurn() > 0) this.s.phase = 'ap';
    else { if (t.ap) this.consumeApModifiers(); this.nextEvent(); } // 無行動點回合不吃掉懲罰（§15）
  }
  private consumeApModifiers() { this.s.apPenalty = 0; this.s.apZero = false; }

  // ----- §4 行動 -----
  /** alloc: 行動 -> 點數。依序逐點結算；付費行動在資源不足時該點作廢（UI 應避免）。 */
  applyActions(alloc: Partial<Record<ActionId, number>>) {
    if (this.s.phase !== 'ap') throw new Error('not in ap phase');
    const total = Object.values(alloc).reduce<number>((a, b) => a + (b ?? 0), 0);
    if (total > this.apForTurn()) throw new Error('too many AP');
    const stage = this.turnDef.stage;
    const use = (this.s.stageApUse[stage] ??= {});
    for (const [id, n] of Object.entries(alloc) as [ActionId, number][]) {
      for (let i = 0; i < (n ?? 0); i++) {
        if (this.actionLock(id)) continue;
        use[id] = (use[id] ?? 0) + 1;
        const ab = this.b.actions[id];
        this.mod(this.actionEffects(id));
        this.s.effort += ab.effort ?? 0; this.s.regret += ab.regret ?? 0;
        if (ab.flag_after) {
          const n = (this.s.actionTotals[id] = (this.s.actionTotals[id] ?? 0) + 1);
          if (n >= ab.flag_after.points) this.s.flags.add(ab.flag_after.flag);
        }
      }
    }
    this.consumeApModifiers();
    this.nextEvent();
  }

  private mod(eff: Partial<Record<string, number>>) {
    for (const [k, v] of Object.entries(eff)) {
      if (k in this.s.stats) this.s.stats[k as StatId] = clamp(this.s.stats[k as StatId] + (v ?? 0));
      else if (v) this.s.notes.push(`未知屬性 ${k}`);
    }
  }

  // ----- 條件 -----
  meets(req: Requires | undefined): boolean {
    if (!req) return true;
    const f = this.s.flags;
    if (req.flags_all?.some((x) => !f.has(x))) return false;
    if (req.flags_none?.some((x) => f.has(x))) return false;
    if (req.flags_any?.length && !req.flags_any.some((x) => f.has(x))) return false;
    for (const [k, v] of Object.entries(req.stats_min ?? {})) if (this.statOf(k) < (v ?? 0)) return false;
    for (const [k, v] of Object.entries(req.stats_max ?? {})) if (this.statOf(k) > (v ?? 100)) return false;
    const age = (TURNS[this.s.turn] ?? TURNS[TURNS.length - 1]).age; // §17 年齡範圍（結局後取最後一回合）
    if (req.age_min !== undefined && age < req.age_min) return false;
    if (req.age_max !== undefined && age > req.age_max) return false;
    if (req.county_tags_any?.length && !req.county_tags_any.some((t) => this.s.county.event_tags.includes(t))) return false;
    return true;
  }
  private statOf(k: string): number {
    if (k === 'effort') return this.s.effort;
    if (k === 'regret') return this.s.regret;
    return this.s.stats[k as StatId] ?? 0;
  }
  private drawRandom(stage: StageId): GameEvent | undefined {
    const pool = this.data.events.filter((e) => e.type === 'random' && (e.stage === stage || e.stage === 'any')
      && !(e.once !== false && this.s.seenEvents.has(e.id)) && this.meets(e.conditions));
    return this.rng.weighted(pool, (e) => e.weight ?? 10);
  }

  // ----- 事件 -----
  /** §18：選項的財富門檻改成「付不付得起打折後的花費」；沒有花費的選項，門檻也依出身倍率縮放 */
  choiceLocked(c: Choice): boolean {
    if (this.baseLocked(c)) return true;
    // BUG-5：沒設門檻但要花錢的選項，付不起就鎖；若整張卡沒有其他可選項（必要支出），允許透支避免卡死
    if (!this.cantAfford(c)) return false;
    const others = this.s.current?.event.choices.filter((o) => o !== c) ?? [];
    return others.some((o) => !this.baseLocked(o) && !this.cantAfford(o));
  }
  private cantAfford(c: Choice): boolean {
    const cost = -(this.scaleCost((c.effects ?? {}) as Record<string, number>).wealth ?? 0);
    return cost > 0 && this.s.stats.wealth < cost;
  }
  private baseLocked(c: Choice): boolean {
    const req = c.requires; const wMin = req?.stats_min?.wealth;
    if (!req || wMin === undefined) return !this.meets(req);
    const { wealth: _w, ...rest } = req.stats_min!;
    const cost = -(this.scaleCost((c.effects ?? {}) as Record<string, number>).wealth ?? 0);
    const m = (this.b as any).cost_mult_by_quintile?.[String(this.s.quintile)] ?? 1;
    const need = cost > 0 ? cost : Math.round(wMin * m);
    return this.s.stats.wealth < need || !this.meets({ ...req, stats_min: rest });
  }

  /** 鎖定時與門檻的最大差距（只算沒達到的 stats_min／stats_max；財富用實際需要額） */
  lockGap(c: Choice): number | null {
    const req = c.requires; let gap: number | null = null;
    const bump = (g: number) => { if (g > 0 && (gap === null || g > gap)) gap = g; };
    for (const [k, v] of Object.entries(req?.stats_min ?? {})) {
      if (v === undefined) continue;
      if (k === 'wealth') {
        const cost = -(this.scaleCost((c.effects ?? {}) as Record<string, number>).wealth ?? 0);
        const m = (this.b as any).cost_mult_by_quintile?.[String(this.s.quintile)] ?? 1;
        bump((cost > 0 ? cost : Math.round(v * m)) - this.s.stats.wealth);
      } else bump(v - this.statOf(k));
    }
    for (const [k, v] of Object.entries(req?.stats_max ?? {})) if (v !== undefined) bump(this.statOf(k) - v);
    if (gap === null && this.cantAfford(c)) bump(-(this.scaleCost((c.effects ?? {}) as Record<string, number>).wealth ?? 0) - this.s.stats.wealth);
    return gap;
  }
  /** 鎖定說明：依差距挑 lock_text_near／lock_text_far，退回 lock_text */
  lockText(c: Choice): string | undefined {
    const gap = this.lockGap(c);
    if (gap !== null) {
      const pick = gap <= (this.b.lock_near_gap ?? 10) ? c.lock_text_near : c.lock_text_far;
      if (pick) return this.t(pick);
    }
    return c.lock_text ? this.t(c.lock_text) : undefined;
  }

  /** 旗標條件（flags_all／flags_any／flags_none）不符的選項整個隱藏，不顯示成鎖定 */
  choiceHiddenByFlags(c: Choice): boolean {
    const r = c.requires; if (!r) return false; const f = this.s.flags;
    return !!(r.flags_all?.some((x) => !f.has(x)) || r.flags_none?.some((x) => f.has(x)) || (r.flags_any?.length && !r.flags_any.some((x) => f.has(x))));
  }
  /** 要顯示的選項索引；保證至少一個（全被旗標擋掉時退回全部顯示） */
  visibleChoices(): number[] {
    const ch = this.s.current?.event.choices ?? [];
    const idx = ch.map((_, i) => i).filter((i) => !this.choiceHiddenByFlags(ch[i]!));
    return idx.length ? idx : ch.map((_, i) => i);
  }

  private nextEvent() {
    const nx = this.s.queue.shift();
    if (nx) { this.s.current = nx; this.s.phase = 'event'; return; }
    this.endTurn();
  }

  choose(i: number) {
    const cur = this.s.current;
    if (this.s.phase !== 'event' || !cur) throw new Error('no event');
    const c = cur.event.choices[i];
    if (!c || this.choiceLocked(c)) throw new Error('locked');
    const before = { ...this.s.stats };
    if (cur.forced === 'breakdown') this.mod(this.b.forced.breakdown_effects);
    this.mod(this.scaleCost((c.effects ?? {}) as Record<string, number>));
    this.s.effort += c.hidden?.effort ?? 0;
    this.s.regret += c.hidden?.regret ?? 0;
    for (const fl of c.set_flags ?? []) this.s.flags.add(fl);
    // endings-v2 §4：B4 選大學時家庭資源 < 30（選項花費打折扣完之後的值）→ 學貸
    if ((c.set_flags ?? []).some((x) => UNI_FLAGS.includes(x)) && this.rollStudentLoan()) this.s.flags.add('student_loan');
    this.s.seenEvents.add(cur.event.id);
    const impact = STATS.reduce((s, k) => s + Math.abs(this.s.stats[k] - before[k]), 0);
    this.s.log.push({
      turn: this.s.turn, stage: this.turnDef.stage, eventId: cur.event.id, title: this.t(cur.event.title), choice: this.t(c.text),
      result: this.t(c.result_text), impact, priority: cur.event.album?.priority ?? 1, caption: cur.event.album?.caption && this.t(cur.event.album.caption),
    });
    this.s.lastResult = { title: this.t(cur.event.title), text: this.t(c.result_text), choice: this.t(c.text) };
    this.s.current = undefined;
    this.s.phase = 'result';
  }

  /** 看完結果後繼續 */
  continueAfterResult() { if (this.s.phase === 'result') this.nextEvent(); }

  private endTurn() {
    // §2-4 被動結算（§12 長大的代價）。強制事件後的重新檢查不重複扣。
    if (!this.s.forcedDone) {
      const pp = this.b.passive_per_turn;
      this.mod(pp.all); this.mod(pp.stage_extra[this.turnDef.stage] ?? {});
      this.mod({ wealth: pp.wealth_by_quintile[String(this.s.quintile)] ?? 0 });
      const pov = pp.poverty_pressure;
      if (pov && this.s.stats.wealth < pov.wealth_below) { this.mod(pov.effects); this.s.povertyTurns++; }
    }
    // §2-5 檢查：壓力爆表、病倒（每回合各最多一次）
    const forced: PendingEvent[] = [];
    const F = this.b.forced;
    if (!this.s.forcedDone && this.s.stats.stress >= F.breakdown_stress_min) { // 同回合最多一次（§15）
      const ev = this.data.events.find((e) => e.type === 'forced' && /breakdown|collapse/.test(e.id));
      this.s.breakdowns++; this.s.apPenalty = F.breakdown_ap_penalty;
      if (ev) forced.push({ event: ev, forced: 'breakdown' }); else this.mod(F.breakdown_effects);
    }
    if (!this.s.forcedDone && this.s.stats.health <= F.sick_health_max) {
      const ev = this.data.events.find((e) => e.type === 'forced' && /sick/.test(e.id));
      this.s.apZero = true;
      if (ev) forced.push({ event: ev, forced: 'sick' });
    }
    if (forced.length && !this.s.forcedDone) {
      this.s.queue.push(...forced); this.s.forcedDone = true; this.nextEvent(); return;
    }
    this.s.forcedDone = false;
    const t = this.turnDef; const nextT = TURNS[this.s.turn + 1];
    if (!nextT || nextT.stage !== t.stage) { this.s.summary = this.buildSummary(t.stage); this.s.phase = 'summary'; return; }
    this.advance();
  }

  ackSummary() { if (this.s.phase === 'summary') this.advance(); }

  private advance() {
    this.s.summary = undefined;
    this.s.turn++;
    if (this.s.turn >= TURNS.length) { this.s.phase = 'ending'; return; }
    if (TURNS[this.s.turn].stage !== TURNS[this.s.turn - 1].stage) this.s.stageStart = { ...this.s.stats };
    this.beginTurn();
  }

  // ----- 階段總結 -----
  private buildSummary(stage: StageId): StageSummary {
    const deltas: Partial<Record<StatId, number>> = {};
    for (const k of STATS) deltas[k] = this.s.stats[k] - this.s.stageStart[k];
    const tpl = this.data.narration[stage];
    let text: string;
    if (tpl) text = this.t(tpl, this.narrationVars(stage));
    else text = this.genericNarration(stage, deltas);
    return { stage, title: `${STAGE_NAMES[stage]}階段結束`, text, deltas };
  }
  narrationVars(stage: StageId): Record<string, string | number> {
    const use = this.s.stageApUse[stage] ?? {};
    const studyPts = (use.study ?? 0) + (use.cram ?? 0);
    const f = this.s.flags;
    const place = f.has('hs_elite') ? '明星高中的紅榜上' : f.has('hs_normal') ? '一般高中的錄取名單上'
      : f.has('hs_vocational') ? '高職的新生名冊上' : f.has('hs_junior_college') ? '五專的新生名冊上' : '某張名單上';
    return {
      exam_papers: 300 + studyPts * 60 + this.rng.int(0, 40),
      result_place: place, height_gain: this.rng.int(12, 25),
      album_caption: this.albumFor(stage)?.caption ?? '', age: this.turnDef.age, county: this.s.county.name, effort: this.s.effort, regret: this.s.regret,
      ...Object.fromEntries(STATS.map((k) => [k, this.s.stats[k]])),
    };
  }
  private genericNarration(stage: StageId, d: Partial<Record<StatId, number>>): string {
    const ranked = STATS.map((k) => [k, d[k] ?? 0] as const).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const [top, val] = ranked[0];
    const lines: Record<StageId, string> = {
      infant: '你還不記得這幾年，但大人們都記得，而且會在每一次過年提醒你。',
      elementary: '你學會了九九乘法表、注音符號，以及在聯絡簿上模仿家長簽名的筆跡。',
      junior: '三年過去了，你的人生第一次被一張成績單總結。',
      senior: '你在制服裡度過最後三年，學會了把夢想寫成學習歷程。',
      adult: '你終於長大了，發現大人們也都還在假裝。',
    };
    const trend = val === 0 ? '各項數值大致持平，像台灣的薪水一樣。'
      : `這個階段變化最大的是「${STAT_NAMES[top]}」（${val > 0 ? '+' : ''}${val}）。`;
    return `${lines[stage]}\n\n${trend}`;
  }

  // ----- §7 結局 -----
  endingId(): string {
    const s = this.s, st = s.stats, f = s.flags, E = this.b.endings;
    const all = (xs?: string[]) => !xs?.length || xs.every((x) => f.has(x));
    const any = (xs?: string[]) => !xs?.length || xs.some((x) => f.has(x));
    if (s.breakdowns >= E.burnout.breakdowns_min || st.health <= E.burnout.health_max) return 'burnout';
    const gc = E.golden_cage;
    if (all(gc.flags_all) && any(gc.flags_any) && st.happiness <= gc.happiness_max) return 'golden_cage';
    const ao = E.against_odds;
    const route = (ao.flags_any?.length ? ao.flags_any.some((x) => f.has(x)) : false) || (ao.or_wealth_min !== undefined && st.wealth >= ao.or_wealth_min);
    if (s.quintile <= ao.quintile_max && route && s.effort >= ao.effort_min) return 'against_odds';
    // endings-v2 §2：稀有之後、平凡就是福之前，依 endings.json 順序判斷有 conditions 的結局
    const core = new Set(['burnout', 'golden_cage', 'against_odds', 'ordinary_good', 'still_trying']);
    for (const e of this.data.endings.endings) if (!core.has(e.id) && e.conditions && this.meetsEnding(e.conditions)) return e.id;
    if (st.happiness >= E.ordinary_good.happiness_min && st.social >= E.ordinary_good.social_min) return 'ordinary_good';
    return 'still_trying';
  }
  /** 結局條件：meets() 之外再看出身分位、努力、遺憾、計數 */
  meetsEnding(c: EndingCond): boolean {
    const s = this.s;
    const rng = (v: number, lo?: number, hi?: number) => (lo === undefined || v >= lo) && (hi === undefined || v <= hi);
    if (!rng(s.quintile, c.quintile_min, c.quintile_max) || !rng(s.effort, c.effort_min, c.effort_max) || !rng(s.regret, c.regret_min, c.regret_max)) return false;
    for (const [k, n] of Object.entries(c.counts_min ?? {})) if (((s as any)[k] ?? s.actionTotals[k] ?? 0) < n) return false;
    const { quintile_min: _a, quintile_max: _b, effort_min: _c, effort_max: _d, regret_min: _e, regret_max: _f, counts_min: _g, ...req } = c;
    return this.meets(req);
  }
  /** 成就：條件沿用 conditions 寫法，另加 ending（結局 id）。回傳本輪達成的 id */
  achievementsMet(list: { id: string; conditions?: Requires & { ending?: string } }[]): string[] {
    const end = this.endingId();
    return list.filter((a) => { const { ending, ...req } = a.conditions ?? {};
      return (!ending || ending === end) && this.meets(req as Requires); }).map((a) => a.id);
  }
  ending() {
    const id = this.endingId();
    const e = this.data.endings.endings.find((x) => x.id === id) ?? this.data.endings.endings[this.data.endings.endings.length - 1];
    const high = this.s.regret >= this.b.endings.regret_high_threshold;
    const v = e.variants?.find((x) => x.quintile === this.s.quintile && x.regret === (high ? 'high' : 'low'));
    return { id, title: this.t(e.title), text: this.t(v?.text ?? (high ? e.regret_high : e.regret_low)), regretHigh: high, quintile: this.s.quintile };
  }

  // ----- 人生回顧 -----
  review() {
    const r = this.data.endings.review;
    const vars = { effort: this.s.effort, regret: this.s.regret };
    const album = STAGE_ORDER.map((st) => this.albumFor(st)).filter((x): x is NonNullable<typeof x> => !!x);
    return {
      album,
      origin: ((v: unknown) => Array.isArray(v) ? (v.length ? String(v[this.s.seed % v.length]) : undefined) : (typeof v === 'string' ? v : undefined))((r as any).origin_reveal?.[`Q${this.s.quintile}`]), // 有資料才顯示；陣列依種子挑一句
      effort: this.t(pickTier(r.effort_reveal, this.s.effort), vars),
      regret: this.t(pickTier(r.regret_reveal, this.s.regret), vars),
      mountain: ((m) => m && { ...m, title: this.t(m.title), text: this.t(m.text) })(this.judgeMountain(r.three_mountains)),
    };
  }
  albumFor(stage: StageId) {
    const es = this.s.log.filter((l) => l.stage === stage);
    if (!es.length) return null;
    const best = [...es].sort((a, b) => b.priority - a.priority || b.impact - a.impact)[0];
    return { stage, eventId: best.eventId, stageName: STAGE_NAMES[stage], caption: best.caption ?? best.title, title: best.title, choice: best.choice };
  }
  /** 依 endings.json 各條目的 condition 判定；依 condition.priority 由小到大，第一個符合者成立。 */
  judgeMountain(ms: Mountain[]): Mountain | undefined {
    const sorted = [...ms].sort((a, b) => (a.condition?.priority ?? 99) - (b.condition?.priority ?? 99));
    return sorted.find((m) => this.evalCond(m.condition)) ?? sorted[sorted.length - 1];
  }
  private evalCond(c: Mountain['condition']): boolean {
    if (!c) return false;
    if (c.fallback) return true;
    const test = ([k, v]: [string, number]) => {
      const m = /^(.*)_(min|max)$/.exec(k);
      if (!m) { this.s.notes.push(`無法解讀條件 ${k}`); return false; }
      const val = this.statOf(m[1]);
      return m[2] === 'min' ? val >= v : val <= v;
    };
    if (c.all && !Object.entries(c.all).every(test)) return false;
    if (c.any && !Object.entries(c.any).some(test)) return false;
    return !!(c.all || c.any);
  }
}

export function pickTier(tiers: { min: number; text: string }[], v: number): string {
  const t = [...tiers].sort((a, b) => b.min - a.min).find((x) => v >= x.min);
  return (t ?? tiers[0])?.text ?? '';
}
export function fillVars(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
