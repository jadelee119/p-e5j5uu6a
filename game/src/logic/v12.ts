// v1.2 規則的資料格式與工具（design/v1.2-spec.md）：data/deck/v12.json、data/deck/childhood.json、data/timeline.json、data/deck/era_cards.json
import type { StatId } from './types';
export type Eff = Partial<Record<StatId, number>>;

export interface V12Config {
  enabled: boolean; turns_per_year: number; per_turn_scale: number; max_sticky: number;
  /** 企劃定案 Q5：v1.2 預設開 18→22（一局 23 手）；呼叫端 opts.adult 可覆蓋 */ adult?: boolean;
  term_names: { fall: string; spring: string; work_fall?: string; work_spring?: string; winter?: string; summer?: string };
  config_overrides?: Record<string, any>; card_overrides?: Record<string, Record<string, unknown>>;
  family_situations?: Record<string, { chance_by_quintile: Record<string, number>; weight_mult?: Record<string, number>; adds?: string[] }>;
  term_scenes?: { default: string; route_default?: Record<string, string | { fall?: string; spring?: string }>; table: { age: number; term: 'fall' | 'spring'; scene: string; tracks?: string[]; routes?: string[] }[];
    scenes: Record<string, { name: string; name_spring?: string; text?: string; adds_this_turn?: string[]; effects?: Eff }> };
  breaks?: { draw: number; winter?: BreakDef; summer?: BreakDef };
  /** 開局就放進牌庫的牌（回音牌；條件不符時抽不到） */ start_adds?: string[];
  era: { nationwide: string[] };
  /** 回音上限組（cards 的 echo_cap_group）：同組每局最多幾張 */ echo_caps?: Record<string, number | string>;
  /** 回音上限組最早什麼時候能放進手牌：[年齡, 學期（0 上／1 下）]，早於這個回合抽不到 */ echo_cap_from?: Record<string, [number, number] | string>;
  /** 單張牌最早放進手牌的回合：[年齡, 學期（0 上／1 下）]；有寫就取代上限組的 echo_cap_from，沒寫照組規則 */ echo_from_card?: Record<string, [number, number] | string>;
  /** 回音上限組每回合能放進手牌的機率（沒寫＝1）；擲骰用獨立、不存狀態的亂數（種子＋回合數），不動其他亂數流 */ echo_cap_chance?: Record<string, number | string>;
  /** 這些 cooldown_group 的冷卻回合數改成 min～max 隨機（每張牌每次冷卻各擲一次，同樣是獨立、不存狀態的亂數） */ echo_cooldown?: { groups: string[]; min: number; max: number; _note?: string };
  /** 打過某些牌、或有某些旗標，就加旗標（例：working＝出社會或打過工，給一例一休換版本） */ play_flags?: Record<string, { cards?: string[]; prefix?: string[]; flags_any?: string[] }>;
  /** 每局第一次打這張牌時多一句旁白（依 by_flag 等選版本；欄位 text） */ play_notes?: Record<string, TextVariant[]>;
  checks?: Record<string, number>;
}
export interface BreakDef { chance: number; force_ages?: number[]; pool: string[]; skip_routes?: string[] }

// ----- 童年序章（childhood.json，規格 §1.5） -----
export interface MemoryText { name?: string | null; situation?: string | null; consequence?: string | null }
export interface MemoryCard extends MemoryText { id: string; act: number; category: string; adds: string[]; flag?: string; weight?: string; weight_if_county_tags?: Record<string, number>;
  by_birth_year?: ({ from: number; to: number } & MemoryText)[]; art?: string; echo_hook?: string; todo?: string; name: string; situation: string; consequence: string }
export interface ChildhoodData { ages: number[]; acts: Record<string, { label: string; era_band: [number, number] }>; draw: number; pick: number; distinct_categories: boolean;
  show_consequence?: 'before' | 'after';
  categories: Record<string, { name: string; fallback_add?: string }>; weight_levels: Record<string, Record<string, number>>; memories: MemoryCard[];
  summary?: { all_same?: Record<string, string>; mixed?: string } }

// ----- 年表（數據研究員 data/timeline.json） -----
export interface TimelineEvent { id: string; name_zh: string; roc_ym_start: string; roc_ym_end?: string | null; age_min?: number; age_max?: number; school_stages_affected?: string[];
  counties?: string[]; county_impact?: { heavy?: string[]; light?: string[] }; reachable_birth_years?: number[]; sources?: unknown[] }
export interface SystemRule { id: string; name_zh?: string; applies_to_birth_roc_years: number[]; [k: string]: unknown }
export interface Timeline { events: TimelineEvent[]; system_rules: SystemRule[] }
export function loadTimeline(raw: unknown): Timeline {
  const r = (raw ?? {}) as any; return { events: Array.isArray(r.events) ? r.events : [], system_rules: Array.isArray(r.system_rules) ? r.system_rules : [] };
}
/** 某出生年適用的制度變動（只查詢） */
export function systemRulesFor(t: Timeline | undefined, birthYear: number): SystemRule[] { return (t?.system_rules ?? []).filter((r) => r.applies_to_birth_roc_years?.includes(birthYear)); }

/** 民國年月 "88-09" → 月序（年×12＋月−1） */
export function ym(s: string): number { const m = /^(\d+)[-/.](\d+)/.exec(s.trim()); if (!m) throw new Error(`年月格式不對：${s}`); return Number(m[1]) * 12 + Number(m[2]) - 1; }
export const ymOf = (y: number, m: number) => y * 12 + m - 1;
// ----- 時代牌（data/deck/era_cards.json，design/v1.2-era-cards.md §7；文字由劇情文案寫） -----
export type Tier = 'heavy' | 'light' | 'tv';
export interface EraCard { id: string; timeline_id?: string; type?: 'era'; name: string; /** 舊電視框色（美術） */ accent?: string; line: string; result_text?: string; album_text?: string; review_line?: string; icon?: string;
  roc_ym_start?: string; roc_ym_end?: string; roc_year_min?: number; roc_year_max?: number; priority?: number;
  county_tiers?: { heavy?: string[]; light?: string[] }; tier_policy?: 'all' | 'heavy_light'; counties?: string[];
  effects?: Eff; effects_by_tier?: Partial<Record<Tier, Eff>>; effects_by_quintile?: Record<string, Eff> | null; prologue_effects?: boolean;
  flag?: string; sets_flags?: string[]; sets_flags_by_tier?: Partial<Record<Tier, string[]>>; sets_flags_by_quintile?: Record<string, string[]>;
  /** 只活到下一個回合結束的旗標（場景換版本用，例：開學延後、畢業典禮取消） */ turn_flags?: string[]; turn_flags_by_tier?: Partial<Record<Tier, string[]>>;
  /** 翻開時再擲一次家庭處境（例：金融海嘯 Q1–Q3 parent_unemployed，機率＝family_situations 的值 × chance_mult） */ rolls?: { flag: string; quintiles: number[]; chance_mult: number }[];
  variants?: TextVariant[]; source_status?: string; pending?: string[]; frame?: string; todo_writer?: boolean }
export interface ReviewOnly { id: string; timeline_id?: string; roc_ym_start: string; roc_ym_end?: string; counties?: string[];
  /** 有寫就只給這些出生年（民國），沒寫＝不限（企劃 F7-1） */ applies_to_birth_roc_years?: number[]; priority?: number; review_line?: string }
export interface EraRule { timeline_rule_id: string; applies_to_birth_roc_years: number[]; game_effect: 'text_variant' | 'flag' | 'turn_flag' | 'deferred_v13'; flag?: string; quintiles?: number[];
  /** flag 規則：選校畫面的學費句只給這些出生年，其他有旗標的年次改顯示 tuition_neutral；沒寫＝都給（企劃 F7-2） */ choice_text_birth_roc_years?: number[];
  /** turn_flag：回合的月份區間結束在 before 之前加 flag_before，否則加 flag_after */ before?: string; flag_before?: string; flag_after?: string; _note?: string }
export interface EraData { prologue_capacity: Record<string, number>; review_max_lines: number; cards: EraCard[]; review_only?: ReviewOnly[]; rules?: EraRule[] }
export interface EraResolved extends EraCard { ymStart: number; ymEnd: number }
export function resolveEraCards(cards: EraCard[], tl: Timeline | undefined): { cards: EraResolved[]; warnings: string[] } {
  const ev = new Map((tl?.events ?? []).map((e) => [e.id, e])); const warnings: string[] = []; const out: EraResolved[] = [];
  for (const c of cards) { const e = c.timeline_id ? ev.get(c.timeline_id) : undefined;
    if (c.timeline_id && !e) warnings.push(`時代牌 ${c.id} 的 timeline_id ${c.timeline_id} 在年表裡找不到`);
    const s = c.roc_ym_start ?? e?.roc_ym_start; const en = c.roc_ym_end ?? e?.roc_ym_end ?? s;
    if (!s) { warnings.push(`時代牌 ${c.id} 沒有日期`); continue; }
    out.push({ ...c, county_tiers: c.county_tiers ?? e?.county_impact, counties: c.counties ?? e?.counties, ymStart: ym(s), ymEnd: ym(en!) }); }
  return { cards: out, warnings };
}
/** 縣市分級：heavy／light／tv；null＝翻不到（tier_policy heavy_light 的 tv） */
export function eraTier(c: { county_tiers?: { heavy?: string[]; light?: string[] }; tier_policy?: string; counties?: string[] }, countyId: string, nationwide: string[]): Tier | null {
  const t: Tier = c.county_tiers?.heavy?.includes(countyId) ? 'heavy' : c.county_tiers?.light?.includes(countyId) ? 'light' : 'tv';
  if (t === 'tv' && c.tier_policy === 'heavy_light') return null;
  // 年表 counties 是空的（事件不在遊戲五縣市）而且 county_tiers 也沒寫＝翻不到；其他照 tier_policy（all：沒列到的縣市是 tv）
  if (t === 'tv' && c.counties && c.counties.length === 0 && !c.county_tiers?.heavy?.length && !c.county_tiers?.light?.length) return null;
  return t;
}
export interface Window { from: number; to: number }
/** 時代牌槽位（era-cards §0.1）：序章三幕、每個回合（上／下學期）、暑假（最後一年沒有） */
export interface EraSlot { key: string; kind: 'prologue' | 'term' | 'summer'; age: number; term?: 0 | 1; cap: number; win: Window }
/**
 * 槽位月份（民國，全部當作 1–8 月出生）：遊戲年齡 a、出生年 Y、學年 Y+a−1。
 * 上學期 (Y+a−1)/09–(Y+a)/01；下學期 (Y+a)/02–06；暑假 (Y+a)/07–08；寒假不佔月份。
 * 一年一回合時，一個回合涵蓋 (Y+a−1)/09–(Y+a)/08。序章一幕 era_band [a0,a1] → (Y+a0−1)/09–(Y+a1)/08。
 */
export function eraSlots(Y: number, deckAges: number[], tpy: number, ch: ChildhoodData | null | undefined, caps: Record<string, number>): EraSlot[] {
  const out: EraSlot[] = [];
  if (ch) for (const a of ch.ages) { const b = ch.acts[String(a)].era_band; out.push({ key: `act${a}`, kind: 'prologue', age: a, cap: caps[String(a)] ?? 1, win: { from: ymOf(Y + b[0] - 1, 9), to: ymOf(Y + b[1], 8) } }); }
  deckAges.forEach((a, k) => {
    if (tpy <= 1) { out.push({ key: `${a}F`, kind: 'term', age: a, term: 0, cap: 1, win: { from: ymOf(Y + a - 1, 9), to: ymOf(Y + a, 8) } }); return; }
    out.push({ key: `${a}F`, kind: 'term', age: a, term: 0, cap: 1, win: { from: ymOf(Y + a - 1, 9), to: ymOf(Y + a, 1) } });
    out.push({ key: `${a}S`, kind: 'term', age: a, term: 1, cap: 1, win: { from: ymOf(Y + a, 2), to: ymOf(Y + a, 6) } });
    if (k < deckAges.length - 1) out.push({ key: `${a}U`, kind: 'summer', age: a, cap: 1, win: { from: ymOf(Y + a, 7), to: ymOf(Y + a, 8) } });
  });
  return out;
}
export const overlaps = (e: { ymStart: number; ymEnd: number }, w: Window) => Math.max(e.ymStart, w.from) <= Math.min(e.ymEnd, w.to);
/**
 * 開局一次排好整局（era-cards §0.2）：候選→依 priority 高、碰得到的槽位少、起日早、id 排序→放進最早還有空位的槽位；放不進去的是 lost。
 * 回傳 { schedule: 槽位 key → 牌 id[], lost, tiers }
 */
export function buildEraSchedule(cards: EraResolved[], Y: number, countyId: string, slots: EraSlot[], nationwide: string[]) {
  const cand = cards.map((c) => ({ c, tier: eraTier(c, countyId, nationwide), sl: slots.filter((s) => overlaps(c, s.win)) })).filter((x) => x.tier && x.sl.length);
  cand.sort((a, b) => (b.c.priority ?? 0) - (a.c.priority ?? 0) || a.sl.length - b.sl.length || a.c.ymStart - b.c.ymStart || (a.c.id < b.c.id ? -1 : 1));
  const schedule: Record<string, string[]> = {}; const lost: string[] = []; const tiers: Record<string, Tier> = {};
  for (const { c, tier, sl } of cand) { tiers[c.id] = tier!; const s = sl.find((x) => (schedule[x.key]?.length ?? 0) < x.cap); if (s) (schedule[s.key] ??= []).push(c.id); else lost.push(c.id); }
  return { schedule, lost, tiers };
}
/** 回顧一行：每筆放在最早碰得到的槽位（不佔容量） */
export function scheduleReviewOnly(items: ReviewOnly[], countyId: string, slots: EraSlot[], nationwide: string[], birthYear?: number): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const r of items) { if (r.applies_to_birth_roc_years && birthYear !== undefined && !r.applies_to_birth_roc_years.includes(birthYear)) continue;
    if (r.counties && !r.counties.some((x) => nationwide.includes(x) || x === countyId)) continue;
    const e = { ymStart: ym(r.roc_ym_start), ymEnd: ym(r.roc_ym_end ?? r.roc_ym_start) }; const s = slots.find((x) => overlaps(e, x.win)); if (s) (out[s.key] ??= []).push(r.id); }
  return out;
}

/** 文字裡的 {變數} */
export function placeholders(s: string | undefined | null): string[] { return [...(s ?? '').matchAll(/\{(\w+)\}/g)].map((m) => m[1]); }
/** 疊加覆寫：值為 null 表示刪掉欄位；物件遞迴合併（陣列整個取代） */
export function overlay<T>(base: T, patch: Record<string, unknown> | undefined): T {
  if (!patch) return base; const out: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const [k, v] of Object.entries(patch)) { if (k.startsWith('_')) continue;
    if (v === null) delete out[k]; else if (typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' && out[k] && !Array.isArray(out[k])) out[k] = overlay(out[k], v as any); else out[k] = v; }
  return out;
}

/**
 * 文字版本（牌、場景通用）。每個版本可以疊加多個選擇條件，全部符合才算數：
 *   by_flag（有其中任一個 flag）、by_track（選校路線或分流路線，任一個）、by_age（[最小, 最大]）、by_birth_year（[起, 迄]）、by_county_tag（縣市 event_tags 任一個）。
 * 每個欄位（name、line、result_text…）各自挑：在「符合的版本」裡依優先序找第一個有填這個欄位的，都沒有就用牌本身的欄位。
 * 優先序：by_flag（或 by_county_tag）＞ by_track＋by_age ＞ by_track ＞ by_age ＞ by_birth_year ＞ 預設；by_track 對到分流路線（route）的比只對到選校路線（track）的優先；同一級依資料裡的順序。
 * 時代牌另有 by_tier／by_term／by_quintile／by_prologue（必須符合；有填的同級版本優先）。
 */
export interface TextVariant { by_flag?: string | string[]; by_track?: string | string[]; by_age?: [number, number]; by_birth_year?: [number, number]; by_county_tag?: string[];
  /** 時代牌用：縣市分級、翻開的學期（0 上／1 下）、家境分位、是否在序章 */ by_tier?: Tier | Tier[]; by_term?: 0 | 1; by_quintile?: number[]; by_prologue?: boolean;
  /** 同一級有好幾個版本符合時，依 weight 加權抽一個（沒寫＝1；每局每張牌固定一個擲骰值 ctx.roll，所以同一局不會換來換去） */ weight?: number;
  name?: string | null; line?: string | null; text?: string | null; /** 序章時代牌的後果句（line＝處境） */ consequence?: string | null; result_text?: string | null; album_text?: string | null; regret_text?: string | null; _note?: string }
export interface VariantCtx { flags: Set<string>; track: string | null; route: string | null; /** 選校路線（分流後 track 會換掉） */ schoolTrack?: string | null; age: number; birthYear: number; countyTags: string[]; tier?: Tier; term?: number; quintile?: number; prologue?: boolean; roll?: number }
const arr = (x: string | string[] | undefined) => (x === undefined ? undefined : Array.isArray(x) ? x : [x]);
export function variantRank(v: TextVariant, c: VariantCtx): number {
  const fl = arr(v.by_flag), tr = arr(v.by_track);
  if (fl && !fl.some((f) => c.flags.has(f))) return -1;
  if (v.by_county_tag && !v.by_county_tag.some((t) => c.countyTags.includes(t))) return -1;
  if (tr && !tr.some((t) => t === c.track || t === c.route || t === c.schoolTrack)) return -1;
  if (v.by_age && (c.age < v.by_age[0] || c.age > v.by_age[1])) return -1;
  if (v.by_birth_year && (c.birthYear < v.by_birth_year[0] || c.birthYear > v.by_birth_year[1])) return -1;
  const ti = v.by_tier === undefined ? undefined : Array.isArray(v.by_tier) ? v.by_tier : [v.by_tier];
  if (ti && (!c.tier || !ti.includes(c.tier))) return -1; if (v.by_term !== undefined && c.term !== v.by_term) return -1;
  if (v.by_quintile && (c.quintile === undefined || !v.by_quintile.includes(c.quintile))) return -1; if (v.by_prologue !== undefined && !!c.prologue !== v.by_prologue) return -1;
  const extra = ti || v.by_term !== undefined || v.by_quintile || v.by_prologue !== undefined ? 0.5 : 0;
  const viaRoute = tr && c.route && tr.includes(c.route) ? 0.25 : 0; // 分流後路線比選校路線新：同時符合 hs_* 和 uni／uni_tech 時用路線那版（19 歲開學場景）
  return extra + viaRoute + (fl || v.by_county_tag ? 5 : tr && v.by_age ? 4 : tr ? 3 : v.by_age ? 2 : v.by_birth_year ? 1 : 0);
}
export function pickVariantField(vs: TextVariant[] | undefined, f: keyof TextVariant, c: VariantCtx): string | undefined {
  if (!vs?.length) return undefined;
  const ok = vs.map((v, k) => ({ v, k, r: variantRank(v, c) })).filter((x) => x.r >= 0).sort((a, b) => b.r - a.r || a.k - b.k);
  const has = ok.filter((x) => typeof x.v[f] === 'string'); if (!has.length) return undefined;
  const top = has.filter((x) => x.r === has[0].r);
  if (top.length > 1 && top.some((x) => x.v.weight !== undefined)) { const tot = top.reduce((a, x) => a + (x.v.weight ?? 1), 0); let u = (c.roll ?? 0) * tot;
    for (const x of top) { u -= x.v.weight ?? 1; if (u < 0) return x.v[f] as string; } }
  return top[0].v[f] as string;
}
