import type { Balance } from './balance';
import { makeRng, type Rng } from './rng';
import {
  STATS, STAT_NAMES, STAGE_NAMES, type StatId, type StageId, type GameData, type GameEvent,
  type Requires, type County, type Choice, type Mountain,
} from './types';

// ---------- 常數（對應 core-loop.md v0.2） ----------
export type ActionId = 'study' | 'cram' | 'play' | 'socialize' | 'exercise' | 'talent' | 'work' | 'rest';
export interface ActionDef { id: ActionId; name: string; from: StageId; desc: string }
const ACTION_NAMES: Record<string, string> = {
  study: '讀書', cram: '補習', play: '玩樂', socialize: '陪家人/交朋友', exercise: '運動', talent: '才藝', work: '打工', rest: '躺平',
};
/** 行動清單由 balance.json 產生（名稱為 UI 文字） */
export function actionDefs(b: Balance): ActionDef[] {
  return Object.entries(b.actions).map(([id, a]) => ({
    id: id as ActionId, name: ACTION_NAMES[id] ?? id, from: a.from,
    desc: Object.entries(a.effects).map(([k, v]) => `${STAT_NAMES[k as StatId] ?? k}${v > 0 ? '+' : ''}${v}`).join(' '),
  }));
}
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
    return this.actions.filter((a) => STAGE_ORDER.indexOf(a.from) <= idx);
  }
  /** 行動是否可用（§3 wealth≤0 鎖付費、§4 條件） */
  actionLock(a: ActionId, wealth = this.s.stats.wealth): string | null {
    const need = this.b.actions[a]?.requires_wealth;
    if (need === undefined) return null;
    const cost = -(this.actionEffects(a).wealth ?? 0);
    const min = Math.max(need, cost);
    return wealth < min ? `需要家庭資源 ≥ ${Math.ceil(min)}` : null;
  }
  /** 行動實際效果（補習費依縣市倍率縮放） */
  actionEffects(a: ActionId): Record<string, number> {
    const ab = this.b.actions[a]; const eff = { ...ab.effects };
    if (ab.wealth_scaled_by === 'cram_cost_mult' && eff.wealth) eff.wealth = Math.round(eff.wealth * this.s.county.cram_cost_mult);
    return eff;
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
    else { this.consumeApModifiers(); this.nextEvent(); }
  }
  private consumeApModifiers() { this.s.apPenalty = 0; this.s.apZero = false; }

  // ----- §4 行動 -----
  /** alloc: 行動 -> 點數。依序逐點結算；付費行動在資源不足時該點作廢（UI 應避免）。 */
  applyActions(alloc: Partial<Record<ActionId, number>>) {
    if (this.s.phase !== 'ap') throw new Error('not in ap phase');
    const total = Object.values(alloc).reduce((a, b) => a + (b ?? 0), 0);
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
    for (const [k, v] of Object.entries(req.stats_min ?? {})) if (this.statOf(k) < (v ?? 0)) return false;
    for (const [k, v] of Object.entries(req.stats_max ?? {})) if (this.statOf(k) > (v ?? 100)) return false;
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
  choiceLocked(c: Choice): boolean { return !this.meets(c.requires); }

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
    this.mod(c.effects ?? {});
    this.s.effort += c.hidden?.effort ?? 0;
    this.s.regret += c.hidden?.regret ?? 0;
    for (const fl of c.set_flags ?? []) this.s.flags.add(fl);
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
    if (this.s.stats.stress >= F.breakdown_stress_min) {
      const ev = this.data.events.find((e) => e.type === 'forced' && /breakdown|collapse/.test(e.id));
      this.s.breakdowns++; this.s.apPenalty = F.breakdown_ap_penalty;
      if (ev) forced.push({ event: ev, forced: 'breakdown' }); else this.mod(F.breakdown_effects);
    }
    if (this.s.stats.health <= F.sick_health_max) {
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
    if (st.happiness >= E.ordinary_good.happiness_min && st.social >= E.ordinary_good.social_min) return 'ordinary_good';
    return 'still_trying';
  }
  ending() {
    const id = this.endingId();
    const e = this.data.endings.endings.find((x) => x.id === id) ?? this.data.endings.endings[this.data.endings.endings.length - 1];
    const high = this.s.regret >= this.b.endings.regret_high_threshold;
    return { id, title: this.t(e.title), text: this.t(high ? e.regret_high : e.regret_low), regretHigh: high };
  }

  // ----- 人生回顧 -----
  review() {
    const r = this.data.endings.review;
    const vars = { effort: this.s.effort, regret: this.s.regret };
    const album = STAGE_ORDER.map((st) => this.albumFor(st)).filter((x): x is NonNullable<typeof x> => !!x);
    return {
      album,
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
