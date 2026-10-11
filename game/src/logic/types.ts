export type StatId = 'academic' | 'happiness' | 'stress' | 'health' | 'social' | 'wealth';
export const STATS: StatId[] = ['academic', 'happiness', 'stress', 'health', 'social', 'wealth'];
export const STAT_NAMES: Record<StatId, string> = {
  academic: '學業', happiness: '快樂', stress: '壓力', health: '健康', social: '關係', wealth: '家庭資源',
};
export type StageId = 'infant' | 'elementary' | 'junior' | 'senior' | 'adult';
export const STAGE_NAMES: Record<StageId, string> = {
  infant: '幼兒', elementary: '小學', junior: '國中', senior: '高中', adult: '青年',
};

export interface Requires {
  flags_all?: string[]; flags_none?: string[];
  stats_min?: Partial<Record<string, number>>; stats_max?: Partial<Record<string, number>>;
  county_tags_any?: string[];
}
export interface Choice {
  text: string; requires?: Requires; lock_text?: string;
  effects?: Partial<Record<string, number>>; hidden?: { effort?: number; regret?: number };
  set_flags?: string[]; result_text?: string;
}
export interface GameEvent {
  id: string; stage: StageId | 'any'; type: 'random' | 'branch' | 'forced';
  title: string; text: string; weight?: number; once?: boolean;
  conditions?: Requires; choices: Choice[]; album?: { caption: string; priority: number };
}
export interface County {
  id: string; name: string; birth_weight: number; income_vs_taiwan: number;
  academic_mod: number; cram_cost_mult: number; social_mod: number; event_tags: string[];
  /** 落在全國所得五分位 Q1–Q5 的比例（有就直接抽，否則用 α 偏移法） */
  income_quintile_dist?: number[];
}
export interface Ending { id: string; title: string; regret_low: string; regret_high: string }
export interface Tier { min: number; text: string }
export interface Mountain {
  id: string; title: string; text: string; hint?: string;
  condition?: { priority?: number; fallback?: boolean; all?: Record<string, number>; any?: Record<string, number> };
}
export interface EndingsData {
  endings: Ending[];
  review: { effort_reveal: Tier[]; regret_reveal: Tier[]; three_mountains: Mountain[] };
}
export interface BirthYear { roc_year: number; weight: number; births?: number; ad_year?: number }
export interface EraSegment { from: number; to: number; terms: Record<string, string> }
export interface GameData {
  birthYears: BirthYear[]; eraTerms: EraSegment[];
  /** 開局旁白，key = Q1..Q5 */
  opening: Record<string, string>;
  balance: import('./balance').Balance;
  events: GameEvent[]; endings: EndingsData; counties: County[]; countiesSource: 'counties.json' | 'fallback';
  /** 階段旁白樣板，key = stage id；內容含 {變數} */
  narration: Partial<Record<StageId, string>>;
}
