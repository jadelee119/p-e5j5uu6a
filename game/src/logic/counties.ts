import type { County } from './types';

/**
 * 【暫代資料 PLACEHOLDER】data/counties.json 尚未產出時使用。
 * birth_weight / income_vs_taiwan 取自 data/counties_raw.csv（113 年出生數、2025 年可支配所得）；
 * 注意：出生權重應改用民國 80–89 年資料（數據研究員處理中）。
 * academic_mod / cram_cost_mult / social_mod 皆為中性值，event_tags 為工程師暫定。
 */
export const FALLBACK_COUNTIES: County[] = [
  { id: 'taipei', name: '臺北市', birth_weight: 0.3293, income_vs_taiwan: 1.284, academic_mod: 0, cram_cost_mult: 1, social_mod: 0, event_tags: ['metro'] },
  { id: 'new_taipei', name: '新北市', birth_weight: 0.3141, income_vs_taiwan: 1.044, academic_mod: 0, cram_cost_mult: 1, social_mod: 0, event_tags: ['metro'] },
  { id: 'taichung', name: '臺中市', birth_weight: 0.3113, income_vs_taiwan: 1.005, academic_mod: 0, cram_cost_mult: 1, social_mod: 0, event_tags: ['metro'] },
  { id: 'taitung', name: '臺東縣', birth_weight: 0.0303, income_vs_taiwan: 0.682, academic_mod: 0, cram_cost_mult: 1, social_mod: 0, event_tags: ['rural'] },
  { id: 'penghu', name: '澎湖縣', birth_weight: 0.0149, income_vs_taiwan: 0.789, academic_mod: 0, cram_cost_mult: 1, social_mod: 0, event_tags: ['island'] },
];

/** 寬鬆解析 counties.json：接受陣列或 { counties: [...] }，欄位缺漏時補中性值。 */
export function normalizeCounties(raw: unknown): County[] | null {
  const arr: any[] | undefined = Array.isArray(raw) ? raw : (raw as any)?.counties;
  if (!Array.isArray(arr) || !arr.length) return null;
  return arr.map((c) => ({
    id: String(c.id), name: String(c.name ?? c.id),
    birth_weight: Number(c.birth_weight ?? c.weight ?? 1),
    income_vs_taiwan: Number(c.income_vs_taiwan ?? c.income_ratio ?? 1),
    academic_mod: Number(c.academic_mod ?? 0), cram_cost_mult: Number(c.cram_cost_mult ?? 1),
    social_mod: Number(c.social_mod ?? 0), event_tags: Array.isArray(c.event_tags) ? c.event_tags : [],
    income_quintile_dist: Array.isArray(c.income_quintile_dist) && c.income_quintile_dist.length === 5 ? c.income_quintile_dist.map(Number) : undefined,
  }));
}
