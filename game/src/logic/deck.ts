// v1.0 人生手牌雛形（國中三年）引擎。規格：design/v1.0-deck-prototype.md；數值：data/deck/*.json
import { Game } from './engine';
import { makeRng, type Rng } from './rng';
import { STATS, type GameData, type StatId } from './types';
import { buildEraSchedule, eraSlots, ym, overlay, resolveEraCards, scheduleReviewOnly, systemRulesFor, type ChildhoodData, type EraData, type EraSlot, type EraResolved, type Tier, type MemoryCard, type Timeline, type V12Config, type Window, type TextVariant, pickVariantField } from './v12';
import { plainName } from './names';

export type CardType = 'action' | 'burden' | 'growth' | 'forced' | 'era' | 'break';
export interface CardDef {
  id: string; name: string; type: CardType; cost: number | null; age_min: number; age_max: number; expires_age: number | null;
  line: string; effects: Partial<Record<StatId, number>>; tags?: string[]; adds?: string[]; removes?: string[]; clears?: string[];
  requires_wealth?: number; result_event?: string; result_text?: string; echo?: { age: number; text: string };
  in_hand?: { academic_play_stress?: number; stress_at_least?: number; burden_cost_minus?: number }; unplayed_end?: Partial<Record<StatId, number>>;
  growth_per_play?: number; slot_cost?: number; once_in_deck?: boolean; held_per_year?: Record<string, number>;
  /** 打牌花的錢算投資，不扣變化分數（§5.2-1） */ invest?: boolean;
  max_in_deck?: number; grant_after?: { count: number; flag?: string; adds?: string[] };
  weight_quintile?: Record<string, number>; weight_if_played?: Record<string, number>;
  /** 有這個 flag 時抽中權重乘上倍率，可多個相乘（例：{"living_home": 1.3}） */ weight_if_flags?: Record<string, number>;
  album_text?: string; regret_text?: string; accent?: string;
  /** 選校後的路線 flag（hs_general／hs_vocational／hs_5yr）才抽得到 */ requires_track?: string | string[];
  /** 牌庫（任一疊）裡有其中一張才能打（§9 b_judged：有 g_skill） */ requires_in_deck?: string[];
  /** 打滿 n 次後移出牌庫（§9 b_track_regret） */ remove_after?: number;
  /** 同一年打第 2 次時洗入（§11 s_skip→b_comfort） */ adds_if_twice_in_year?: string[];
  /** 不過期；整局都沒打過，局末記進沒走的路（§11 誘惑牌） */ missed_if_never_played?: boolean;
  /** 要先打過其中任一張才能打（別人的眼光：一技之長暫代） */ requires_played?: string[];
  /** 有其中任一個 flag 才抽得到（例：b_rent 只給搬出家裡的人） */ flags_any?: string[];
  /** 沒有自己的圖時借用這張牌的圖（成人牌暫借） */ icon?: string;
  /** 第 2 次以後改用這組效果（§5.2-4 遞減） */ repeat_effects?: Partial<Record<StatId, number>>;
  // ----- v1.2（design/v1.2-spec.md；欄位只在 v1.2 打開時有作用） -----
  /** 有其中任一個 flag 就抽不到 */ flags_none?: string[];
  /** 民國年條件：出生年＋年齡 */ roc_year_min?: number; roc_year_max?: number;
  /** §2.1 包袱留在手上 */ sticky?: boolean; burden_class?: 'expectation' | 'money' | 'habit' | 'body' | 'mind'; on_handle?: 'remove' | 'discard' | 'return'; returns_after?: number;
  held_per_turn?: Partial<Record<StatId, number>>; removed_by?: { cards_any?: string[]; tags_any?: string[]; flags_any?: string[]; count?: number }; trigger_after?: number | null; trigger_card?: string;
  /** §3.5 冷卻 */ cooldown?: number; cooldown_group?: string;
  /** §3.2 只在這一回合有效的臨時牌 */ temp?: boolean;
  /** §1.6 到某個年紀換成另一張牌（{"16": "s_club"}） */ transforms_at_age?: Record<string, string>;
  /** §3.3 一學年打滿 n 次洗入 */ adds_if_n_in_year?: { n: number; adds: string[] };
  /** 文字還沒寫（TODO-writer）；回音牌在文字進來前不進牌庫 */ todo_writer?: boolean; echo_card?: boolean;
  /** 文字版本（by_flag／by_track／by_age／by_birth_year／by_county_tag，可疊加；優先序見 v12.ts pickVariantField） */ variants?: TextVariant[];
  /** 包袱每回合結束晃一下時的旁白 */ held_text?: string; /** 詳情頁用的完整牌名（牌面放不下時） */ detail_name?: string;
  /** 每個 flag 都要有 */ flags_all?: string[]; /** 只在這幾個年齡（寒暑假牌） */ ages?: number[];
  /** 童年回音：選最多次的類別（child_top_<類別>）洗入的牌打過幾次 */ child_top_plays?: { min?: number; max?: number };
  /** 分流後的變化分數增量：positive（> 0）／non_positive（≤ 0） */ post_split_gain?: 'positive' | 'non_positive';
  /** 手上有／沒有其中任一張 */ in_hand_any?: string[]; in_hand_none?: string[];
  /** 屬性門檻（抽／放進手牌那一刻的值）：stats_min 每項 ≥、stats_max 每項 ≤（新回音牌苦暖用人際分） */ stats_min?: Partial<Record<StatId, number>>; stats_max?: Partial<Record<StatId, number>>;
  /** 第二組「任一」旗標：和 flags_any 同時成立才抽得到（新回音牌：觸發用 flags_any、苦暖區分用這欄） */ flags_any_also?: string[];
  /** 回音上限組：同組每局最多 v12.echo_caps[組] 張 */ echo_cap_group?: string; /** 抽中權重倍率（預設 1） */ draw_weight?: number;
  /** 寒暑假：符合條件時一定在選項裡 */ break_force?: boolean;
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
  /** 18→22 骨架（design/v1.0-adult-branch-skeleton.md）；enabled=false 時整局照舊在 18 歲結束 */ adult_branch?: AdultBranch;
  passive: { _note?: string; max_plays_per_year: number; max_plays_per_turn?: number; endings: { quintiles: number[]; text: string }[] };
  /** v1.2 規則（data/deck/v12.json，由呼叫端放進來；enabled=false 或沒有時照 v1.1） */ v12?: V12Config;
}
export interface SchoolOption { name: string; result: string; academic_min?: boolean; adds: string[]; adds_at_age?: Record<string, string[]> }
export interface SchoolChoice { age: number; general_academic_min: number | null; hint_under: string; options: Record<string, SchoolOption>;
  sim_policy: { general_if_eligible: number; five_year: number } }
export interface BranchOption { name: string; result: string; not_taken?: string; requires_track?: string[]; academic_min?: number; /** 路線別門檻：表內的路線視同 requires_track 允許，門檻用表內值（v1.2） */ academic_min_by_track?: Record<string, number>; adds?: string[]; loan?: boolean; enabled?: boolean }
export interface BranchDef { age: number; from_tracks: string[]; options: Record<string, BranchOption> }
export interface AdultBranch {
  enabled: boolean; ages: number[]; summer_stress_mult?: number; carry_age_max: { ids: string[]; to: number }; shared_adds: string[];
  branch: BranchDef; branch_jc: BranchDef;
  loan: { card: string; by_quintile: Record<string, number>; private_below: number; private_mult: number; public_mult: number };
  sim_policy: { uni: number; tech: number; /** 假玩家：可以繼續升學、卻選出社會的機率（依選校路線；沒寫的路線用 BOT_WORK_IF_ELIGIBLE） */ work_choice_by_track?: Record<string, number | string> }; route_names: Record<string, string>;
  /** 分流後的住處選擇（資料驅動；文字草稿、數值由企劃定） */
  housing?: { title: string; draft?: boolean; options: Record<string, { name: string; result: string; flag?: string; effects?: Partial<Record<StatId, number>> }>; sim_move_out?: number };
  adult_overrides?: Record<string, { name?: string; line?: string; result_text?: string; album_text?: string }>;
  endings: { burnout_sick_count: number; high_academic: number; savings_wealth_gain: number; against_odds_score: number; dreamer_happiness_gain: number };
}
export interface Inst { uid: number; id: string; /** v1.2：童年回憶卡 id（序章洗入的牌） */ origin?: string; /** v1.2：爆牌這類只活一回合的實例 */ ephemeral?: boolean }
export interface Missed { id: string; name: string; age: number; echo?: { age: number; text: string } }
export interface PlayResult { card: CardDef; text: string; eventId?: string; deltas: Partial<Record<StatId, number>>; sick?: { text: string; eventId?: string } }
export interface CardVariant { name?: string | null; line?: string | null; icons?: string[]; result_text?: string | null; album_text?: string | null; regret_text?: string | null }
export interface EraCardVariants { by_birth_year: { from: number; to: number; label?: string; cards: Record<string, CardVariant> }[]; opening_lines?: { by_birth_year: { from: number; to: number; text: string }[] } }
export type DeckPhase = 'talent' | 'prologue' | 'prologueSummary' | 'break' | 'choice' | 'branch' | 'housing' | 'play' | 'yearEnd' | 'review';

const trackOk = (req: string | string[] | undefined, t: string | null | undefined) => !req || (!!t && (Array.isArray(req) ? req.includes(t) : req === t));
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** 成就條目（data/achievements.json）。v12 子物件（name／desc／conditions）是 v1.2 卡牌模式的覆寫，只在 v1.2 套用（判定和顯示都是）；舊模式（v1.1 卡牌、經典玩法）忽略，照原本欄位 */
export type AchDef = { id: string; name?: string; desc?: string; conditions?: Record<string, unknown>; v12?: { name?: string; desc?: string; conditions?: Record<string, unknown> } };
/** 依模式取成就條目：v1.2 有 v12 覆寫就蓋上去（conditions 整組取代，不合併） */
export function achForMode<T extends AchDef>(a: T, v12: boolean): T { return v12 && a.v12 ? { ...a, ...a.v12 } : a; }
export class DeckGame {
  rng: Rng; base: Game; cards: Map<string, CardDef>;
  stats: Record<StatId, number>; start: Record<StatId, number>;
  talent: Record<string, number> = {};
  draw: Inst[] = []; discard: Inst[] = []; hand: Inst[] = []; removed: Inst[] = [];
  ageIdx = 0; slotsLeft = 0; sickThisYear = false; sickCount = 0; phase: DeckPhase = 'talent';
  playedThisYear: Inst[] = []; playCount: Record<string, number> = {}; tags: Record<string, number> = {};
  missed: Missed[] = []; flags = new Set<string>(); everPlayed = new Set<string>();
  yearNotes: string[] = []; log: { age: number; term?: number; played: string[] }[] = [];
  private uid = 0; investSpent = 0; track: string | null = null; /** 選校路線（分流後 track 會換成分流路線，這裡留著高中職那條） */ schoolTrack: string | null = null; sickAges: number[] = [];
  /** 18→22 開關（config adult_branch.enabled，或建構時 opts.adult 覆寫） */ adult = false; ages: number[];
  /** 18 歲後的路線 flag：uni／uni_tech／work_first（兵役留空） */ route: string | null = null;
  /** 分流沒選的路（每局最多 1 條，不算進遺憾比例） */ branchNotTaken: { key: string; name: string; text?: string } | null = null;
  hasLoan = false;
  /** 分流時沒選的全部選項（當時選得到的）顯示名稱；{branch_not_taken} 用「或」串起來 */ branchNotTakenAll: string[] = [];
  /** 分流那一刻的變化分數（deckcheck 分路線比較 19 歲起的增量） */ scoreAtSplit: number | null = null; housing: string | null = null;
  // ----- v1.2 -----
  v12: V12Config | null = null; /** 一年幾回合 */ tpy = 1; /** 這一學年的第幾回合（0＝上學期） */ term: 0 | 1 = 0; turnsDone = 0; scale = 1;
  /** §3.3 小數累積器：縮放後的效果累積到 ±1 才實際加減 */ statFrac: Record<string, number> = {};
  timeline?: Timeline; eraData?: EraData; era: EraResolved[] = []; eraSlotList: EraSlot[] = [];
  /** era-cards §0.2：開局排好的整局時代牌（槽位 key → 牌 id）；存檔要存這份 */ eraSchedule: Record<string, string[]> = {}; eraReviewSchedule: Record<string, string[]> = {};
  eraLost: string[] = []; /** UI：上一回合結束後到這一回合翻開的時代牌（含暑假） */ eraRecent: string[] = []; turnFlags: string[] = []; playNoted = new Set<string>(); eraTier: Record<string, Tier> = {}; eraSeen = new Set<string>(); eraRevSeen: string[] = [];
  /** 這一回合（或這一幕、這個暑假）翻開的時代牌 */ eraThisTurn: string[] = []; eraLog: { id: string; slot: string; age: number; term: number | null; prologue: boolean }[] = [];
  childhood: ChildhoodData | null = null; actIdx = 0; offer: MemoryCard[] = []; memories: MemoryCard[] = []; childCount: Record<string, number> = {};
  /** 資料引用了但牌表裡沒有的牌 */ missingCards = new Set<string>();
  heldTurns = new Map<number, number>(); removedProgress = new Map<number, number>(); cooldown: { inst: Inst; left: number }[] = [];
  fuseLog: { burden: string; card: string; age: number }[] = []; burdenLeft: Record<string, number> = {}; familyFlags: string[] = [];
  scene: { id: string; name: string; text?: string } | null = null; breakKind: 'winter' | 'summer' | null = null; breakOffer: string[] = []; breakCooldown: Record<string, number> = {};
  private echoCheck: number | null = null;
  /** 回音上限組已放幾張；回音放進手牌的紀錄（deckcheck 用） */ echoCapCount: Record<string, number> = {}; echoLog: { id: string; age: number; term: number; social: number }[] = [];
  /** 回合結束時發生、在下一回合開頭顯示的旁白 */ pendingNotes: string[] = []; /** 這回合因為包袱或回合結束晃一下的包袱 id（UI 演出） */ shaken: string[] = [];
  /** deckcheck 統計 */ stat12 = { dealt: 0, stuck: 0, stuckStreak: 0, maxStuckStreak: 0, fullSticky: 0, handleSlots: 0, heldLoss: 0, fuseLoss: 0, maxSticky: 0, clubJrAfter16: 0,
    /** 企劃定案 Q7/Q8/Q9 的驗收計數 */ evictions: 0, evictExpect: 0, evictNotOldest: 0, fuseShared: 0, fuseHeldBack: 0, expectDiscarded: 0, echoPlaced: 0, echoOverflow: 0, expectNewAfter19: 0, famNewAfter19: 0 };
  private isExpect(i: Inst) { const c = this.card(i); return !!c.sticky && c.burden_class === 'expectation'; }
  /** 進手牌的順序（「最舊」＝最早進手牌，企劃定案第二批 (b)） */ handEntry = new Map<number, number>(); private entrySeq = 0;
  /** deckcheck：擠牌紀錄（被擠的、當時可擠的候選） */ evictLog: { out: number; cands: number[] }[] = [];
  /** Q6：拿到時已經有 hs_* 的期待類包袱，留到下一個升學節點（分流）才離開 */ deferFlagLeave = new Set<number>();
  private yearPlays: string[] = []; private seed: number; private prng: Rng;

  constructor(public data: GameData, public cfg: DeckConfig, cardList: CardDef[], seed = Math.floor(Math.random() * 2 ** 31), public eraVariants?: EraCardVariants,
    opts: { adult?: boolean; v12?: boolean; childhood?: ChildhoodData; era?: EraData; timeline?: Timeline; birthYear?: number; prologue?: 'play' | 'skip'; scenes?: Record<string, any> } = {}) {
    this.base = new Game(data, seed, { birthYear: opts.birthYear }); // 沿用原本開局：縣市、出生年、家境五分位、初始屬性
    this.rng = makeRng(seed ^ 0x5bd1e995); this.seed = seed; this.prng = makeRng(seed ^ 0x6c1d);
    const v12 = cfg.v12 && (opts.v12 ?? cfg.v12.enabled) ? cfg.v12 : null;
    if (v12) { this.cfg = cfg = overlay(cfg, v12.config_overrides); cardList = cardList.filter((c) => !(c.todo_writer && c.echo_card)).map((c) => overlay(c, v12.card_overrides?.[c.id] as any)); }
    this.cards = new Map(cardList.map((c) => [c.id, c]));
    const ab = cfg.adult_branch; this.adult = !!ab && (opts.adult ?? v12?.adult ?? ab.enabled);
    this.ages = this.adult ? [...cfg.ages, ...ab!.ages] : cfg.ages;
    if (this.adult) for (const id of ab!.carry_age_max.ids) { const c = this.cards.get(id); if (c) this.cards.set(id, { ...c, age_max: Math.max(c.age_max, ab!.carry_age_max.to) }); }
    this.stats = { ...this.base.s.stats }; this.start = { ...this.stats };
    const q = String(this.base.s.quintile);
    for (const id of [...cfg.start_deck.common, ...(cfg.start_deck.by_quintile[q] ?? [])]) this.draw.push(this.mk(id));
    const ft = cfg.forced.f_teacher; const tagged = this.base.s.county.event_tags.some((t) => ft.county_tags_any.includes(t));
    if (this.rng.next() < (tagged ? ft.tag_chance : ft.base_chance)) this.draw.push(this.mk('f_teacher'));
    for (const k of Object.keys(cfg.talent?.options ?? {})) this.talent[k] = 0;
    if (v12) this.initV12(v12, opts);
  }
  private initV12(v: V12Config, opts: { childhood?: ChildhoodData; era?: EraData; timeline?: Timeline; prologue?: 'play' | 'skip'; scenes?: Record<string, any> }) {
    this.v12 = v; this.tpy = Math.max(1, v.turns_per_year); this.scale = v.per_turn_scale ?? 1; this.timeline = opts.timeline; this.scenesText = opts.scenes;
    for (const id of v.start_adds ?? []) this.push(this.draw, id);
    this.eraData = opts.era; this.era = resolveEraCards(opts.era?.cards ?? [], opts.timeline).cards;
    for (const e of this.era) this.cards.set(e.id, { id: e.id, name: e.name, accent: e.accent, type: 'era', cost: null, age_min: 0, age_max: 99, expires_age: null, line: e.line, effects: e.effects ?? {},
      result_text: e.result_text, album_text: e.album_text, icon: e.icon, variants: e.variants });
    // era-cards §6：system_rules 對到旗標（依出生年；有分位條件的看分位）
    for (const r of opts.era?.rules ?? []) if (r.game_effect !== 'deferred_v13' && r.flag && r.applies_to_birth_roc_years.includes(this.birthYear) && (!r.quintiles || r.quintiles.includes(this.quintile))) this.flags.add(r.flag);
    // §2.5 家庭處境旗標（獨立亂數，不影響出牌亂數）
    const fr = makeRng(this.seed ^ 0xfa1); const q = String(this.quintile);
    for (const [f, d] of Object.entries(v.family_situations ?? {})) { if (f.startsWith('_')) continue; if (fr.next() < (d.chance_by_quintile[q] ?? 0)) { this.flags.add(f); this.familyFlags.push(f); for (const id of d.adds ?? []) this.push(this.draw, id); } }
    const playPrologue = !!opts.childhood?.memories.length && opts.prologue !== 'skip';
    this.buildEra(playPrologue ? opts.childhood! : null);
    if (playPrologue) { this.childhood = opts.childhood!; this.phase = 'prologue'; this.startAct(); }
    else { this.phase = 'play'; this.beginYear(); }
  }
  /** 出生年適用的制度變動（timeline system_rules；只查詢） */
  systemRules() { return systemRulesFor(this.timeline, this.base.s.birthYear); }
  /** 代入 {變數}（era_terms.json by_birth_year、縣市等，和舊玩法共用 Game.textVars）；未知變數保留原樣 */
  fill(str: string | undefined | null): string {
    if (!str) return ''; const vars: Record<string, string | number> = { ...this.base.textVars(), city: this.base.s.county.name, branch_not_taken: this.branchNotTakenAll.join('或') };
    return str.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  }
  get birthYear() { return this.base.s.birthYear; }
  /** 回合名稱（上學期／下學期；出社會：上半年／下半年；一年一回合時空字串） */
  termName() { if (this.tpy <= 1 || !this.v12) return ''; const n = this.v12.term_names; const w = this.route === 'work_first';
    return this.term === 0 ? (w ? n.work_fall ?? n.fall : n.fall) : (w ? n.work_spring ?? n.spring : n.spring); }
  /** 加 flag（v1.2：同時檢查手上包袱的 removed_by.flags_any） */
  /** v1.2 play flag stress_peak：壓力到病倒門檻（config.stress_peak_at，沒寫＝forced.f_sick.stress_at_least）或病倒時設，給 ach_burnout 用 */
  stressPeakAt() { return (this.cfg as { stress_peak_at?: number }).stress_peak_at ?? this.cfg.forced.f_sick.stress_at_least; }
  addFlag(f: string) { this.flags.add(f); if (this.v12) { this.checkFlagRemovals(); this.checkPlayFlags(); } }
  /** v12.play_flags：旗標或打過的牌 → 加旗標 */
  private checkPlayFlags(played?: string) { for (const [f, d] of Object.entries(this.v12?.play_flags ?? {})) { if (f.startsWith('_') || this.flags.has(f)) continue;
    if ((played && (d.cards?.includes(played) || d.prefix?.some((p) => played.startsWith(p)))) || d.flags_any?.some((x) => this.flags.has(x))) this.addFlag(f); } }
  /** era rules 的 turn_flag（基本工資：凍漲／調漲），依這個回合的月份 */
  private setRuleTurnFlags() { const w = this.eraSlotList.find((x) => x.key === this.slotKey())?.win; if (!w) return;
    for (const r of this.eraData?.rules ?? []) if (r.game_effect === 'turn_flag' && r.before && r.applies_to_birth_roc_years.includes(this.birthYear)) {
      const before = w.to < ym(r.before); for (const f of [r.flag_before, r.flag_after]) if (f) this.flags.delete(f); const f = before ? r.flag_before : r.flag_after; if (f) this.flags.add(f); } }
  /** 成就（data/achievements.json）：卡牌模式看旗標條件 flags_all／flags_any／flags_none 和結局 ending（endingId，成人段才有）；有其他條件的成就回傳在 unsupported，不算達成 */
  achievementsMet(list: AchDef[]): { met: string[]; unsupported: string[] } {
    const met: string[] = [], unsupported: string[] = [];
    for (const a0 of list) { const a = achForMode(a0, !!this.v12); const c = (a.conditions ?? {}) as { flags_all?: string[]; flags_any?: string[]; flags_none?: string[]; ending?: string };
      if (Object.keys(c).some((k) => !['flags_all', 'flags_any', 'flags_none', 'ending'].includes(k))) { unsupported.push(a.id); continue; }
      if (c.ending && this.endingId() !== c.ending) continue;
      if ((c.flags_all ?? []).every((f) => this.flags.has(f)) && (!c.flags_any?.length || c.flags_any.some((f) => this.flags.has(f))) && !(c.flags_none ?? []).some((f) => this.flags.has(f))) met.push(a.id); }
    return { met, unsupported }; }
  /** 序章時代牌的後果句 */
  eraConsequence(id: string): string | undefined { const e = this.era.find((x) => x.id === id); const t = e?.variants ? pickVariantField(e.variants, 'consequence', this.variantCtx(id)) : undefined; return t ? this.fill(t) : undefined; }
  /** 選校畫面的學費句（system_rules：114 萬／148 萬；文字在 scenes.json school_choice_text） */
  choiceNote(key: string): string | undefined { const t = this.scenesText?.school_choice_text as Record<string, string> | undefined; if (!t) return undefined;
    const voc = key === 'hs_vocational', five = key === 'hs_5yr', gen = key === 'hs_general';
    if (this.flags.has('tuition_148w')) return voc || (gen && this.quintile <= 4) ? t.tuition_148 : undefined;
    if (this.flags.has('tuition_114w')) { if (!(voc || five)) return undefined;
      const only = this.eraData?.rules?.find((r) => r.flag === 'tuition_114w')?.choice_text_birth_roc_years;
      return !only || only.includes(this.birthYear) ? t.tuition_114_vocational : t.tuition_neutral; }
    return undefined; }
  private push(pile: Inst[], id: string, origin?: string) { if (!this.cards.has(id)) { this.missingCards.add(id); return null; } const i = this.mk(id); if (origin) i.origin = origin; pile.push(i); return i; }
  /** 開場句：依出生年換掉「民國 xx 年，你在…出生。」那一句（畫面不顯示年份），其餘家境句照舊 */
  openingText(): string {
    const by = this.base.s.birthYear; const base = this.base.openingText();
    const line = this.eraVariants?.opening_lines?.by_birth_year.find((x) => by >= x.from && by <= x.to)?.text;
    const rest = base.replace(/^[^。]*出生。/, '');
    return line ? line.split('{city}').join(this.base.s.county.name) + rest : rest;
  }
  /** 依出生年換牌面（era_terms.json deck_card_variants）；回傳顯示用名稱、一句話、圖示候選 id */
  /** name 已去掉 U+200B（詳情、回顧、筆記、比對都用這個）；nameBrk 保留 U+200B，只給 v1.2 手牌牌名斷行用 */
  view(id: string): { name: string; nameBrk: string; line: string; icons: string[] } {
    const c = this.cards.get(id)!; const by = this.base.s.birthYear;
    const v = this.eraVariants?.by_birth_year.find((x) => by >= x.from && by <= x.to)?.cards[id];
    const o = this.adultOv(id) ?? this.eraText(id); const tv = (f: 'name' | 'line') => pickVariantField(c.variants, f, this.variantCtx());
    const nameBrk = this.fill(o?.name ?? tv('name') ?? v?.name ?? c.name);
    return { name: plainName(nameBrk), nameBrk, line: this.fill(o?.line ?? tv('line') ?? v?.line ?? c.line), icons: v?.icons?.length ? v.icons : c.icon ? [id, c.icon] : [id] };
  }
  /** 依出生年取文字欄位（變體沒填就用 cards.json） */
  text(id: string, f: 'result_text' | 'album_text' | 'regret_text'): string | undefined {
    const c = this.cards.get(id)!; const by = this.base.s.birthYear;
    const v = this.eraVariants?.by_birth_year.find((x) => by >= x.from && by <= x.to)?.cards[id];
    const o = (this.adultOv(id) ?? this.eraText(id)) as any;
    const t = o?.[f] ?? pickVariantField(c.variants, f, this.variantCtx()) ?? v?.[f] ?? c[f]; return t === undefined || t === null ? undefined : this.fill(t);
  }
  /** 文字版本選擇用的情境 */
  variantCtx(id?: string) { const l = id ? this.eraLog.find((x) => x.id === id) : undefined;
    return { flags: this.flags, track: this.track, route: this.route, schoolTrack: this.schoolTrack, age: this.phase === 'prologue' ? this.childAge : this.age, birthYear: this.birthYear, countyTags: this.base.s.county.event_tags,
      tier: id ? this.eraTier[id] : undefined, term: l?.term ?? undefined, quintile: this.quintile, prologue: l?.prologue,
      roll: id ? makeRng((this.seed ^ [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7)) >>> 0).next() : 0 }; }
  /** 時代牌文字版本（by_tier／by_term／by_quintile／by_prologue） */
  private eraText(id: string) { const e = this.era.find((x) => x.id === id); if (!e?.variants) return undefined; const ctx = this.variantCtx(id);
    return { name: pickVariantField(e.variants, 'name', ctx), line: pickVariantField(e.variants, 'line', ctx), result_text: pickVariantField(e.variants, 'result_text', ctx), album_text: pickVariantField(e.variants, 'album_text', ctx) }; }
  private adultOv(id: string) { return this.adult && this.age >= 19 ? this.cfg.adult_branch!.adult_overrides?.[id] : undefined; }
  get quintile() { return this.base.s.quintile; }
  get age() { return this.ages[this.ageIdx]; }
  card(i: Inst) { return this.cards.get(i.id)!; }
  private mk(id: string): Inst { if (!this.cards.has(id)) throw new Error(`未知牌 ${id}`); return { uid: ++this.uid, id }; }

  // ----- 天賦（原本的點數分配，開局一次） -----
  talentLeft() { return this.cfg.talent.points - Object.values(this.talent).reduce((a, b) => a + b, 0); }
  setTalent(alloc: Record<string, number>) { if (this.v12) throw new Error('v1.2 沒有天賦點數：用 pickMemory／startSchool'); this.talent = { ...this.talent, ...alloc }; this.phase = 'play'; this.beginYear(); }

  // ----- v1.2 童年序章（規格 §1：6、9、12 歲各翻 3 張不同類、選 1 張；資料 data/deck/childhood.json） -----
  get childAge() { return this.childhood?.ages[this.actIdx] ?? 0; }
  actLabel() { return this.childhood?.acts[String(this.childAge)]?.label ?? ''; }
  memoryWeight(m: MemoryCard) { const ch = this.childhood!; let w = ch.weight_levels[m.weight ?? 'equal']?.[String(this.quintile)] ?? 1;
    for (const [t, k] of Object.entries(m.weight_if_county_tags ?? {})) if (this.base.s.county.event_tags.includes(t)) w *= k; return w; }
  /** §1.2：先依類別平均權重不放回抽 draw 個不同類別，再在類別裡依權重抽 1 張（distinct_categories=false 時直接依權重抽） */
  private startAct() {
    this.offer = this.drawOffer(this.childAge); const ch = this.childhood!;
    this.flipEra(`act${this.childAge}`);
  }
  /** 抽一次某一幕的三張（不改狀態以外的東西；deckcheck 也直接呼叫來量比例） */
  drawOffer(age: number): MemoryCard[] {
    const ch = this.childhood!; const pool = ch.memories.filter((m) => m.act === age); const offer: MemoryCard[] = [];
    if (ch.distinct_categories) {
      const cats = [...new Set(pool.map((m) => m.category))];
      const W = (c: string) => { const xs = pool.filter((m) => m.category === c); return xs.reduce((a, m) => a + this.memoryWeight(m), 0) / xs.length; };
      while (offer.length < ch.draw && cats.length) { const c = this.prng.weighted(cats, W)!; cats.splice(cats.indexOf(c), 1);
        offer.push(this.prng.weighted(pool.filter((m) => m.category === c), (m) => this.memoryWeight(m))!); }
    } else while (offer.length < ch.draw) { const m = this.prng.weighted(pool.filter((x) => !offer.includes(x)), (x) => this.memoryWeight(x)); if (!m) break; offer.push(m); }
    return offer;
  }
  prologueOffer() { return this.offer; }
  topChildCategory(): string | null { if (!this.memories.length) return null; const max = Math.max(...Object.values(this.childCount));
    for (let k = this.memories.length - 1; k >= 0; k--) if (this.childCount[this.memories[k].category] === max) return this.memories[k].category; return null; }
  /** 童年各類別洗入的牌（origin）打過幾次 */ originPlays: Record<string, number> = {};
  /** 童年各類別實際洗入的牌 id（含 once_in_deck 退路） */ memAdded: Record<string, Set<string>> = {};
  /** 選一張回憶卡（null＝不選，只給模擬對照組）；opts.force：無視這幕翻出的牌直接套用（§1.7 fixed:<id>） */
  pickMemory(id: string | null, opts: { force?: boolean } = {}) {
    if (this.phase !== 'prologue') throw new Error('不在童年序章');
    const ch = this.childhood!; const m = id === null ? null : (opts.force ? ch.memories : this.offer).find((x) => x.id === id);
    if (id !== null && !m) throw new Error('不能選這張');
    if (m) { this.memories.push(m);
      for (const a of m.adds) { const d = this.cards.get(a); const all = [...this.draw, ...this.discard];
        const clash = d && ((d.once_in_deck && all.some((x) => x.id === a)) || (d.max_in_deck !== undefined && all.filter((x) => x.id === a).length >= d.max_in_deck));
        const id = clash ? ch.categories[m.category]?.fallback_add ?? a : a; this.push(this.draw, id, m.id); (this.memAdded[m.category] ??= new Set()).add(id); }
      this.childCount[m.category] = (this.childCount[m.category] ?? 0) + 1;
      this.flags.add(m.flag ?? m.id); this.flags.add(`child_${m.category}`); }
    this.actIdx++;
    if (this.actIdx >= ch.ages.length) { this.offer = []; this.eraThisTurn = [];
      for (const [c, n] of Object.entries(this.childCount)) if (n === ch.ages.length) this.flags.add(`child_${c}_all`);
      // 企劃 10/17：童年回音用選最多次的類別，平手取最後一幕選的
      const top = this.topChildCategory(); if (top) this.flags.add(`child_top_${top}`);
      this.phase = 'prologueSummary'; } else this.startAct();
  }
  /** 回憶卡顯示用文字（依出生年換版本、代入 {變數}） */
  memoryView(m: MemoryCard) { const v = m.by_birth_year?.find((x) => this.birthYear >= x.from && this.birthYear <= x.to);
    return { name: plainName(this.fill(v?.name ?? m.name)), situation: this.fill(v?.situation ?? m.situation), consequence: this.fill(v?.consequence ?? m.consequence),
      category: this.childhood?.categories[m.category]?.name ?? m.category, adds: m.adds.map((a) => this.cards.has(a) ? this.view(a).name : a) }; }
  /** 總結頁一句（三幕同類 all_same[類別]，否則 mixed；文字待劇情文案） */
  prologueSummary(): string { const s = this.childhood?.summary; const same = Object.entries(this.childCount).find(([, n]) => n === this.childhood!.ages.length)?.[0];
    return this.fill((same ? s?.all_same?.[same] : s?.mixed) ?? ''); }
  /** 從總結頁進入 13 歲上學期 */
  startSchool() { if (this.phase !== 'prologueSummary') throw new Error('不在序章總結'); this.pendingNotes = [];  this.eraRecent = []; this.phase = 'play'; this.beginYear(); }

  // ----- v1.2 時代牌（design/v1.2-era-cards.md）：開局排好整局；回合、暑假、序章各槽位照表翻開，不佔時間格、不佔手牌 -----
  private buildEra(ch: ChildhoodData | null) {
    if (!this.eraData) return; const nw = this.v12!.era.nationwide;
    this.eraSlotList = eraSlots(this.birthYear, this.ages, this.tpy, ch, this.eraData.prologue_capacity);
    const r = buildEraSchedule(this.era, this.birthYear, this.base.s.county.id, this.eraSlotList, nw);
    this.eraSchedule = r.schedule; this.eraLost = r.lost; this.eraTier = r.tiers; for (const id of r.lost) this.flags.add(`era_lost_${id}`);
    this.eraReviewSchedule = scheduleReviewOnly(this.eraData.review_only ?? [], this.base.s.county.id, this.eraSlotList, nw, this.birthYear);
  }
  /** 這一回合的槽位 key（13F／13S／13U／act6） */
  slotKey(kind: 'term' | 'summer' = 'term') { return kind === 'summer' ? `${this.age}U` : `${this.age}${this.tpy > 1 && this.term === 1 ? 'S' : 'F'}`; }
  /** 翻開某個槽位排到的時代牌：套用效果（序章只加旗標）、加 era_<id>、era_<id>_<tier> */
  private flipEra(slot: string, keep = false) {
    if (!keep) this.eraThisTurn = []; if (!this.v12 || !this.eraData) return; const prologue = slot.startsWith('act');
    for (const id of this.eraReviewSchedule[slot] ?? []) { this.flags.add(`era_rev_${id}`); this.eraRevSeen.push(id); }
    for (const id of this.eraSchedule[slot] ?? []) { const e = this.era.find((x) => x.id === id)!; const tier = this.eraTier[id];
      this.eraSeen.add(id); this.eraLog.push({ id, slot, age: prologue ? this.childAge : this.age, term: prologue || slot.endsWith('U') ? null : this.term, prologue });
      if (!prologue || e.prologue_effects) { const eff = { ...(e.effects ?? {}), ...(e.effects_by_tier?.[tier] ?? {}), ...(e.effects_by_quintile?.[String(this.quintile)] ?? {}) }; this.apply(eff); } // 不乘 per_turn_scale
      this.addFlag(e.flag ?? `era_${id.replace(/^era_/, '')}`); this.addFlag(`${e.flag ?? id}_${tier}`);
      for (const f of [...(e.sets_flags ?? []), ...(e.sets_flags_by_tier?.[tier] ?? []), ...(e.sets_flags_by_quintile?.[String(this.quintile)] ?? [])]) this.addFlag(f);
      for (const f of [...(e.turn_flags ?? []), ...(e.turn_flags_by_tier?.[tier] ?? [])]) if (!prologue && !this.flags.has(f)) { this.addFlag(f); this.turnFlags.push(f); }
      for (const r of e.rolls ?? []) if (r.quintiles.includes(this.quintile) && !this.flags.has(r.flag)) { const ch = (this.v12.family_situations?.[r.flag]?.chance_by_quintile[String(this.quintile)] ?? 0) * r.chance_mult;
        if (makeRng(this.seed ^ 0xe7a ^ id.length).next() < ch) { this.flags.add(r.flag); if (!this.familyFlags.includes(r.flag)) this.familyFlags.push(r.flag); } }
      this.eraThisTurn.push(id); this.eraRecent.push(id); this.pendingNotes.push(`${this.view(id).name}：${this.view(id).line}`); }
  }
  /** 回顧頁「那幾年」：先 era_lost，再回顧一行，依 priority，最多 review_max_lines 行（回傳 id） */
  eraReviewIds(): string[] { const d = this.eraData; if (!d) return []; const pr = (id: string) => (d.cards.find((c) => c.id === id)?.priority ?? d.review_only?.find((r) => r.id === id)?.priority ?? 0);
    return [...[...this.eraLost].sort((a, b) => pr(b) - pr(a)), ...[...this.eraRevSeen].sort((a, b) => pr(b) - pr(a))].slice(0, d.review_max_lines); }
  /** 回顧頁「那幾年」的句子（eraReviewIds 的 review_line） */
  eraReviewLines(): string[] { const d = this.eraData; if (!d) return [];
    return this.eraReviewIds().map((id) => d.cards.find((c) => c.id === id)?.review_line ?? d.review_only?.find((r) => r.id === id)?.review_line ?? '').filter(Boolean).map((t) => this.fill(t)); }
  /** 存檔用（v1.3 才做分槽；先把 v1.2 的狀態欄位定下來） */
  saveV12() { return { phase: this.phase, term: this.term, actIdx: this.actIdx, offer: this.offer.map((m) => m.id), memories: this.memories.map((m) => m.id), childCount: this.childCount,
    eraSchedule: this.eraSchedule, eraLost: this.eraLost, eraSeen: [...this.eraSeen], statFrac: this.statFrac, heldTurns: [...this.heldTurns], cooldown: this.cooldown.map((x) => ({ uid: x.inst.uid, id: x.inst.id, left: x.left })) }; }
  /** §3.2 這一回合的場景 */
  private pickScene() {
    const ts = this.v12?.term_scenes; if (!ts) return null; const termKey = this.term === 0 ? 'fall' : 'spring';
    const row = ts.table.find((r) => r.age === this.age && r.term === termKey && (!r.tracks || (this.track && r.tracks.includes(this.track))) && (!r.routes || (this.route && r.routes.includes(this.route))));
    const rd = this.route ? ts.route_default?.[this.route] : undefined;
    const id = row?.scene ?? (typeof rd === 'string' ? rd : rd?.[termKey]) ?? ts.default; const sc = ts.scenes[id]; if (!sc) return null;
    const ctx = this.variantCtx(); const t = this.scenesText?.[id];
    return { id, name: plainName(this.fill(pickVariantField(t?.variants, 'name', ctx) ?? t?.name ?? sc.name)), text: this.fill(pickVariantField(t?.variants, 'text', ctx) ?? t?.text ?? sc.text), sc };
  }
  /** 場景文字（data/deck/scenes.json） */ scenesText?: Record<string, { name?: string; text?: string; variants?: TextVariant[] }>;
  private drawWeight(id: string) {
    let w = 1; const c = this.cards.get(id)!;
    w *= c.weight_quintile?.[String(this.quintile)] ?? 1;
    for (const [p, m] of Object.entries(c.weight_if_played ?? {})) if (this.everPlayed.has(p)) w *= m;
    for (const [f, m] of Object.entries(c.weight_if_flags ?? {})) if (this.flags.has(f)) w *= m;
    if (!this.v12) for (const [k, o] of Object.entries(this.cfg.talent.options)) if (o.cards.includes(id)) w += (this.talent[k] ?? 0) * this.cfg.talent.per_point_weight;
    for (const f of this.familyFlags) w *= this.v12?.family_situations?.[f]?.weight_mult?.[id] ?? 1;
    if (c.draw_weight !== undefined) w *= c.draw_weight;
    return w;
  }
  private eligible(i: Inst) { const c = this.card(i); const y = this.birthYear + this.age;
    return this.age >= c.age_min && this.age <= c.age_max && (trackOk(c.requires_track, this.track) || trackOk(c.requires_track, this.route)) && (!c.flags_any?.length || c.flags_any.some((f) => this.flags.has(f)))
      && !c.flags_none?.some((f) => this.flags.has(f)) && (c.roc_year_min === undefined || y >= c.roc_year_min) && (c.roc_year_max === undefined || y <= c.roc_year_max)
      && (!this.v12 || this.v12Eligible(c)); }
  /** v1.2 追加的抽牌條件（回音牌等） */
  private v12Eligible(c: CardDef) {
    if (c.flags_all && !c.flags_all.every((f) => this.flags.has(f))) return false;
    if (c.ages && !c.ages.includes(this.age)) return false;
    if (c.child_top_plays) { const top = this.topChildCategory(); if (!top) return false; const n = [...(this.memAdded[top] ?? [])].reduce((a, id) => a + (this.playCount[id] ?? 0), 0); // 企劃定案第二批 (c)：同類回憶卡洗入的所有牌 id 的出牌次數加總（起始牌組同 id 也算）
      if (c.child_top_plays.min !== undefined && n < c.child_top_plays.min) return false; if (c.child_top_plays.max !== undefined && n > c.child_top_plays.max) return false; }
    if (c.post_split_gain) { if (this.scoreAtSplit === null) return false; const g = this.score() - this.scoreAtSplit; if (c.post_split_gain === 'positive' ? g <= 0 : g > 0) return false; }
    if (c.in_hand_any && !this.hand.some((h) => c.in_hand_any!.includes(h.id))) return false;
    if (c.in_hand_none && this.hand.some((h) => c.in_hand_none!.includes(h.id))) return false;
    if (c.flags_any_also?.length && !c.flags_any_also.some((f) => this.flags.has(f))) return false;
    for (const [k, v] of Object.entries(c.stats_min ?? {})) if (this.stats[k as StatId] < v!) return false;
    for (const [k, v] of Object.entries(c.stats_max ?? {})) if (this.stats[k as StatId] > v!) return false;
    if (c.echo_cap_group) { const cap = this.v12?.echo_caps?.[c.echo_cap_group]; if (typeof cap === 'number' && (this.echoCapCount[c.echo_cap_group] ?? 0) >= cap) return false;
    }
    { const fc = this.v12?.echo_from_card?.[c.id]; const fr = Array.isArray(fc) ? fc : c.echo_cap_group ? this.v12?.echo_cap_from?.[c.echo_cap_group] : undefined; // 單張 echo_from_card 優先，其次上限組 echo_cap_from
      if (Array.isArray(fr) && (this.age < fr[0] || (this.age === fr[0] && this.term < fr[1]))) return false; }
    if (c.echo_card && this.hand.some((h) => this.card(h).echo_card)) return false; // 一回合最多一張回音
    if (c.id === 'b_expect' && this.age >= 19) return false; // Q6：19 歲以後不再抽新的 b_expect（b_family_expect 19 歲起照常抽）
    return true;
  }

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
    this.track = key; this.schoolTrack = key; this.addFlag(key);
    for (const id of o.opt.adds) this.draw.push(this.mk(id));
    this.phase = 'play'; this.beginYear();
    this.yearNotes.unshift(`選校：${o.opt.result}`);
  }
  /** 學段名稱：依年齡（國中／高中；選校後高職、五專顯示路線名） */
  stageOf(age: number) { const st = this.schoolTrack; if (age >= 19 && this.route) return this.routeName(this.route); if (age >= 19 && !this.route && st !== 'hs_5yr') return '高中畢業';
    return age <= 15 ? '國中' : !st ? '國中畢業' : st !== 'hs_general' ? this.cfg.school_choice!.options[st].name : '高中'; }
  /** 整局範圍：國中／高中／國中到高中 */
  runStageLabel() { if (this.route) return `國中到${this.routeName(this.route)}`; const a = this.cfg.ages; const s0 = a[0] <= 15 ? '國中' : '高中'; const s1 = a[a.length - 1] <= 15 ? '國中' : '高中'; return s0 === s1 ? s0 : `${s0}到${s1}`; }

  // ----- 18→22 分流（骨架 §2）：19 歲第一回合開頭（普高、高職）／21 歲第一回合開頭（五專）；選了就算數 -----
  branchDef(): BranchDef | null {
    const ab = this.cfg.adult_branch; if (!this.adult || !ab || this.route || !this.track) return null;
    for (const b of [ab.branch, ab.branch_jc]) if (this.age === b.age && b.from_tracks.includes(this.track)) return b;
    return null;
  }
  routeName(key: string) { return this.cfg.adult_branch!.route_names[key] ?? key; }
  /** 可選的路；兵役（enabled=false）不列出。出社會一律可選 */
  branchOptions(): { key: string; opt: BranchOption; locked: string | null }[] {
    const b = this.branchDef(); if (!b) return [];
    // v1.2：academic_min_by_track 表內的路線也可選，門檻用表內值（例：高職上一般大學 35）；v1.1 照舊只看 requires_track／academic_min
    const byT = (o: BranchOption) => (this.v12 && this.track && o.academic_min_by_track ? o.academic_min_by_track[this.track] : undefined);
    const allowed = (o: BranchOption) => !o.requires_track || o.requires_track.includes(this.track!) || byT(o) !== undefined;
    const min = (o: BranchOption) => byT(o) ?? o.academic_min;
    return Object.entries(b.options).filter(([, o]) => o.enabled !== false).map(([key, opt]) => { const m = min(opt);
      return { key, opt, locked: !allowed(opt) || (m !== undefined && this.stats.academic < m) ? '這扇門這次沒有為你打開。' : null }; })
      .filter((o) => allowed(o.opt));
  }
  chooseBranch(key: string) {
    const all = this.branchOptions(); const o = all.find((x) => x.key === key);
    if (this.phase !== 'branch' || !o || o.locked) throw new Error('不能選這個');
    this.scoreAtSplit = this.score(); this.route = key;
    if (this.v12) this.track = key; // 企劃裁示：v1.2 分流後 track 換成分流路線（同回合的場景、by_track 文字、requires_track 都跟著走）；選校路線留在 schoolTrack
    for (const i of [...this.hand]) if (this.deferFlagLeave.has(i.uid)) this.leaveHand(i, 'node'); // Q6：升學節點
    this.addFlag(key);
    for (const id of o.opt.adds ?? []) this.draw.push(this.mk(id));
    const ab = this.cfg.adult_branch!;
    if (o.opt.loan) { const pri = this.stats.academic < ab.loan.private_below; const ch = (ab.loan.by_quintile[String(this.quintile)] ?? 0) * (pri ? ab.loan.private_mult : ab.loan.public_mult);
      if (this.rng.next() < ch) { this.hasLoan = true; this.flags.add('student_loan'); this.draw.push(this.mk(ab.loan.card)); } }
    // 沒走的路：沒選的、而且當時選得到的那條（每局最多 1 條；優先「出社會」以外的）
    const other = all.filter((x) => x.key !== key && !x.locked).sort((a, b) => (a.key === 'work_first' ? 1 : 0) - (b.key === 'work_first' ? 1 : 0))[0];
    if (other) this.branchNotTaken = { key: other.key, name: other.opt.name, text: other.opt.not_taken };
    this.branchNotTakenAll = all.filter((x) => x.key !== key && !x.locked).map((x) => x.opt.name); if (this.branchNotTakenAll.length) this.flags.add('branch_not_taken');
    if (ab.housing) { this.phase = 'housing'; this.branchNote = `${o.opt.name}：${o.opt.result}`; return; }
    this.phase = 'play'; this.beginYear();
    this.yearNotes.unshift(`${o.opt.name}：${o.opt.result}`);
  }
  private branchNote = '';
  housingOptions() { return Object.entries(this.cfg.adult_branch?.housing?.options ?? {}).map(([key, opt]) => ({ key, opt })); }
  /** 分流後接著選住處：flag（move_out 設 moved_out）＋效果（目前 0） */
  chooseHousing(key: string) {
    const o = this.cfg.adult_branch?.housing?.options[key];
    if (this.phase !== 'housing' || !o) throw new Error('不能選這個');
    this.housing = key; if (o.flag) this.addFlag(o.flag); if (o.effects) this.apply(o.effects);
    this.phase = 'play'; this.beginYear();
    this.yearNotes.unshift(`${o.name}：${o.result}`); this.yearNotes.unshift(this.branchNote);
  }
  /** 兵役：明確留空（骨架 §7，等 Jade）。之後在這裡插入役期回合 */
  militarySlot(): null { return null; }
  /** 22 歲結局（骨架 §4；接 data/endings.json 的 id）。判斷順序與門檻都是 config adult_branch.endings 的假設值 */
  endingId(): string | null {
    if (!this.adult || this.phase !== 'review') return null;
    const e = this.cfg.adult_branch!.endings; const d = this.deltas(); const q = this.quintile; const skill = this.everPlayed.has('g_skill') || this.everPlayed.has('voc_license') || this.everPlayed.has('tech_license') || this.everPlayed.has('work_apprentice');
    if (this.sickCount >= e.burnout_sick_count) return 'burnout';
    if (this.isPassive()) return q >= 4 ? 'blessed_carefree' : 'ordinary_good';
    const r = this.route;
    if (r === 'uni') { if (q >= 4 && this.stats.academic >= e.high_academic) return 'golden_cage'; if (this.hasLoan) return 'degree_bills';
      if (this.regretLevel() === 'high') return 'not_departed'; if (d.happiness >= e.dreamer_happiness_gain) return 'dreamer'; return 'ordinary_good'; }
    if (r === 'uni_tech') { if (this.hasLoan) return 'degree_bills'; if (q <= 2 && this.score() >= e.against_odds_score) return 'against_odds'; if (skill) return 'skilled_trade'; return 'still_trying'; }
    if (r === 'work_first') { if (d.wealth >= e.savings_wealth_gain) return 'savings'; if (q <= 2 && this.score() >= e.against_odds_score) return 'against_odds'; if (skill) return 'skilled_trade'; return 'still_trying'; }
    return 'still_trying';
  }

  // ----- 每年 -----
  /** 回合開頭（v1.1 一年一回合；v1.2 規格 §2.2：一學年 turns_per_year 回合，年齡轉換、選校、分流只在上學期） */
  private beginYear() {
    if (this.term === 0) {
      if (this.v12) this.transformAtAge(); // §1.6：選校之前、抽牌之前
      if (this.needsSchoolChoice()) { this.phase = 'choice'; return; }
      if (this.branchDef()) { this.phase = 'branch'; return; }
      if (this.adult && this.age === this.cfg.adult_branch!.ages[0] && !this.flags.has('adult_shared')) { this.flags.add('adult_shared'); for (const id of this.cfg.adult_branch!.shared_adds) this.draw.push(this.mk(id)); }
      const late = this.track ? this.cfg.school_choice?.options[this.track]?.adds_at_age?.[String(this.age)] : undefined;
      for (const id of late ?? []) this.draw.push(this.mk(id));
    }
    const fresh: Inst[] = [];
    if (!this.v12 || this.term === 0) this.sickThisYear = false; // v1.2：病倒每學年重設
    this.playedThisYear = []; this.yearNotes = []; this.shaken = [];
    if (this.v12) {
      this.flipEra(this.slotKey()); if (this.route === 'work_first' && this.term === 1) this.flipEra(this.slotKey('summer'), true); this.setRuleTurnFlags(); // 2. 時代牌（企劃定案 Q4：出社會路線的暑假槽位併入下半年回合；排程本身不看路線）
      const sc = this.pickScene(); this.scene = sc ? { id: sc.id, name: sc.name, text: sc.text } : null;  // 3. 場景
      if (sc) { if (sc.sc.effects) this.apply(sc.sc.effects); for (const id of sc.sc.adds_this_turn ?? []) { const i = this.push(this.hand, id); if (i) i.ephemeral = true; } }
      for (const r of [...this.cooldown]) if (--r.left <= 0) { this.cooldown.splice(this.cooldown.indexOf(r), 1); this.draw.push(r.inst); }  // 4. cooldown
      // 5. 爆（spec §2.2-5、企劃定案 Q8／裁示 3）：同一回合最多爆一張——heldTurns 最大的，平手取最早進手牌的。
      //    事件牌無視冷卻照樣放入；和它共用同一張事件牌、也到期的包袱一起歸零（只放一張）；事件牌不同的到期包袱 heldTurns 不變，下回合再判斷
      const ripe = this.hand.filter((i) => { const c = this.card(i); return c.sticky && c.trigger_after && (this.heldTurns.get(i.uid) ?? 0) >= c.trigger_after; })
        .sort((a, b) => (this.heldTurns.get(b.uid) ?? 0) - (this.heldTurns.get(a.uid) ?? 0) || (this.handEntry.get(a.uid) ?? 0) - (this.handEntry.get(b.uid) ?? 0) || a.uid - b.uid);
      if (ripe.length) { const top = ripe[0]; const tc = this.card(top).trigger_card;
        const group = tc ? ripe.filter((r) => this.card(r).trigger_card === tc) : [top]; if (group.length > 1) this.stat12.fuseShared++; this.stat12.fuseHeldBack += ripe.length - group.length;
        for (const r of group) { const c = this.card(r); this.heldTurns.set(r.uid, 0); this.fuseLog.push({ burden: c.id, card: c.trigger_card ?? '', age: this.age }); this.flags.add(`fuse_${c.id}`); }
        const f = tc ? this.push(this.hand, tc) : null; if (f) { f.ephemeral = true; fresh.push(f); this.stat12.fuseLoss -= this.effScore(this.card(f).effects) * this.scale; } }
      // 5b. 回音牌（企劃定案 Q9）：排在爆牌之後、補牌之前，翻開就進手牌，算進 hand_size；一回合最多一張
      if (!this.hand.some((h) => this.card(h).echo_card)) { const ech = this.v12?.echo_cap_chance ?? {}; const shut = new Set(Object.keys(ech).filter((g) => typeof ech[g] === 'number' && makeRng((this.seed ^ 0xec4a ^ Math.imul(this.turnsDone + 1, 0x27d4eb2f) ^ g.length) >>> 0).next() >= (ech[g] as number)));
        const echoes = [...this.draw, ...this.discard].filter((i) => this.card(i).echo_card && this.eligible(i) && !(this.card(i).echo_cap_group && shut.has(this.card(i).echo_cap_group!)));
        // 選哪張回音用獨立、不存狀態的亂數（種子＋回合數），不動主亂數流（QA r7 Q4）
        if (echoes.length) { const e = makeRng((this.seed ^ 0xec0 ^ Math.imul(this.turnsDone + 1, 0x165667b1)) >>> 0).weighted(echoes, (i) => this.drawWeight(i.id))!; const pile = this.draw.includes(e) ? this.draw : this.discard; pile.splice(pile.indexOf(e), 1);
          const before = this.hand.length; this.toHand(e); fresh.push(e); this.stat12.echoPlaced++; this.echoCheck = before;
          const ec = this.card(e); if (ec.echo_cap_group) this.echoCapCount[ec.echo_cap_group] = (this.echoCapCount[ec.echo_cap_group] ?? 0) + 1; this.echoLog.push({ id: ec.id, age: this.age, term: this.term, social: this.stats.social }); } }
    }
    this.slotsLeft = this.cfg.time_slots;                                                    // 6.
    const skipped: Inst[] = [];
    while (this.hand.length < this.cfg.hand_size + this.hand.filter((i) => this.card(i).temp).length) {  // 7. 抽牌（臨時牌不算在 hand_size 內）
      // v1.2：回音牌只從 5b 回音步驟進手牌（受 echo_cap_chance／上限／echoLog 管），一般抽牌不抽（QA r7 Q4 查到一般抽牌會繞過這些）
      const drawable = (i: Inst) => this.eligible(i) && !(this.v12 && this.card(i).echo_card);
      let pool = this.draw.filter(drawable);
      if (!pool.length && this.discard.length) { this.draw.push(...this.discard); this.discard = []; pool = this.draw.filter(drawable); }
      if (this.v12 && skipped.length) pool = pool.filter((i) => !skipped.includes(i));
      if (!pool.length) break;
      const pick = this.rng.weighted(pool, (i) => this.drawWeight(i.id))!;
      this.draw.splice(this.draw.indexOf(pick), 1);
      // spec §2.1／§2.2-8：手上已經有一張期待類時又抽到期待類 → 那張進棄牌堆，改抽下一張
      if (this.v12 && this.isExpect(pick) && this.hand.some((h) => this.isExpect(h))) { this.discard.push(pick); skipped.push(pick); this.stat12.expectDiscarded++; continue; }
      this.toHand(pick); fresh.push(pick);
    }
    // 8. 強制事件：翻開就生效，佔一格手牌；病倒另外吃掉時間格（v1.2 只算這回合新進手牌的）
    for (const i of this.v12 ? fresh : this.hand) { const c = this.card(i); if (c.type !== 'forced') continue;
      this.apply(c.effects, this.scale); this.slotsLeft = Math.max(0, this.slotsLeft - (c.slot_cost ?? 0)); this.groupCooldown(c);
      this.yearNotes.push(this.v12 ? `${this.view(c.id).name}：${this.view(c.id).line}` : `${plainName(c.name)}：${c.line}`); }
    if (this.echoCheck !== null) { const tmp = this.hand.filter((i) => this.card(i).temp).length; if (this.hand.length - tmp > Math.max(this.cfg.hand_size, this.echoCheck + 1)) this.stat12.echoOverflow++; this.echoCheck = null; }
    if (this.v12) { this.yearNotes.unshift(...this.pendingNotes); this.pendingNotes = []; this.checkFlagRemovals(); this.dealStats(); }
  }
  /** §1.6 transforms_at_age：draw、discard、cooldown 裡的牌換成新實例（保留 origin），打過的次數併入新牌 */
  private transformAtAge() {
    for (const pile of [this.draw, this.discard, this.cooldown.map((x) => x.inst)]) for (const i of [...pile]) { const to = this.card(i).transforms_at_age?.[String(this.age)];
      if (!to || !this.cards.has(to)) continue; const n = this.mk(to); n.origin = i.origin;
      const k = this.cooldown.find((x) => x.inst === i); if (k) k.inst = n; else pile.splice(pile.indexOf(i), 1, n); }
    for (const c of this.cards.values()) { const to = c.transforms_at_age?.[String(this.age)]; if (to && this.playCount[c.id] && !this.flags.has(`transformed_${c.id}`)) { this.playCount[to] = (this.playCount[to] ?? 0) + this.playCount[c.id]; this.flags.add(`transformed_${c.id}`); }
      if (to) for (const set of Object.values(this.memAdded)) if (set.has(c.id)) { set.delete(c.id); set.add(to); } } // 回音計數跟著轉牌（playCount 已併入新牌）
  }
  private effScore(e: Partial<Record<StatId, number>> | undefined) { const w = this.cfg.score.weights; return Object.entries(e ?? {}).reduce((a, [k, v]) => a + (typeof v === 'number' ? (w[k as StatId] ?? 0) * v : 0), 0); }
  private dealStats() {
    const s = this.stat12; s.dealt++; const st = this.hand.filter((i) => this.card(i).sticky); s.maxSticky = Math.max(s.maxSticky, st.length); if (st.length >= this.v12!.max_sticky) s.fullSticky++;
    // §2.7-2 卡死：手上有包袱，而且沒有能打的非包袱牌、也沒有處理得起的包袱
    const stuck = st.length > 0 && !this.hand.some((i) => this.card(i).type !== 'forced' && !this.lockReason(i));
    if (stuck) { s.stuck++; s.stuckStreak++; s.maxStuckStreak = Math.max(s.maxStuckStreak, s.stuckStreak); } else s.stuckStreak = 0;
    if (this.age >= 16 && [...this.draw, ...this.discard, ...this.hand, ...this.cooldown.map((x) => x.inst)].some((i) => i.id === 's_club_jr')) s.clubJrAfter16++;
  }
  /** 冷卻組：同組的牌從 draw 移進 cooldown */
  private groupCooldown(c: CardDef) { if (!c.cooldown_group) return;
    for (const i of [...this.draw]) { const d = this.card(i); if (d.cooldown_group === c.cooldown_group) { this.draw.splice(this.draw.indexOf(i), 1); this.cooldown.push({ inst: i, left: this.echoCooldown(d, i, d.cooldown ?? c.cooldown ?? 1) }); } } }
  /** v1.2 回音冷卻隨機（v12.echo_cooldown）：獨立、不存狀態的亂數（種子＋回合數＋牌 uid），不動 this.rng */
  private echoCooldown(c: CardDef, i: Inst, left: number) { const ec = this.v12?.echo_cooldown; if (!ec || !c.cooldown_group || !ec.groups.includes(c.cooldown_group)) return left;
    return ec.min + Math.floor(makeRng((this.seed ^ 0xc001d ^ Math.imul(this.turnsDone + 1, 0x9e3779b1) ^ Math.imul(i.uid + 1, 0x85ebca6b)) >>> 0).next() * (ec.max - ec.min + 1)); }
  /** sticky 包袱離開手牌：依 on_handle 去處 */
  private leaveHand(i: Inst, why: string) {
    const c = this.card(i); const k = this.hand.indexOf(i); if (k >= 0) this.hand.splice(k, 1); this.heldTurns.delete(i.uid); this.removedProgress.delete(i.uid); this.deferFlagLeave.delete(i.uid); this.handEntry.delete(i.uid);
    this.burdenLeft[c.id] = (this.burdenLeft[c.id] ?? 0) + 1;
    const permanent = c.on_handle === 'remove' || (why === 'handle' && c.remove_after && this.playCount[c.id] % c.remove_after === 0);
    if (permanent) this.removed.push(i); else if (c.on_handle === 'return' && c.returns_after) this.cooldown.push({ inst: i, left: c.returns_after }); else this.discard.push(i);
  }
  /** 手上包袱的 removed_by.flags_any */
  private checkFlagRemovals() { for (const i of [...this.hand]) { const r = this.card(i).removed_by; if (this.card(i).sticky && !this.deferFlagLeave.has(i.uid) && r?.flags_any?.some((f) => this.flags.has(f))) this.leaveHand(i, 'flag'); } }
  /** 牌進手牌；v1.2 sticky 包袱已滿 max_sticky 時，最舊的那張先罰一次再依 on_handle 離開 */
  private toHand(i: Inst) {
    const c = this.card(i);
    if (this.v12 && c.sticky) {
      const held = this.hand.filter((h) => this.card(h).sticky);
      // 企劃定案 Q7：期待類永不被擠，擠最舊的非期待類（被擠掉依 on_handle 離開，不算進 remove_after）
      const pool = held.filter((h) => this.card(h).burden_class !== 'expectation');
      if (held.length >= this.v12.max_sticky && pool.length) { const old = [...pool].sort((a, b) => (this.handEntry.get(a.uid) ?? 0) - (this.handEntry.get(b.uid) ?? 0) || a.uid - b.uid)[0];
        this.evictLog.push({ out: this.handEntry.get(old.uid) ?? 0, cands: pool.map((h) => this.handEntry.get(h.uid) ?? 0) });
        const oc = this.card(old); this.stat12.evictions++; if (oc.burden_class === 'expectation') this.stat12.evictExpect++; if (oc.held_per_turn) { this.apply(oc.held_per_turn, this.scale); this.stat12.heldLoss -= this.effScore(oc.held_per_turn) * this.scale; }
        this.leaveHand(old, 'evict'); this.shaken.push(oc.id); }
      this.heldTurns.set(i.uid, 0);
      if (c.burden_class === 'expectation') { if (this.age >= 19 && c.id === 'b_expect') this.stat12.expectNewAfter19++; if (this.age >= 19 && c.id === 'b_family_expect') this.stat12.famNewAfter19++;
        if (c.removed_by?.flags_any?.some((f) => this.flags.has(f))) this.deferFlagLeave.add(i.uid); }
    }
    if (this.v12) this.flags.add(`held_${c.id}`);
    this.handEntry.set(i.uid, ++this.entrySeq);
    this.hand.push(i);
  }
  costOf(i: Inst): number | null {
    const c = this.card(i); if (c.cost == null) return null;
    let cost = c.cost;
    if (c.type === 'burden' && this.hand.some((h) => this.card(h).in_hand?.burden_cost_minus)) cost -= Math.max(...this.hand.map((h) => this.card(h).in_hand?.burden_cost_minus ?? 0));
    return Math.max(0, cost);
  }
  lockReason(i: Inst): string | null {
    const c = this.card(i); const cost = this.costOf(i);
    if (c.type === 'forced') return '躲不掉的事。';
    if (cost === null) return c.sticky ? '只有某些事情發生，它才會離開。' : '它就是佔著位置。';
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
    if (this.v12 && c.sticky) this.stat12.handleSlots += this.costOf(i)!;
    if (this.v12) { this.checkPlayFlags(c.id); const pn = this.v12.play_notes?.[c.id]; if (pn && !this.playNoted.has(c.id)) { this.playNoted.add(c.id); const t = pickVariantField(pn, 'text', this.variantCtx()); if (t) this.pendingNotes.push(this.fill(t)); } }
    this.hand.splice(this.hand.indexOf(i), 1); this.playedThisYear.push(i); this.yearPlays.push(c.id);
    const { eff, expect } = this.effectsFor(i);
    this.playCount[c.id] = (this.playCount[c.id] ?? 0) + 1; this.everPlayed.add(c.id);
    if (i.origin) { const m = this.childhood?.memories.find((x) => x.id === i.origin); if (m) this.originPlays[m.category] = (this.originPlays[m.category] ?? 0) + 1; }
    let text = this.text(c.id, 'result_text') ?? this.view(c.id).line;
    if (expect) text += `\n${this.cards.get('b_expect')!.result_text}`;
    const deltas = this.apply(eff, this.scale);
    if (c.invest && (deltas.wealth ?? 0) < 0) this.investSpent -= deltas.wealth!;
    for (const t of c.tags ?? []) this.tags[t] = (this.tags[t] ?? 0) + 1;
    if (this.v12 && c.sticky) { this.playedThisYear.splice(this.playedThisYear.indexOf(i), 1); this.leaveHand(i, 'handle'); }
    const rem = this.v12 && c.sticky ? [] : [...(c.removes ?? []), ...(c.remove_after && this.playCount[c.id] % c.remove_after === 0 ? [c.id] : [])];
    for (const id of rem) {
      if (id === c.id) { this.playedThisYear.splice(this.playedThisYear.indexOf(i), 1); this.removed.push(i); continue; }
      for (const pile of [this.draw, this.discard]) { const x = pile.find((y) => y.id === id); if (x) { pile.splice(pile.indexOf(x), 1); this.removed.push(x); break; } }
    }
    for (const id of c.clears ?? []) { const b = this.hand.find((h) => h.id === id); if (b) { this.hand.splice(this.hand.indexOf(b), 1); this.discard.push(b); } }
    const twice = [...(c.adds_if_twice_in_year && this.playedThisYear.filter((x) => x.id === c.id).length === 2 ? c.adds_if_twice_in_year : []),
      ...(c.adds_if_n_in_year && this.yearPlays.filter((x) => x === c.id).length === c.adds_if_n_in_year.n ? c.adds_if_n_in_year.adds : [])];
    for (const id of [...(c.adds ?? []), ...twice]) {
      const d = this.cards.get(id)!; const exists = [...this.draw, ...this.discard, ...this.hand, ...this.playedThisYear].some((x) => x.id === id);
      const n = [...this.draw, ...this.discard, ...this.hand, ...this.playedThisYear].filter((x) => x.id === id).length;
      if (!(d.once_in_deck && exists) && !(d.max_in_deck !== undefined && n >= d.max_in_deck)) this.draw.push(this.mk(id));
    }
    const ga = c.grant_after;
    if (ga && this.playCount[c.id] === ga.count) { if (ga.flag) this.addFlag(ga.flag);
      for (const id of ga.adds ?? []) if (![...this.draw, ...this.discard, ...this.hand].some((x) => x.id === id)) this.draw.push(this.mk(id)); }
    // v1.2 §2.2-4：removed_by（cards_any／tags_any 累積進度，到 count 就離開，不套用 effects）
    if (this.v12 && !c.sticky) for (const b of [...this.hand]) { const r = this.card(b).removed_by; if (!this.card(b).sticky || !r) continue;
      if (r.cards_any?.includes(c.id) || r.tags_any?.some((t) => c.tags?.includes(t))) { const n = (this.removedProgress.get(b.uid) ?? 0) + 1; this.removedProgress.set(b.uid, n); if (n >= (r.count ?? 1)) this.leaveHand(b, 'removed_by'); } }
    if (this.v12 && c.cooldown && !c.sticky) { const k = this.playedThisYear.indexOf(i); if (k >= 0) { this.playedThisYear.splice(k, 1); this.cooldown.push({ inst: i, left: c.cooldown }); } }
    if (this.v12) this.groupCooldown(c);
    // afb123a：每打一張牌就檢查壓力；超過門檻立刻病倒，今年剩下的時間作廢（不算休息）
    let sick: PlayResult['sick'];
    if (!this.sickThisYear && this.stats.stress >= this.cfg.forced.f_sick.stress_at_least) {
      const f = this.cards.get('f_sick')!; this.sickThisYear = true; this.sickCount++; if (this.v12) this.flags.add('stress_peak'); this.sickAges.push(this.age); this.slotsLeft = 0;
      this.apply(f.effects, this.scale); this.yearNotes.push(`${plainName(f.name)}：${f.line}`);
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
        return ih?.academic_play_stress && this.stats.stress >= (ih.stress_at_least ?? 0) ? ih.academic_play_stress : 0; }).reduce((a, b) => a + b, 0);  // v1.2：play() 時整包乘 per_turn_scale
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
  isPassive() { const n = Object.values(this.playCount).reduce((a, b) => a + b, 0); const p = this.cfg.passive;
    return this.v12 && p.max_plays_per_turn !== undefined ? n <= p.max_plays_per_turn * this.ages.length * this.tpy : n <= p.max_plays_per_year * this.ages.length; }
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
  /** 回合結束（v1.1 一年一回合；v1.2 規格 §2.2 endTurn，下學期結束才做學年結算） */
  endYear() {
    this.eraRecent = [];
    for (const f of this.turnFlags) this.flags.delete(f); this.turnFlags = []; // 只活一個回合的旗標（暑假翻開的會在下面重新加，留到下一回合）
    // §5.3：沒用到的時間格算休息
    if (!this.sickThisYear && this.slotsLeft > 0 && this.cfg.rest_stress_per_slot) this.apply({ stress: -this.cfg.rest_stress_per_slot * this.slotsLeft }, this.scale);
    // 持有效果：牌庫裡（任何一疊）有這張牌，每年固定加
    // 年底結算只算還在年紀內的牌：年齡超過 age_max 就跳過（adult_branch.carry_age_max.ids 的牌在開關打開時已延長 age_max，照常結算）
    const live = (i: Inst) => this.age <= this.card(i).age_max;
    const yearEnd = this.term + 1 >= this.tpy;
    if (this.v12) for (const i of this.hand) { const c = this.card(i); if (!c.sticky) continue;  // §2.2 endTurn-2
      if (c.held_per_turn) { this.apply(c.held_per_turn, this.scale); this.stat12.heldLoss -= this.effScore(c.held_per_turn) * this.scale; this.shaken.push(c.id); }
      if (c.held_text) this.pendingNotes.push(this.fill(c.held_text));
      this.heldTurns.set(i.uid, (this.heldTurns.get(i.uid) ?? 0) + 1); }
    if (yearEnd) for (const i of new Set([...this.draw, ...this.discard, ...this.hand, ...this.playedThisYear])) { const h = this.card(i).held_per_year; if (h && live(i)) this.apply(h); }
    for (const i of this.hand) { const c = this.card(i); if (c.unplayed_end && live(i) && !c.sticky) this.apply(c.unplayed_end, this.scale); }
    const keep = this.v12 ? this.hand.filter((i) => this.card(i).sticky) : [];
    for (const i of this.hand) { if (keep.includes(i)) continue; const c = this.card(i);
      if (c.temp || i.ephemeral) { this.removed.push(i); continue; }
      if (this.v12 && c.cooldown && c.type === 'forced' && !c.removes?.includes(i.id)) { this.cooldown.push({ inst: i, left: this.echoCooldown(c, i, c.cooldown) }); continue; }
      (c.removes?.includes(i.id) && c.type === 'forced' ? this.removed : this.discard).push(i);
      // v1.2：強制牌（回音苦／暖）翻開就算出過，同組另一版也一起移出牌堆（每組每局一次）
      if (this.v12 && c.type === 'forced' && c.removes?.includes(i.id)) for (const id of c.removes) { if (id === i.id) continue;
        for (const pile of [this.draw, this.discard]) for (let k = pile.length - 1; k >= 0; k--) if (pile[k].id === id) this.removed.push(...pile.splice(k, 1));
        for (let k = this.cooldown.length - 1; k >= 0; k--) if (this.cooldown[k].inst.id === id) this.removed.push(this.cooldown.splice(k, 1)[0].inst); } }
    for (const i of this.playedThisYear) (this.card(i).temp || i.ephemeral ? this.removed : this.discard).push(i);
    this.hand = keep;
    this.log.push({ age: this.age, ...(this.tpy > 1 ? { term: this.term } : {}), played: this.playedThisYear.map((i) => i.id) });
    this.turnsDone++;
    if (!yearEnd) { this.term = 1; this.startBreak('winter') || this.beginYear(); return; }
    this.term = 0; this.yearPlays = [];
    // 錯過年紀：移出遊戲，沒打過的記進「沒走的路」
    for (const pile of [this.draw, this.discard]) for (const i of [...pile]) { const c = this.card(i);
      if (c.expires_age !== null && c.expires_age <= this.age) { pile.splice(pile.indexOf(i), 1); this.removed.push(i);
        if (!this.everPlayed.has(c.id) && !this.missed.some((m) => m.id === c.id)) {
          this.missed.push({ id: c.id, name: plainName(c.name), age: this.age, echo: c.echo }); this.flags.add(`missed_${c.id}`); } } }
    // 年底不再另外檢查：病倒只在打牌當下觸發（afb123a），避免同一份壓力被罰兩次
    if (this.ageIdx + 1 >= this.ages.length) {
      // §11：不過期的誘惑牌，牌庫裡有、整局都沒打過 → 局末進沒走的路
      for (const i of new Set([...this.draw, ...this.discard, ...this.removed])) { const c = this.card(i);
        if (c.missed_if_never_played && !this.everPlayed.has(c.id) && !this.missed.some((m) => m.id === c.id)) this.missed.push({ id: c.id, name: this.view(c.id).name, age: this.age }); }
      this.phase = 'review'; return; }
    if (this.cfg.summer_stress_mult !== undefined && this.ages[this.ageIdx + 1] === this.cfg.school_choice?.age) this.stats.stress = clamp(this.stats.stress * this.cfg.summer_stress_mult);
    if (this.adult && this.cfg.adult_branch!.summer_stress_mult !== undefined && this.ages[this.ageIdx + 1] === this.cfg.adult_branch!.ages[0]) this.stats.stress = clamp(this.stats.stress * this.cfg.adult_branch!.summer_stress_mult!);
    if (this.v12 && this.route !== 'work_first') this.flipEra(this.slotKey('summer')); // era-cards §0.3：暑假槽位，在壓力倍率之後、暑假事件之前（出社會路線併入下半年，見 beginYear）
    this.ageIdx++;
    // v1.2：新年齡已經超過 age_max 的 sticky 包袱直接移出，不罰
    if (this.v12) for (const i of [...this.hand]) if (this.card(i).sticky && this.age > this.card(i).age_max) { this.hand.splice(this.hand.indexOf(i), 1); this.heldTurns.delete(i.uid); this.removed.push(i); }
    this.startBreak('summer') || this.beginYear();
  }
  // ----- v1.2 寒暑假（規格 §3.4：不算一手；翻 draw 張選 1，效果不縮放）。pool 空的時候直接跳過 -----
  private startBreak(kind: 'winter' | 'summer'): boolean {
    const b = this.v12?.breaks; const d = b?.[kind]; if (!b || !d || !d.pool.length) return false;
    if (this.route && d.skip_routes?.includes(this.route)) return false;
    const age = kind === 'summer' ? this.ages[this.ageIdx - 1] ?? this.age : this.age;
    if (!(d.force_ages?.includes(age) || this.rng.next() < d.chance)) return false;
    for (const k of Object.keys(this.breakCooldown)) if (--this.breakCooldown[k] <= 0) delete this.breakCooldown[k];
    const pool = d.pool.filter((id) => { const c = this.cards.get(id); return c && !this.breakCooldown[id] && age >= c.age_min && age <= c.age_max && (!c.ages || c.ages.includes(age)) && (!c.flags_any?.length || c.flags_any.some((f) => this.flags.has(f))); });
    if (!pool.length) return false; const offer: string[] = pool.filter((id) => this.cards.get(id)!.break_force).slice(0, b.draw);
    while (offer.length < b.draw && offer.length < pool.length) offer.push(this.rng.weighted(pool.filter((x) => !offer.includes(x)), (x) => this.drawWeight(x))!);
    this.breakKind = kind; this.breakOffer = offer; this.phase = 'break'; return true;
  }
  pickBreak(id: string) {
    if (this.phase !== 'break' || !this.breakOffer.includes(id)) throw new Error('不能選這個'); const c = this.cards.get(id)!;
    this.apply(c.effects); for (const a of c.adds ?? []) this.push(this.draw, a); if (c.cooldown) this.breakCooldown[id] = c.cooldown;
    this.pendingNotes.push(`${this.view(id).name}：${this.text(id, 'result_text') ?? this.view(id).line}`);
    this.breakKind = null; this.breakOffer = []; this.phase = 'play'; this.beginYear();
  }
  /** 套用效果；scale ≠ 1 時用小數累積器（§3.3），累積到 ±1 才實際加減 */
  private apply(eff: Partial<Record<StatId, number>>, scale = 1) {
    const d: Partial<Record<StatId, number>> = {};
    for (const [k, v] of Object.entries(eff)) { const s = k as StatId; let x = v ?? 0;
      if (scale !== 1) { const t = (this.statFrac[s] ?? 0) + x * scale; x = Math.trunc(t + (t > 0 ? 1e-9 : -1e-9)); this.statFrac[s] = t - x; }
      const nv = clamp(this.stats[s] + x); d[s] = nv - this.stats[s]; this.stats[s] = nv; }
    if (this.v12 && this.stats.stress >= this.stressPeakAt()) this.flags.add('stress_peak');
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
export function drawablePool(cfg: DeckConfig, cards: CardDef[], quintile: number, age: number, track?: string, route?: string, extra: string[] = []): string[] {
  const ab = cfg.adult_branch; const ext = route !== undefined || age > Math.max(...cfg.ages);
  const byId = new Map(cards.map((c) => [c.id, ext && ab?.carry_age_max.ids.includes(c.id) ? { ...c, age_max: Math.max(c.age_max, ab.carry_age_max.to) } : c]));
  const radds = ext && ab ? [...ab.shared_adds, ...(route ? (ab.branch.options[route]?.adds ?? ab.branch_jc.options[route]?.adds ?? []) : []), ...(route && (ab.branch.options[route]?.loan) ? [ab.loan.card] : [])] : [];
  const set = new Set([...cfg.start_deck.common, ...(cfg.start_deck.by_quintile[String(quintile)] ?? []), 'f_teacher', 'f_sick',
    ...(track ? [...(cfg.school_choice?.options[track]?.adds ?? []), ...Object.values(cfg.school_choice?.options[track]?.adds_at_age ?? {}).flat()] : []), ...radds, ...extra].filter((id) => byId.has(id)));
  let grew = true; while (grew) { grew = false; for (const id of [...set]) for (const a of [...(byId.get(id)?.adds ?? []), ...(byId.get(id)?.grant_after?.adds ?? []), ...(byId.get(id)?.adds_if_n_in_year?.adds ?? []), ...Object.values(byId.get(id)?.transforms_at_age ?? {})]) if (!set.has(a) && byId.has(a)) { set.add(a); grew = true; } }
  return [...set].filter((id) => { const c = byId.get(id)!; return age >= c.age_min && age <= c.age_max && (trackOk(c.requires_track, track) || trackOk(c.requires_track, route)); });
}
/** 假玩家選校（config.school_choice.sim_policy）：夠門檻→一定機率普高；否則小機率五專，其餘高職 */
export function botSchoolChoice(g: DeckGame, r: Rng): string {
  const sp = g.cfg.school_choice!.sim_policy; const ok = g.schoolOptions().filter((x) => !x.locked).map((x) => x.key);
  if (ok.includes('hs_general') && r.next() < sp.general_if_eligible) return 'hs_general';
  return r.next() < sp.five_year ? 'hs_5yr' : 'hs_vocational';
}
/** 假玩家分流：出社會比例對齊各高中路線真實流向（普高約 5%、高職與五專約 13%，以該路線全體計）。
 *  沒資格升學的人一律出社會（已佔：普高約 5%、高職約 16%、五專約 33%，門檻 a1b6a43），
 *  所以只對「有資格」的人再補一點出社會機率：p = max(0, (目標 − 沒資格比例) ÷ 有資格比例)。
 *  高職、五專光是沒資格就已超過目標，補 0。要升學的人：能選大學 → 0.8 機率大學，其餘科大（同先前）。 */
export const BOT_WORK_TARGET: Record<string, number> = { hs_general: 0.05, hs_vocational: 0.13, hs_5yr: 0.13 };
export const BOT_WORK_IF_ELIGIBLE: Record<string, number> = { hs_general: 0.006, hs_vocational: 0, hs_5yr: 0 };
export function botBranchChoice(g: DeckGame, r: Rng): string {
  const sp = g.cfg.adult_branch!.sim_policy; const ok = g.branchOptions().filter((x) => !x.locked).map((x) => x.key);
  const study = ok.filter((k) => k === 'uni' || k === 'uni_tech');
  if (!study.length) return 'work_first';
  // work_choice_by_track 只在 v1.2 讀（企劃 §9.7-2）；舊模式照 BOT_WORK_IF_ELIGIBLE
  const wc = g.v12 ? sp.work_choice_by_track?.[g.track ?? ''] : undefined; if (r.next() < (typeof wc === 'number' ? wc : BOT_WORK_IF_ELIGIBLE[g.track ?? ''] ?? 0)) return 'work_first';
  if (ok.includes('uni') && (!ok.includes('uni_tech') || r.next() < sp.uni)) return 'uni';
  return 'uni_tech';
}
/** 假玩家住處：adult_branch.housing.sim_move_out（預設 0.5）機率搬出去住 */
export function botHousingChoice(g: DeckGame, r: Rng): string {
  const h = g.cfg.adult_branch?.housing!; const keys = Object.keys(h.options);
  return r.next() < (h.sim_move_out ?? 0.5) && keys.includes('move_out') ? 'move_out' : keys.find((k) => k !== 'move_out') ?? keys[0];
}
/** v1.2 假玩家選回憶卡（規格 §1.5）：random／category:<c>（有就選，沒有就隨機）／fixed:<id>（強制套用，其他幕不選）／skip（都不選） */
export function botMemoryPick(g: DeckGame, r: Rng, mode = 'random') {
  while (g.phase === 'prologue') {
    const o = g.prologueOffer();
    if (mode.startsWith('fixed:')) { const id = mode.slice(6); const m = g.childhood!.memories.find((x) => x.id === id)!; g.pickMemory(m.act === g.childAge ? id : null, { force: true }); continue; }
    if (mode === 'skip' || !o.length) { g.pickMemory(null); continue; }
    const want = mode.startsWith('category:') ? o.filter((m) => m.category === mode.slice(9)) : [];
    const pool = want.length ? want : o; g.pickMemory(pool[Math.floor(r.next() * pool.length)].id);
  }
  if (g.phase === 'prologueSummary') g.startSchool();
}
/** v1.2 假玩家：處理包袱的價值（規格 §2.6 greedy／worst），每格時間 */
export function burdenValue(g: DeckGame, i: Inst): number {
  const c = g.card(i); const cost = g.costOf(i); if (!c.sticky || cost === null) return -Infinity;
  const w = g.cfg.score.weights; const sc = (e?: Partial<Record<StatId, number>>) => Object.entries(e ?? {}).reduce((a, [k, v]) => a + (w[k as StatId] ?? 0) * (v ?? 0), 0) * g.scale;
  const held = g.heldTurns.get(i.uid) ?? 0; const left = (g.ages.length - g.ageIdx) * g.tpy - g.term;
  const horizon = c.trigger_after ? Math.min(c.trigger_after - held, left) : Math.min(2, left);
  const fuse = c.trigger_after && c.trigger_after - held <= left ? -sc(g.cards.get(c.trigger_card ?? '')?.effects) : 0;
  return (sc(c.effects) - sc(c.held_per_turn) * horizon + fuse) / Math.max(1, cost);
}
