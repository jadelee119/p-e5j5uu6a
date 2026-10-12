// 無頭模擬：npm run sim [-- 次數 種子]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGameData } from '../src/logic/load';
import { Game, TURNS, type ActionId } from '../src/logic/engine';
import { makeRng } from '../src/logic/rng';
import { balanceKeyReport } from '../src/logic/balance';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rj = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const evDir = join(root, 'data/events');
const data = buildGameData({
  eventFiles: readdirSync(evDir).filter((f) => f.endsWith('.json')).map((f) => rj(`data/events/${f}`)),
  endings: rj('data/endings.json'),
  countiesJson: existsSync(join(root, 'data/counties.json')) ? rj('data/counties.json') : undefined,
  balance: rj('data/balance.json'),
  birthYears: rj('data/birth_years.json'),
  eraTerms: rj('data/era_terms.json'),
  opening: existsSync(join(root, 'data/opening.json')) ? rj('data/opening.json') : undefined,
  narrationMd: readFileSync(join(root, 'writing/stage_narrations.md'), 'utf8'),
});

const keyRep = balanceKeyReport(rj('data/balance.json'));
const N = Number(process.argv[2] ?? 1000); const baseSeed = Number(process.argv[3] ?? 12345);
const pol = makeRng(baseSeed ^ 0x9e3779b9);
const count = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
const byCounty = new Map<string, Map<string, number>>(), byQuint = new Map<string, Map<string, number>>();
const cq = new Map<string, number[]>();
const birthYrs = new Map<string, number>(), examNames = new Map<string, number>();
const endings = new Map<string, number>(), byQ = new Map<string, number>(), mountains = new Map<string, number>(),
  counties = new Map<string, number>(), branches = new Map<string, number>(), notes = new Map<string, number>();
const tagged = data.events.filter((e) => e.conditions?.county_tags_any?.length);
const fired = new Map<string, Map<string, number>>(); let sumPov = 0;
let sumEffort = 0, sumRegret = 0, sumBreak = 0;
const sumStats: Record<string, number> = {};

const ACH = JSON.parse(readFileSync(join(root, 'data', 'achievements.json'), 'utf8')).achievements as { id: string; name: string }[];
const achCount = new Map<string, number>();
for (let i = 0; i < N; i++) {
  const g = new Game(data, baseSeed + i);
  let guard = 0;
  while (g.s.phase !== 'ending' && guard++ < 500) {
    const p = g.s.phase;
    if (p === 'ap') {
      const alloc: Partial<Record<ActionId, number>> = {};
      const acts = g.availableActions();
      let w = g.s.stats.wealth;
      for (let k = 0; k < g.apForTurn(); k++) {
        const ok = acts.filter((a) => !g.actionLock(a.id, w));
        const a = ok[Math.floor(pol.next() * ok.length)];
        alloc[a.id] = (alloc[a.id] ?? 0) + 1;
        if (a.id === 'cram') w -= 5; if (a.id === 'talent') w -= 4; if (a.id === 'work') w += 4;
      }
      g.applyActions(alloc);
    } else if (p === 'event') {
      const ch = g.s.current!.event.choices.map((c, idx) => ({ c, idx })).filter((x) => !g.choiceLocked(x.c));
      g.choose(ch[Math.floor(pol.next() * ch.length)].idx);
    } else if (p === 'result') g.continueAfterResult();
    else if (p === 'summary') g.ackSummary();
  }
  const e = g.ending(); const r = g.review();
  for (const id of g.achievementsMet(ACH)) achCount.set(id, (achCount.get(id) ?? 0) + 1);
  count(endings, e.title + (e.regretHigh ? '（高遺憾）' : '（低遺憾）'));
  count(byQ, `Q${g.s.quintile} → ${e.title}`);
  for (const [m, k] of [[byCounty, g.s.county.name], [byQuint, `Q${g.s.quintile}`]] as const) { if (!m.has(k)) m.set(k, new Map()); count(m.get(k)!, e.title); }
  count(mountains, r.mountain?.title ?? '?'); count(counties, g.s.county.name);
  for (const f of g.s.flags) if (/^(path_|hs_|track_|uni_|military|work_first)/.test(f)) count(branches, f);
  for (const n of new Set(g.s.notes.map((n) => n.replace(/回合 \d+/, '回合 N')))) count(notes, n);
  for (const e of tagged) if (g.s.seenEvents.has(e.id)) { if (!fired.has(e.id)) fired.set(e.id, new Map()); count(fired.get(e.id)!, g.s.county.name); }
  sumPov += g.s.povertyTurns;
  if (!cq.has(g.s.county.name)) cq.set(g.s.county.name, [0, 0, 0, 0, 0]); cq.get(g.s.county.name)![g.s.quintile - 1]++;
  count(birthYrs, `民國 ${g.s.birthYear} 年`); count(examNames, g.eraTerms().exam_name ?? '(未定義)');
  sumEffort += g.s.effort; sumRegret += g.s.regret; sumBreak += g.s.breakdowns;
  for (const [k, v] of Object.entries(g.s.stats)) sumStats[k] = (sumStats[k] ?? 0) + v;
}
const show = (title: string, m: Map<string, number>) => {
  console.log(`\n== ${title} ==`);
  [...m.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`${k.padEnd(24, '　')} ${String(v).padStart(5)}  ${(v / N * 100).toFixed(1)}%`));
};
console.log(`模擬 ${N} 輪（隨機策略，seed ${baseSeed}），回合數 ${TURNS.length}，縣市資料：${data.countiesSource}`);
const agg = new Map<string, number>(); for (const [k, v] of endings) { const t = k.replace(/（.*）/, ''); agg.set(t, (agg.get(t) ?? 0) + v); }
show('結局分布', agg); show('結局 × 遺憾變體', endings); show('看山三境', mountains);
show('出生縣市', counties); show('分岔旗標', branches);
console.log(`\n平均 effort ${(sumEffort / N).toFixed(1)}、regret ${(sumRegret / N).toFixed(1)}、崩潰次數 ${(sumBreak / N).toFixed(2)}`);
console.log('22 歲平均屬性：' + Object.entries(sumStats).map(([k, v]) => `${k} ${(v / N).toFixed(1)}`).join('、'));
const titles = data.endings.endings.map((x) => x.title);
const matrix = (title: string, m: Map<string, Map<string, number>>, order?: string[]) => {
  console.log(`\n== ${title}（列內百分比） ==`);
  console.log(['', 'n', ...titles].join('\t'));
  for (const k of order ?? [...m.keys()]) { const row = m.get(k); if (!row) continue;
    const n = [...row.values()].reduce((a, b) => a + b, 0);
    console.log([k, n, ...titles.map((t) => ((row.get(t) ?? 0) / n * 100).toFixed(1) + '%')].join('\t')); }
};
console.log('\n== 縣市 × 所得分位：模擬 vs 目標（income_quintile_dist）==');
console.log(['', 'n', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', '最大差'].join('\t'));
for (const c of data.counties) { const row = cq.get(c.name) ?? [0, 0, 0, 0, 0]; const n = row.reduce((a, b) => a + b, 0) || 1;
  const tgt = c.income_quintile_dist; let maxd = 0;
  const cells = row.map((v, i) => { const o = v / n * 100; const t = tgt ? tgt[i] * 100 : NaN; if (tgt) maxd = Math.max(maxd, Math.abs(o - t)); return `${o.toFixed(0)}/${tgt ? t.toFixed(0) : '-'}`; });
  console.log([c.name, n, ...cells, tgt ? maxd.toFixed(1) + 'pt' : '(α 偏移)'].join('\t')); }
matrix('出生縣市 × 結局', byCounty, data.counties.map((c) => c.name));
matrix('所得分位 × 結局', byQuint, ['Q1', 'Q2', 'Q3', 'Q4', 'Q5']);
void byQ;
console.log(`\n== 縣市專屬卡觸發率（觸發輪數 / 該縣市輪數）==`);
const cn = new Map(data.counties.map((c) => [c.name, byCounty.get(c.name) ? [...byCounty.get(c.name)!.values()].reduce((a, b) => a + b, 0) : 0]));
let leak = 0;
for (const e of tagged) {
  const ok = data.counties.filter((c) => e.conditions!.county_tags_any!.some((t) => c.event_tags.includes(t))).map((c) => c.name);
  const f = fired.get(e.id) ?? new Map();
  const parts = data.counties.map((c) => { const n = f.get(c.name) ?? 0; if (n && !ok.includes(c.name)) leak += n; return n || ok.includes(c.name) ? `${c.name} ${n}/${cn.get(c.name)}(${((n / (cn.get(c.name) || 1)) * 100).toFixed(0)}%)` : ''; }).filter(Boolean);
  console.log(`${e.id} [${e.conditions!.county_tags_any!.join(',')}] → ${parts.join('、') || '從未觸發'}`);
}
console.log(leak ? `⚠ 有 ${leak} 次觸發在不符標籤的縣市` : '標籤篩選正確：沒有卡片出現在不符的縣市');
console.log(`平均經濟壓力回合數 ${(sumPov / N).toFixed(2)}`);
console.log(`balance.json 鍵名檢查：引擎不認得 ${JSON.stringify(keyRep.unknown)}；使用內建預設 ${JSON.stringify(keyRep.defaulted)}`);
show('出生年', new Map([...birthYrs].sort()));
show('升學考試名稱 exam_name', examNames);

// 文案變數掃描：每個出生年把所有文字代入一次，找殘留的 {變數}
console.log('\n== 文案變數掃描（每個出生年）==');
const allTexts: [string, string][] = [];
for (const e of data.events) {
  allTexts.push([`${e.id}.title`, e.title], [`${e.id}.text`, e.text]);
  if (e.album?.caption) allTexts.push([`${e.id}.album`, e.album.caption]);
  e.choices.forEach((c, i) => { for (const k of ['text', 'lock_text', 'result_text'] as const) if (c[k]) allTexts.push([`${e.id}.choices[${i}].${k}`, c[k]!]); });
}
for (const en of data.endings.endings) allTexts.push([`ending.${en.id}.low`, en.regret_low], [`ending.${en.id}.high`, en.regret_high], [`ending.${en.id}.title`, en.title]);
const rv = data.endings.review;
[...rv.effort_reveal, ...rv.regret_reveal].forEach((x, i) => allTexts.push([`review.tier${i}`, x.text]));
rv.three_mountains.forEach((m) => allTexts.push([`mountain.${m.id}`, m.title + m.text]));
for (const [st, tpl] of Object.entries(data.narration)) allTexts.push([`narration.${st}`, tpl!]);
for (const [q, tpl] of Object.entries(data.opening)) allTexts.push([`opening.${q}`, tpl]);
let leftovers = 0;
for (const y of data.birthYears.map((b) => b.roc_year)) {
  const g = new Game(data, 1, { birthYear: y });
  const nv = { ...g.narrationVars('junior'), album_caption: '（相簿）' };
  const bad = allTexts.map(([k, txt]) => [k, (g.t(txt, nv).match(/\{\w*\}/g) ?? []).filter((m) => m !== '{}')] as const).filter(([, m]) => m.length);
  leftovers += bad.length;
  console.log(`民國 ${y}（${g.eraTerms().exam_name ?? '-'}）：${bad.length ? bad.map(([k, m]) => `${k} ${m.join(',')}`).join('；') : '無殘留'}`);
}
console.log(leftovers ? `⚠ 共 ${leftovers} 處殘留變數` : `全部 ${allTexts.length} 段文字、${data.birthYears.length} 個出生年皆無殘留變數`);
if (notes.size) show('引擎提示（事件池耗盡等，輪數）', notes);

console.log('\n== 成就達成率 ==');
for (const a of ACH) console.log(`${a.name}\t${(((achCount.get(a.id) ?? 0) / N) * 100).toFixed(1)}%`);
