import type { StageId } from './types';

/**
 * 平衡參數。data/balance.json 為唯一來源；以下 DEFAULT_BALANCE 只補 balance.json 尚未定義的鍵
 * （§3/§6 規格值：AP、強制事件門檻、所得分位表、分位偏移強度），並在 balance.json 有同名鍵時被覆蓋。
 */
export interface ActionBalance {
  effects: Record<string, number>; effort?: number; regret?: number; from: StageId;
  wealth_scaled_by?: 'cram_cost_mult'; requires_wealth?: number; flag_after?: { points: number; flag: string };
}
export interface Balance {
  actions: Record<string, ActionBalance>;
  passive_per_turn: { poverty_pressure?: { wealth_below: number; effects: Record<string, number> }; all: Record<string, number>; stage_extra: Partial<Record<StageId, Record<string, number>>>; wealth_by_quintile: Record<string, number> };
  endings: {
    burnout: { breakdowns_min: number; health_max: number };
    golden_cage: { flags_all?: string[]; flags_any?: string[]; happiness_max: number };
    against_odds: { quintile_max: number; flags_any?: string[]; or_wealth_min?: number; effort_min: number };
    ordinary_good: { happiness_min: number; social_min: number };
    regret_high_threshold: number;
  };
  ap_by_stage: Record<StageId, number>;
  forced: { breakdown_stress_min: number; breakdown_effects: Record<string, number>; breakdown_ap_penalty: number; sick_health_max: number };
  quintiles: Record<string, { wealth: number; mods: Record<string, number>; flags: string[] }>;
  quintile_shift_alpha: number;
  initial_stats: Record<string, number>;
}

export const DEFAULT_BALANCE: Omit<Balance, 'actions' | 'passive_per_turn' | 'endings'> = {
  ap_by_stage: { infant: 0, elementary: 3, junior: 4, senior: 4, adult: 5 },
  forced: { breakdown_stress_min: 90, breakdown_effects: { health: -15, happiness: -20 }, breakdown_ap_penalty: 1, sick_health_max: 10 },
  quintiles: {
    '1': { wealth: 10, mods: { social: 5 }, flags: [] },
    '2': { wealth: 25, mods: {}, flags: [] },
    '3': { wealth: 45, mods: {}, flags: [] },
    '4': { wealth: 65, mods: { stress: 5 }, flags: [] },
    '5': { wealth: 85, mods: { stress: 10 }, flags: ['golden_spoon'] },
  },
  quintile_shift_alpha: 2,
  initial_stats: { academic: 20, happiness: 60, stress: 10, health: 70, social: 50 },
};

export function buildBalance(raw: any): Balance {
  if (!raw?.actions || !raw?.passive_per_turn || !raw?.endings) throw new Error('data/balance.json 缺少 actions / passive_per_turn / endings');
  return { ...DEFAULT_BALANCE, ...raw } as Balance;
}
const KNOWN_KEYS = ['actions', 'passive_per_turn', 'endings', ...Object.keys(DEFAULT_BALANCE)];
/** 回報 balance.json 與引擎鍵名差異：unknown = 引擎不認得；defaulted = 檔案缺、用內建預設 */
export function balanceKeyReport(raw: any) {
  const keys = Object.keys(raw ?? {}).filter((k) => !k.startsWith('_'));
  return { unknown: keys.filter((k) => !KNOWN_KEYS.includes(k)), defaulted: Object.keys(DEFAULT_BALANCE).filter((k) => !(k in (raw ?? {}))) };
}
