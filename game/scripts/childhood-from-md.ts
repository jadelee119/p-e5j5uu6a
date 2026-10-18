// 把劇情文案的童年記憶牌（writing/v1.2_childhood_memory_cards.md）轉成 data/deck/childhood.json（格式：design/v1.2-spec.md §1.5）
// 用法：npx tsx scripts/childhood-from-md.ts
// 文字以 md 為準；洗入（adds）照規格 §1.4 企劃表；權重等級依文案「家境傾向」對應到規格 §1.3 的 key
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const md = readFileSync(join(root, 'writing/v1.2_childhood_memory_cards.md'), 'utf8');
const outPath = join(root, 'data/deck/childhood.json');
const prev = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : {};
/** 規格 §1.4 ★：企劃改過的洗入 */
const ADDS_OVERRIDE: Record<string, string[]> = { mem_09_study_a: ['d_study'], mem_12_study_a: ['d_study'] };
/** 規格 §1.3：偏鄉加權 */
const COUNTY: Record<string, Record<string, number>> = { mem_06_exercise_a: { rural: 1.2, remote: 1.2, 偏鄉: 1.2 } };
function level(t: string): string {
  if (/Q4–Q5 高/.test(t)) return 'rich';
  if (/Q1–Q3 高/.test(t)) return 'poor';
  if (/Q3–Q5 稍高/.test(t)) return 'mid_up_slight';
  if (/Q3–Q5 高、Q1–Q2 中低/.test(t)) return 'mid_up';
  if (/Q3–Q5 高、Q1–Q2 中/.test(t)) return 'mid_up_soft';
  if (/各分位均等/.test(t)) return 'equal';
  throw new Error(`認不得的家境傾向：${t}`);
}
const body = md.split(/^## 備用牌/m)[0];
const memories: any[] = [];
for (const sec of body.split(/^### /m).slice(1)) {
  const m = sec.split('\n')[0].match(/^(mem_(\d+)_\w+)｜(\w+)/); if (!m) continue;
  const f = (k: string) => sec.match(new RegExp(`^- ${k}：(.*)$`, 'm'))?.[1].trim();
  const adds = ADDS_OVERRIDE[m[1]] ?? [...(f('建議洗入') ?? '').replace(/[（(].*$/, '').matchAll(/[a-z][a-z0-9_]+/g)].map((x) => x[0]);
  const tend = f('家境傾向') ?? '';
  const old = prev.memories?.find((x: any) => x.id === m[1]);
  memories.push({ id: m[1], act: Number(m[2]), category: m[3], name: f('牌名'), situation: f('處境'), consequence: f('後果'), adds, flag: m[1],
    weight: level(tend), weight_if_county_tags: COUNTY[m[1]] ?? {}, by_birth_year: old?.by_birth_year ?? [], art: m[1], echo_hook: f('回聲'),
    ...(/⚠️待查/.test(sec) ? { todo: '⚠️待查（見文案稿）' } : {}) });
}
const out = {
  _note: 'v1.2 童年序章（design/v1.2-spec.md §1）。由 game/scripts/childhood-from-md.ts 從 writing/v1.2_childhood_memory_cards.md 產生（改文字請改 md 再重跑）；洗入照規格 §1.4，權重等級照規格 §1.3（假設值，沒有統計依據）。echo_hook 只給回音牌參考，不上牌面。',
  ages: [6, 9, 12],
  acts: { '6': { label: '剛上小學', era_band: [6, 8] }, '9': { label: '小學中年級', era_band: [9, 11] }, '12': { label: '小學快畢業', era_band: [12, 12] } },
  draw: 3, pick: 1, distinct_categories: true, show_consequence: 'before',
  categories: { study: { name: '讀書', fallback_add: 'd_study' }, play: { name: '玩樂', fallback_add: 'd_play' }, exercise: { name: '運動', fallback_add: 'd_exercise' },
    talent: { name: '才藝', fallback_add: 's_club_jr' }, work: { name: '顧家', fallback_add: 'g_mature' } },
  weight_levels: { equal: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }, mid_up_slight: { 1: 0.7, 2: 0.7, 3: 1.2, 4: 1.2, 5: 1.2 }, mid_up: { 1: 0.7, 2: 0.7, 3: 1.5, 4: 1.5, 5: 1.5 },
    mid_up_soft: { 1: 1, 2: 1, 3: 1.5, 4: 1.5, 5: 1.5 }, rich: { 1: 0.5, 2: 0.5, 3: 1, 4: 1.5, 5: 1.5 }, poor: { 1: 1.5, 2: 1.5, 3: 1.5, 4: 0.5, 5: 0.5 } },
  memories,
  summary: prev.summary ?? { _todo: 'TODO-writer：總結頁 6 句（規格 §4.2）', all_same: { study: '', play: '', exercise: '', talent: '', work: '' }, mixed: '' },
};
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`寫入 ${memories.length} 張記憶牌：` + [6, 9, 12].map((a) => `${a} 歲 ${memories.filter((x) => x.act === a).length}`).join('、'));
