// v1.2 驗收：npx tsx sim/deckcheck12.ts [每格局數 N=1000] [種子=2026] [公平性每格局數=1000；企劃：300 太吵，正式驗收至少 1000] [時代牌抽樣局數=3000] [§6.1 指標每種子每打法局數=5000，0＝不跑]
// 一律開 adult＋v12（規格 §6.2）。v1.1 的檢查照舊用 sim/deckcheck.ts。
// 檢查：規格 §1.7（序章）、§2.7（包袱）、§3（回合數）、era-cards §10（時代牌）、文字變數、成就旗標。門檻在 data/deck/v12.json checks（設計假設）。
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGameData } from '../src/logic/load';
import { DeckGame, botSchoolChoice, botBranchChoice, botHousingChoice, botMemoryPick, burdenValue, type CardDef, type DeckConfig, type Inst } from '../src/logic/deck';
import { makeRng, type Rng } from '../src/logic/rng';
import { STATS, type StatId } from '../src/logic/types';
import { buildEraSchedule, eraSlots, eraTier, loadTimeline, placeholders, resolveEraCards, type ChildhoodData, type EraData, type V12Config } from '../src/logic/v12';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rj = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const data = buildGameData({
  eventFiles: readdirSync(join(root, 'data/events')).filter((f) => f.endsWith('.json')).map((f) => rj(`data/events/${f}`)),
  endings: rj('data/endings.json'), countiesJson: rj('data/counties.json'), balance: rj('data/balance.json'),
  birthYears: rj('data/birth_years.json'), eraTerms: rj('data/era_terms.json'), opening: rj('data/opening.json'),
  narrationMd: readFileSync(join(root, 'writing/stage_narrations.md'), 'utf8'),
});
const cfg = rj('data/deck/config.json') as DeckConfig & { v12?: V12Config }; const V12 = rj('data/deck/v12.json') as V12Config; cfg.v12 = V12;
const cards = [...rj('data/deck/cards.json').cards, ...rj('data/deck/cards_adult.json').cards, ...rj('data/deck/cards_v12.json').cards] as CardDef[];
const childhood = rj('data/deck/childhood.json') as ChildhoodData; const era = rj('data/deck/era_cards.json') as EraData;
const timeline = loadTimeline(rj('data/timeline.json')); const scenes = rj('data/deck/scenes.json').scenes;
const eraVariants = rj('data/era_terms.json').deck_card_variants;
const ACH = rj('data/achievements.json').achievements as { id: string; conditions?: Record<string, unknown> }[];
const N = Number(process.argv[2] ?? 1000), seed0 = Number(process.argv[3] ?? 2026), NF = Number(process.argv[4] ?? 1000), NE = Number(process.argv[5] ?? 3000), N61 = Number(process.argv[6] ?? 5000);
const TH = V12.checks ?? {}; const th = (k: string, d: number) => (TH[k] as number | undefined) ?? d;
const COUNTIES = ['taipei', 'new_taipei', 'taichung', 'taitung', 'penghu']; const YEARS = [80, 81, 82, 83, 84, 85, 86, 87, 88, 89];
let fail = 0, warn = 0;
const chk = (name: string, ok: boolean, detail = '') => { console.log(`${ok ? '✅' : '❌'} ${name}${detail ? '：' + detail : ''}`); if (!ok) fail++; };
const note = (name: string, detail: string) => { console.log(`⚠️  ${name}：${detail}`); warn++; };
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

type Opt = { q?: number; county?: string; birthYear?: number; prologue?: 'play' | 'skip'; noEra?: boolean };
function newGame(seed: number, o: Opt = {}) {
  for (let s = seed; ; s += 7919) {
    const g = new DeckGame(data, cfg, cards, s, eraVariants, { adult: true, v12: true, childhood, era: o.noEra ? undefined : era, timeline, scenes, birthYear: o.birthYear, prologue: o.prologue });
    if ((o.q === undefined || g.quintile === o.q) && (o.county === undefined || g.base.s.county.id === o.county)) return g;
  }
}
type Policy = 'passive' | 'full' | 'greedy' | 'worst' | 'burden_first';
const value = (g: DeckGame, i: Inst) => g.card(i).sticky ? burdenValue(g, i) : g.scoreValue(i) / Math.max(1, g.costOf(i) ?? 1);
/** 一回合的出牌（規格 §2.6） */
function playTurn(g: DeckGame, pol: Policy, r: Rng) {
  const limit = pol === 'passive' ? r.int(0, 1) : Infinity; let k = 0;
  while (k < limit) { const p = g.playable(); if (!p.length) break; let i: Inst;
    const sticky = p.filter((x) => g.card(x).sticky);
    if (pol === 'burden_first' && sticky.length) i = sticky[0];
    else if (pol === 'full' && sticky.some((x) => g.card(x).trigger_after && (g.heldTurns.get(x.uid) ?? 0) === g.card(x).trigger_after! - 1)) i = sticky.find((x) => g.card(x).trigger_after && (g.heldTurns.get(x.uid) ?? 0) === g.card(x).trigger_after! - 1)!;
    else if (pol === 'greedy') i = p.reduce((m, x) => value(g, x) > value(g, m) ? x : m);
    else if (pol === 'worst') { const q = p.filter((x) => !g.card(x).sticky || g.costOf(x) !== null); i = q.reduce((m, x) => value(g, x) < value(g, m) ? x : m); }
    else i = p[Math.floor(r.next() * p.length)];
    g.play(i.uid); k++; }
}
const CH = makeRng(0x5c4001), BR = makeRng(0xb2a7c4), HO = makeRng(0x40a5e), BK = makeRng(0xb4e4);
interface Hooks { onTurn?: (g: DeckGame) => void; onPrologueEnd?: (g: DeckGame) => void }
function playRun(g: DeckGame, pol: Policy, r: Rng, mem = 'random', h: Hooks = {}) {
  if (g.phase === 'prologue' || g.phase === 'prologueSummary') { while (g.phase === 'prologue') botMemoryPick(g, r, mem); if (g.phase === 'prologueSummary') { h.onPrologueEnd?.(g); g.startSchool(); } }
  while (g.phase !== 'review') {
    if (g.phase === 'choice') { g.chooseSchool(botSchoolChoice(g, CH)); continue; } if (g.phase === 'branch') { g.chooseBranch(botBranchChoice(g, BR)); continue; }
    if (g.phase === 'housing') { g.chooseHousing(botHousingChoice(g, HO)); continue; } if (g.phase === 'break') { g.pickBreak(g.breakOffer[Math.floor(BK.next() * g.breakOffer.length)]); continue; }
    h.onTurn?.(g); playTurn(g, pol, r); g.endYear();
  }
  return g;
}
const W = () => g0.cfg.score.weights; const effScore = (e?: Partial<Record<StatId, number>>) => Object.entries(e ?? {}).reduce((a, [k, v]) => a + (typeof v === 'number' ? (W()[k as StatId] ?? 0) * v : 0), 0);

// ===== 0. 靜態檢查 =====
console.log(`v1.2 deckcheck・N=${N}・種子 ${seed0}・公平性 ${NF}・時代牌 ${NE}`);
if (NF < 1000) console.log(`   （公平性每格只跑 ${NF} 局，低於企劃要求的 1000，條件 A／同類等強只當參考）`);
const g0 = newGame(seed0);
{
  const bad = [...g0.cards.values()].filter((c) => c.burden_class === 'expectation' && c.cost != null).map((c) => c.id);
  chk('不變式・期待類包袱 cost 一定是 null', !bad.length, bad.join(',') || `${[...g0.cards.values()].filter((c) => c.burden_class === 'expectation').length} 張`);
  const todo = [...g0.cards.values()].filter((c) => c.todo_writer).map((c) => c.id);
  if (todo.length) note('待劇情文案（TODO-writer，出貨前要補）', todo.join(','));
}
// 文字變數
{
  const known = new Set([...Object.keys(g0.base.textVars()), 'city', 'branch_not_taken']); const unk: string[] = [];
  const scan = (where: string, o: unknown) => { if (typeof o === 'string') { for (const p of placeholders(o)) if (!known.has(p)) unk.push(`${where}{${p}}`); }
    else if (Array.isArray(o)) o.forEach((x, k) => scan(`${where}[${k}]`, x)); else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (!k.startsWith('_')) scan(`${where}.${k}`, v); };
  for (const c of g0.cards.values()) scan(c.id, c); scan('scenes', scenes); scan('childhood', childhood.memories); scan('era', era.cards); scan('era.review_only', era.review_only);
  chk('文字變數都認得', !unk.length, unk.length ? unk.slice(0, 12).join('、') : `已知：${[...known].join('、')}`);
}

// ===== 1. 序章（§1.7 第 1、2 點） =====
{
  const catMin = th('prologue_category_min', 0.35), cardMin = th('prologue_card_min', 0.05); const T = 20000; let distinct = true; const lows: string[] = [];
  for (const q of [1, 2, 3, 4, 5]) { const g = newGame(seed0 + q, { q });
    for (const age of childhood.ages) { const cat: Record<string, number> = {}, card: Record<string, number> = {};
      for (let n = 0; n < T; n++) { const o = g.drawOffer(age); if (new Set(o.map((m) => m.category)).size !== o.length) distinct = false;
        for (const m of o) { cat[m.category] = (cat[m.category] ?? 0) + 1; card[m.id] = (card[m.id] ?? 0) + 1; } }
      for (const c of Object.keys(childhood.categories)) if ((cat[c] ?? 0) / T < catMin) lows.push(`Q${q} ${age} 歲 類別 ${c} ${pct((cat[c] ?? 0) / T)}`);
      for (const m of childhood.memories.filter((x) => x.act === age)) if ((card[m.id] ?? 0) / T < cardMin) lows.push(`Q${q} ${age} 歲 ${m.id} ${pct((card[m.id] ?? 0) / T)}`); } }
  chk('序章・每次三張都不同類（不變式）', distinct);
  chk(`序章・每類 ≥ ${pct(catMin)}、每張 ≥ ${pct(cardMin)}（每分位每幕 ${T} 次）`, !lows.length, lows.slice(0, 8).join('；'));
}

// ===== 2. 回合、包袱（§2.7、§3） =====
const route: Record<string, number> = {}, track: Record<string, number> = {}; let achHits: Record<string, number> = {}; let achUnsupported: string[] = []; let workedTeen = 0, played = 0; const vocUni = [0, 0]; const endings: Record<string, number> = {}; let voc19 = 0, voc19Turns = 0; const vocBy: Record<string, [number, number]> = {};
let hands = 0, runs = 0, clubJr = 0, maxSticky = 0;
const actionAvg = (() => { const a = [...g0.cards.values()].filter((c) => c.type === 'action' && c.cost); return a.reduce((s, c) => s + effScore(c.effects) / c.cost!, 0) / a.length; })();
const burdenIdx: Record<number, number> = {}; const deadlock: string[] = []; let expectRuns = 0, expectLeft = 0;
for (const pol of ['full', 'passive', 'greedy', 'worst'] as Policy[]) for (const q of [1, 2, 3, 4, 5]) {
  const r = makeRng(seed0 ^ (q * 131 + pol.length * 7)); let dealt = 0, stuck = 0, streak3 = 0, idx = 0, sum = 0;
  const n = pol === 'full' || pol === 'passive' ? N : Math.max(100, N >> 2);
  for (let k = 0; k < n; k++) { const g = playRun(newGame(seed0 + k * 104729 + q, { q }), pol, r, 'random', pol === 'full' ? { onTurn: (x) => { if (x.age >= 19 && (x.schoolTrack === 'hs_vocational' || x.schoolTrack === 'hs_5yr')) { voc19Turns++; if (x.hand.some((i) => i.id === 'voc_license')) voc19++; }
    if (x.age >= 19 && (x.schoolTrack === 'hs_vocational' || x.schoolTrack === 'hs_5yr')) { const kk = `${x.schoolTrack === 'hs_5yr' ? '五專' : '高職'}→${x.route ? x.routeName(x.route) : '未分流'}`; const v = (vocBy[kk] ??= [0, 0]); v[1]++; if (x.hand.some((i) => i.id === 'voc_license')) v[0]++; } } } : {});
    const s = g.stat12; dealt += s.dealt; stuck += s.stuck; if (s.maxStuckStreak >= 3) streak3++; maxSticky = Math.max(maxSticky, s.maxSticky); clubJr += s.clubJrAfter16;
    idx += (s.handleSlots * actionAvg + s.heldLoss + s.fuseLoss) / Math.max(1, g.turnsDone); sum += g.score();
    if (pol === 'full') { hands += g.turnsDone + childhood.ages.length; runs++; route[g.route ?? 'none'] = (route[g.route ?? 'none'] ?? 0) + 1; track[g.schoolTrack ?? 'none'] = (track[g.schoolTrack ?? 'none'] ?? 0) + 1; const en = g.endingId() ?? 'none'; endings[en] = (endings[en] ?? 0) + 1; if (g.schoolTrack === 'hs_vocational') { vocUni[1]++; if (g.route === 'uni') vocUni[0]++; }
      const a = g.achievementsMet(ACH); for (const id of a.met) achHits[id] = (achHits[id] ?? 0) + 1; achUnsupported = a.unsupported; played++;
      if (g.flags.has('worked_teen')) workedTeen++;
      if (q === 5 && (g.burdenLeft['b_expect'] !== undefined || g.playCount['b_expect'] !== undefined || g.flags.has('b_expect_seen'))) { expectRuns++; if ((g.burdenLeft['b_expect'] ?? 0) > 0) expectLeft++; } }
  }
  if (pol === 'full') burdenIdx[q] = idx / n;
  if (pol === 'full' || pol === 'passive') { const dr = stuck / Math.max(1, dealt), sr = streak3 / n;
    if (dr > th('deadlock_turn_max', 0.05) || sr > th('deadlock_streak3_run_max', 0.02)) deadlock.push(`${pol} Q${q} 卡死回合 ${pct(dr)}、連三 ${pct(sr)}`);
    console.log(`   ${pol} Q${q}：變化分數 ${(sum / n).toFixed(1)}・卡死回合 ${pct(dr)}・連續三回合卡死的局 ${pct(sr)}`); }
  else console.log(`   ${pol} Q${q}：變化分數 ${(sum / n).toFixed(1)}`);
}
chk('回合數・每局手數（序章三幕＋回合）', true, `平均 ${(hands / runs).toFixed(1)} 手（目標約 23）`);
chk(`包袱・同時持有 ≤ ${V12.max_sticky}（不變式）`, maxSticky <= V12.max_sticky, `最多 ${maxSticky}`);
chk('不變式・16 歲以後沒有 s_club_jr', clubJr === 0, `${clubJr} 次`);
chk(`包袱・卡死回合 ≤ ${pct(th('deadlock_turn_max', 0.05))}、連三卡死的局 ≤ ${pct(th('deadlock_streak3_run_max', 0.02))}`, !deadlock.length, deadlock.join('；'));
{ const a = burdenIdx[1], b = burdenIdx[5]; const gap = Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-9);
  chk(`包袱・富窮負擔差 ≤ ${th('burden_index_gap_max', 0.2)}`, gap <= th('burden_index_gap_max', 0.2), `指數 ${[1, 2, 3, 4, 5].map((q) => `Q${q} ${burdenIdx[q].toFixed(2)}`).join('・')}；差 ${gap.toFixed(2)}`); }
if (expectRuns) chk(`包袱・Q5 期待離得開 ≥ ${pct(th('expect_leaves_min', 0.6))}`, expectLeft / expectRuns >= th('expect_leaves_min', 0.6), `${pct(expectLeft / expectRuns)}（有拿到 b_expect 的 ${expectRuns} 局）`);
else note('包袱・Q5 期待', 'full 打法裡沒有任何一局拿到 b_expect');
{ const f = (k: string) => (track[k] ?? 0) / runs;
  const ok = Math.abs(f('hs_general') - 0.55) <= 0.05 && Math.abs(f('hs_vocational') - 0.40) <= 0.05 && Math.abs(f('hs_5yr') - 0.05) <= 0.05;
  const msg = `普高 ${pct(f('hs_general'))}・高職 ${pct(f('hs_vocational'))}・五專 ${pct(f('hs_5yr'))}`; const lab = '選校比例（spec 定案目標 普高 55／高職 40／五專 5，±5；重新平衡階段才算通過條件，現在只提醒）';
  if (ok) chk(lab, true, msg); else note(lab, msg);
  console.log(`   路線：${Object.entries(route).map(([k, v]) => `${k} ${pct(v / runs)}`).join('・')}`);
  console.log(`   結局（full）：${Object.entries(endings).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v / runs)}`).join('・')}`);
  console.log(`   高職／五專出身 19 歲以後手上有 voc_license 的回合：${pct(voc19 / Math.max(1, voc19Turns))}（${voc19Turns} 回合）・依出身→路線：${Object.entries(vocBy).sort().map(([k, v]) => `${k} ${pct(v[0] / Math.max(1, v[1]))}（${v[1]} 回合）`).join('・')}`);
  { const u = route.uni ?? 0, t = route.uni_tech ?? 0; if (u + t) console.log(`   繼續升學的人裡：大學 ${pct(u / (u + t))}・科大 ${pct(t / (u + t))}（規格 §6.3 目標約 55／45）・高職生走一般大學 ${vocUni[1] ? pct(vocUni[0] / vocUni[1]) : '—'}（${vocUni[1]} 個高職生）`); } }
chk('成就・ach_teen_worker（旗標 worked_teen，打過 s_work）觸發得到', (achHits['ach_teen_worker'] ?? 0) > 0, `${pct((achHits['ach_teen_worker'] ?? 0) / played)}（worked_teen ${pct(workedTeen / played)}）`);
console.log(`   卡牌模式可判定的成就：${Object.entries(achHits).map(([k, v]) => `${k} ${pct(v / played)}`).join('・')}；需要舊模式狀態、卡牌模式不判定：${achUnsupported.length} 個`);

// ===== 3. 序章公平性（§1.7 第 3、4 點） =====
{
  const fA = th('fairness_per_card_stat_max', 2), fB = th('fairness_category_sum_max', 5), same = th('same_strength_max', 3);
  const runSet = (mode: string, q: number) => { const r = makeRng(seed0 ^ 0xfa17 ^ q); const st = Object.fromEntries(STATS.map((k) => [k, 0])) as Record<StatId, number>; let sc = 0;
    for (let k = 0; k < NF; k++) { const g = newGame(seed0 + k * 7877 + q, { q, prologue: mode === 'skip' ? 'skip' : 'play' }); playRun(g, 'full', r, mode); for (const s of STATS) st[s] += g.stats[s] / NF; sc += g.score() / NF; }
    return { st, sc }; };
  // 企劃定案：基準＝同一幕所有回憶卡的平均（不是「不選」）。Δgap_s(m) = gap_s(m) − 同幕平均 gap_s
  const res = new Map(childhood.memories.map((m) => { const a = runSet(`fixed:${m.id}`, 1), b = runSet(`fixed:${m.id}`, 5);
    return [m.id, { gap: Object.fromEntries(STATS.map((s) => [s, b.st[s] - a.st[s]])) as Record<StatId, number>, score: (a.sc + b.sc) / 2 }]; }));
  const actAvg = (act: number) => { const l = childhood.memories.filter((m) => m.act === act).map((m) => res.get(m.id)!);
    return { gap: Object.fromEntries(STATS.map((s) => [s, l.reduce((t, x) => t + x.gap[s], 0) / l.length])) as Record<StatId, number>, score: l.reduce((t, x) => t + x.score, 0) / l.length }; };
  const byCat: Record<string, { d: Record<StatId, number>; score: number; id: string }[]> = {}; const badA: string[] = []; const maxA = Object.fromEntries(STATS.map((s) => [s, -Infinity])) as Record<StatId, number>;
  for (const m of childhood.memories) { const r = res.get(m.id)!, base = actAvg(m.act);
    const d = Object.fromEntries(STATS.map((s) => [s, r.gap[s] - base.gap[s]])) as Record<StatId, number>;
    for (const s of STATS) { maxA[s] = Math.max(maxA[s], d[s]); if (d[s] > fA) badA.push(`${m.id} ${s} +${d[s].toFixed(1)}`); }
    (byCat[m.category] ??= []).push({ d, score: r.score - base.score, id: m.id }); }
  console.log(`   序章公平（基準＝同幕平均）・每項屬性最大單卡增量：${STATS.map((s) => `${s} ${maxA[s] >= 0 ? '+' : ''}${maxA[s].toFixed(1)}`).join('・')}`);
  chk(`序章公平・條件 A：每張卡每項屬性富窮差距增量 ≤ ${fA}`, !badA.length, badA.slice(0, 8).join('、'));
  const sumB = Object.fromEntries(STATS.map((s) => [s, Object.values(byCat).reduce((t, l) => t + Math.max(0, l.reduce((u, x) => u + x.d[s], 0) / l.length), 0)])) as Record<StatId, number>;
  chk(`序章公平・條件 B：每項屬性各類增量加總 ≤ ${fB}`, STATS.every((s) => sumB[s] <= fB), STATS.map((s) => `${s} ${sumB[s].toFixed(1)}`).join('・'));
  const sameBad = Object.entries(byCat).map(([c, l]) => { const v = l.map((x) => x.score); return { c, r: Math.max(...v) - Math.min(...v), l }; }).filter((x) => x.r > same);
  chk(`序章・同類等強（同類最大減最小 ≤ ${same} 分）`, !sameBad.length, sameBad.map((x) => `${x.c} ${x.r.toFixed(1)}（${x.l.map((y) => `${y.id} ${y.score >= 0 ? '+' : ''}${y.score.toFixed(1)}`).join('、')}）`).join('；'));
}

// ===== 4. 時代牌（era-cards §10） =====
{
  const exp = rj('game/test/fixtures/era_expected.json'); const nw = V12.era.nationwide; const { cards: ec, warnings } = resolveEraCards(era.cards, timeline);
  for (const w of warnings) note('時代牌', w);
  const mism: string[] = [], lowCount: string[] = [], cap: string[] = [], reach: Record<string, Set<number>> = {};
  const ages = [...cfg.ages, ...cfg.adult_branch!.ages];
  for (const Y of YEARS) for (const county of COUNTIES) {
    const slots = eraSlots(Y, ages, V12.turns_per_year, childhood, era.prologue_capacity); const r = buildEraSchedule(ec, Y, county, slots, nw);
    // 預期（§3.1 表）
    const e = exp.by_birth_year[String(Y)]; const want: Record<string, string[]> = {};
    for (const [k, ids] of Object.entries(e.slots as Record<string, string[]>)) { const l = ids.filter((id) => !exp.north_only[id] || exp.north_only[id].includes(county)); if (l.length) want[k] = l; }
    const norm = (o: Record<string, string[]>) => JSON.stringify(Object.keys(o).sort().map((k) => [k, [...o[k]].sort()]));
    if (norm(want) !== norm(r.schedule)) mism.push(`${Y} ${county}：預期 ${norm(want)} 實際 ${norm(r.schedule)}`);
    const wantLost = (e.lost as string[]).filter((id) => !exp.north_only[id] || exp.north_only[id].includes(county)); if ([...wantLost].sort().join() !== [...r.lost].sort().join()) mism.push(`${Y} ${county} 回顧：預期 ${wantLost} 實際 ${r.lost}`);
    const total = Object.values(r.schedule).flat().length; const after13 = Object.entries(r.schedule).filter(([k]) => !k.startsWith('act')).flatMap(([, v]) => v).length;
    if (total < th('era_total_min', 5) || after13 < th('era_after13_min', 2)) lowCount.push(`${Y} ${county} ${total}／${after13}`);
    for (const s of slots) if ((r.schedule[s.key]?.length ?? 0) > s.cap) cap.push(`${Y} ${county} ${s.key}`);
    for (const id of Object.values(r.schedule).flat()) (reach[id] ??= new Set()).add(Y);
    if (county === 'taitung' || county === 'penghu') for (const c of ec.filter((x) => x.tier_policy === 'heavy_light')) if (Object.values(r.schedule).flat().includes(c.id)) cap.push(`${c.id} 出現在 ${county}`);
  }
  chk('時代牌・排程和 era-cards §3.1 出生年總表一致（出生年×縣市 50 格）', !mism.length, mism.slice(0, 6).join('\n     '));
  chk(`時代牌・每個出生年×縣市翻開 ≥ ${th('era_total_min', 5)} 張、13 歲以後 ≥ ${th('era_after13_min', 2)} 張`, !lowCount.length, lowCount.join('、'));
  chk('時代牌・一槽一張（序章 2／2／1）、heavy_light 的牌不在台東澎湖', !cap.length, cap.join('、'));
  const diffs: string[] = [];
  for (const c of ec) { const tl = timeline.events.find((x) => x.id === c.timeline_id)?.reachable_birth_years ?? []; const got = [...(reach[c.id] ?? [])].sort();
    const missing = tl.filter((y) => !got.includes(y)), extra = got.filter((y) => !tl.includes(y)); if (missing.length || extra.length) diffs.push(`${c.id} 研究員有、遊戲翻不到 [${missing}]${extra.length ? ` 遊戲多 [${extra}]` : ''}`); }
  if (diffs.length) console.log(`ℹ️  時代牌・和研究員 reachable_birth_years 的差異（只列出；原因：6 歲以前不演、日曆年齡和學年差一年、被擠到回顧）：\n     ${diffs.join('\n     ')}`);
  // 序章版只差文字和旗標：序章套用的效果在每個分位、每個縣市都是空的
  const proEff = ec.filter((c) => c.prologue_effects && (c.effects_by_quintile || c.effects_by_tier)).map((c) => c.id);
  chk('時代牌・序章版本只差文字和旗標（不改屬性、各家境數值一樣）', !proEff.length, proEff.length ? `${proEff} 序章會依家境／縣市套不同數值` : 'era_crisis 序章兩版：只換 by_quintile 文字和 era_crisis_q123／q45 旗標');
  // 不出現數字
  const digit = /[0-9０-９]|民國|西元|萬|元|塊錢/; const bad: string[] = [];
  const scanT = (w: string, o: unknown) => { if (typeof o === 'string') { if (digit.test(o)) bad.push(`${w}「${o}」`); } else if (Array.isArray(o)) o.forEach((x, k) => scanT(`${w}[${k}]`, x)); else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (['name', 'line', 'consequence', 'album_text', 'review_line', 'text', 'variants'].includes(k) || /^\d+$/.test(k)) scanT(`${w}.${k}`, v); };
  for (const c of era.cards) scanT(c.id, c); for (const r of era.review_only ?? []) scanT(r.id, r); scanT('school_choice_text', Object.values(scenes.school_choice_text ?? {}).filter((x) => typeof x === 'string' && !(x as string).startsWith('選校')));
  chk('時代牌・文字不出現數字、年份、金額字', !bad.length, bad.slice(0, 6).join('、'));
  // 實際跑：翻開的槽位 = 排程（100%／0%），序章結束屬性不變，被擠掉的都有 era_lost 旗標，回顧行數 ≤ 上限
  const r = makeRng(seed0 ^ 0xe7a); let notMatch = 0, proStat = 0, lostBad = 0, revBad = 0, cells = new Map<string, number>(); const ex: string[] = [];
  const flipRate: Record<string, { n: number; hit: Record<string, number> }> = {};
  const rareLine = (era.cards.find((c) => c.id === 'era_crisis')?.variants ?? []).find((v) => v.weight !== undefined && v.weight < 1)?.line; const rare: Record<number, [number, number]> = {};
  for (let k = 0; k < NE; k++) { const g = newGame(seed0 + k * 6007); let pro: Record<StatId, number> | null = null;
    playRun(g, 'full', r, 'random', { onPrologueEnd: (x) => { pro = { ...x.stats }; } });
    if (pro && STATS.some((s) => pro![s] !== g.start[s])) proStat++;
    const flipped: Record<string, string[]> = {}; for (const l of g.eraLog) (flipped[l.slot] ??= []).push(l.id);
    const norm = (o: Record<string, string[]>) => JSON.stringify(Object.keys(o).sort().map((x) => [x, [...o[x]].sort()]));
    if (norm(flipped) !== norm(g.eraSchedule)) { notMatch++; if (ex.length < 3) ex.push(`${g.birthYear} ${g.base.s.county.id} ${g.route}：排 ${norm(g.eraSchedule)} 翻 ${norm(flipped)}`); }
    if (g.eraLost.some((id) => !g.flags.has(`era_lost_${id}`))) lostBad++; if (g.eraReviewIds().length > era.review_max_lines) revBad++;
    const key = `${g.birthYear}|${g.base.s.county.id}`; const fr = (flipRate[key] ??= { n: 0, hit: {} }); fr.n++; for (const l of g.eraLog) fr.hit[l.id] = (fr.hit[l.id] ?? 0) + 1;
    cells.set(key, 1);
    const cr = g.eraLog.find((l) => l.id === 'era_crisis' && !l.prologue); if (cr) { const line = g.view('era_crisis').line; const isRare = line === rareLine; (rare[g.quintile] ??= [0, 0])[0] += isRare ? 1 : 0; rare[g.quintile][1]++; } }
  const rateBad: string[] = [];
  for (const [key, fr] of Object.entries(flipRate)) { const [Y, county] = key.split('|'); const e = exp.by_birth_year[Y];
    const want = new Set(Object.values(e.slots as Record<string, string[]>).flat().filter((id) => !exp.north_only[id] || exp.north_only[id].includes(county)));
    for (const c of ec) { const rate = (fr.hit[c.id] ?? 0) / fr.n; if (want.has(c.id) ? rate !== 1 : rate !== 0) rateBad.push(`${Y} ${county} ${c.id} 預期 ${want.has(c.id) ? 100 : 0}% 實際 ${pct(rate)}`); } }
  chk(`時代牌・實際翻開和排程一致（${NE} 局，涵蓋 ${cells.size}／50 格；表內 100%、表外 0%）`, !notMatch && !rateBad.length, [...ex, ...rateBad.slice(0, 6)].join('\n     '));
  if (rareLine) { const q1 = rare[1] ?? [0, 0]; const other = [2, 3, 4, 5].reduce((t, q) => t + (rare[q]?.[0] ?? 0), 0);
    chk('時代牌・金融海嘯罕見版只給 Q1（設計假設權重 0.3：約 23%）', other === 0, `Q1 ${q1[1] ? pct(q1[0] / q1[1]) : '—'}（${q1[1]} 局翻到回合版）・Q2–Q5 ${other} 次`); }
  chk('時代牌・序章不改屬性（序章結束時的屬性＝開局屬性）', proStat === 0, `${proStat} 局不同`);
  chk(`時代牌・被擠掉的都有 era_lost_ 旗標、回顧「那幾年」≤ ${era.review_max_lines} 行`, !lostBad && !revBad, `${lostBad}／${revBad}`);
}
// ===== 5. 企劃定案（qa/v1.2-test-plan.md §6 Q6–Q9、Q13） =====
{
  const NR = Math.max(50, Math.round(N / 2)); let turns = 0, expOver = 0, echoMulti = 0, fireChecks = 0, fireBad = 0, sharedSeen = 0, cdFires = 0;
  let evict = 0, evictExp = 0, newAfter19 = 0, echoPlaced = 0, echoOver = 0, famAfter19 = 0, expDisc = 0, evictOld = 0, heldBack = 0, uniStart = 0, uniStartHs = 0, midN = 0, midDef = 0, midTitle = 0, mid5 = 0, mid5Bad = 0; const mid5Seen = new Map<number, number>(); const midSeen = new Map<string, number>(); const bad: string[] = [];
  const settle = (g: DeckGame) => { while (g.phase !== 'play' && g.phase !== 'review') {
    if (g.phase === 'choice') g.chooseSchool(botSchoolChoice(g, CH)); else if (g.phase === 'branch') g.chooseBranch(botBranchChoice(g, BR));
    else if (g.phase === 'housing') g.chooseHousing(botHousingChoice(g, HO)); else if (g.phase === 'break') g.pickBreak(g.breakOffer[Math.floor(BK.next() * g.breakOffer.length)]); else break; } };
  for (let k = 0; k < NR; k++) {
    const g = newGame(seed0 + 50000 + k); const r = makeRng(seed0 + 50000 + k); const pol: Policy = k % 2 ? 'passive' : 'worst';
    while (g.phase === 'prologue') botMemoryPick(g, r); if (g.phase === 'prologueSummary') g.startSchool(); settle(g);
    const hsText = new Set(((g as any).scenesText?.sc_school_start?.variants ?? []).filter((v: any) => [v.by_track].flat().some((t: string) => t?.startsWith('hs_'))).map((v: any) => v.text));
    while (g.phase === 'play') { turns++;
      if (g.scene?.id === 'sc_midterm' && g.schoolTrack === 'hs_5yr' && g.age >= 16 && g.age <= 18) { mid5++; mid5Seen.set(g.age, (mid5Seen.get(g.age) ?? 0) + 1);
        const want = (scenes.sc_midterm.variants ?? []).find((v: any) => v.by_track === 'hs_5yr' && v.by_age?.[0] === g.age && v.by_age?.[1] === g.age); if (!want || g.scene.text !== want.text || g.scene.name !== scenes.sc_midterm.name) mid5Bad++; }
      if (g.scene?.id === 'sc_midterm' && (g.route === 'uni' || g.route === 'uni_tech' || (g.schoolTrack === 'hs_5yr' && g.age >= 19))) { midN++; const who = (g.schoolTrack === 'hs_5yr' ? '五專' : '') + (g.route ? (g.schoolTrack === 'hs_5yr' ? '→' : '') + g.routeName(g.route) : '');
        if (g.schoolTrack === 'hs_5yr' && g.route) { const rv = (scenes.sc_midterm.variants ?? []).find((v: any) => v.by_track === g.route); if (!rv || g.scene.text !== rv.text) midDef++; } midSeen.set(`${who}${g.age}`, (midSeen.get(`${who}${g.age}`) ?? 0) + 1);
        if (g.scene.text === scenes.sc_midterm.text) midDef++; if (g.scene.name !== '期中考') midTitle++; }
      if (g.age === 19 && (g.route === 'uni' || g.route === 'uni_tech') && g.scene?.id === 'sc_school_start') { uniStart++; if (hsText.has(g.scene.text)) uniStartHs++; }
      const st = g.hand.filter((i) => g.card(i).sticky);
      if (st.filter((i) => g.card(i).burden_class === 'expectation').length > 1) expOver++;
      if (g.hand.filter((i) => g.card(i).echo_card).length > 1) echoMulti++;
      playTurn(g, pol, r);
      // 預測：endYear 每張 sticky heldTurns +1；到期的裡面只爆一張（heldTurns 大、平手最早進手牌），同事件牌的一起歸零，其餘 heldTurns 不變
      const pre = new Map(g.hand.filter((i) => g.card(i).sticky).map((i) => [i.uid, (g.heldTurns.get(i.uid) ?? 0) + 1]));
      const ripe = g.hand.filter((i) => { const c = g.card(i); return c.sticky && c.trigger_after && pre.get(i.uid)! >= c.trigger_after; })
        .sort((a, b) => pre.get(b.uid)! - pre.get(a.uid)! || (g.handEntry.get(a.uid) ?? 0) - (g.handEntry.get(b.uid) ?? 0) || a.uid - b.uid);
      const trig = ripe.map((i) => g.card(i).trigger_card).filter((x): x is string => !!x); if (new Set(trig).size < trig.length) sharedSeen++;
      const inCd = trig.filter((t) => g.cooldown.some((x) => x.inst.id === t)).length; const before = new Set(g.hand.map((i) => i.uid)); const logN = g.fuseLog.length;
      g.endYear(); settle(g); if (g.phase !== 'play') break;
      // 爆牌當下還在手上的＝現在還在手上，或這回合 fuseLog 有記到（爆完才因年齡等原因離手）
      const fired = g.fuseLog.slice(logN).map((x) => x.burden);
      const cand = ripe.filter((i) => g.hand.includes(i) || fired.includes(i.id)); if (!cand.length) continue; fireChecks++; cdFires += inCd;
      const top = cand[0]; const tc = g.card(top).trigger_card; const group = cand.filter((i) => i === top || (tc && g.card(i).trigger_card === tc)); const rest = cand.filter((i) => !group.includes(i)); heldBack += rest.length;
      const inH = (i: Inst) => g.hand.includes(i);
      const ok0 = JSON.stringify([...fired].sort()) === JSON.stringify(group.map((i) => i.id).sort()) && group.filter(inH).every((i) => (g.heldTurns.get(i.uid) ?? 0) === 0) && rest.filter(inH).every((i) => g.heldTurns.get(i.uid) === pre.get(i.uid));
      const fresh = (t: string) => g.hand.filter((i) => i.id === t && i.ephemeral && !before.has(i.uid)).length;
      const ok1 = (!tc || fresh(tc) === 1) && rest.every((i) => { const t = g.card(i).trigger_card; return !t || t === tc || fresh(t) === 0; });
      if (!ok0 || !ok1) { fireBad++; if (bad.length < 3) bad.push(`${seed0 + 50000 + k}@${g.age}:${cand.map((i) => i.id).join('+')}`); }
    }
    evict += g.stat12.evictions; evictExp += g.stat12.evictExpect; expDisc += g.stat12.expectDiscarded; famAfter19 += g.stat12.famNewAfter19; evictOld += g.evictLog.filter((e) => e.out !== Math.min(...e.cands)).length; newAfter19 += g.stat12.expectNewAfter19; echoPlaced += g.stat12.echoPlaced; echoOver += g.stat12.echoOverflow;
  }
  chk('spec §2.2-5／Q8・包袱爆：同回合只爆一張（heldTurns 大、平手最早進手牌）、同事件牌的一起歸零只放一張、事件牌不同的 heldTurns 不變、無視冷卻', fireBad === 0, `${fireChecks} 次爆（共用事件牌 ${sharedSeen} 次、事件牌不同而延後 ${heldBack} 張、事件牌在冷卻中 ${cdFires} 次）、不符 ${fireBad}${bad.length ? `（${bad.join('、')}）` : ''}`);
  chk('企劃 Q9・回音牌：在爆牌之後、補牌之前放入，算進 hand_size（沒有讓手牌超過上限）、一回合最多一張', echoOver === 0 && echoMulti === 0, `放入 ${echoPlaced} 次、超過上限 ${echoOver}、同回合多張 ${echoMulti}（${turns} 回合）`);
  chk('spec §2.1／Q6・期待類：同時最多 1 張（多抽到的進棄牌堆）、19 歲後不再抽新的 b_expect、b_family_expect 19 歲起抽得到', expOver === 0 && newAfter19 === 0 && famAfter19 > 0, `兩張以上 ${expOver} 回合、19 歲後新進 b_expect ${newAfter19}、19 歲後新抽到 b_family_expect ${famAfter19} 次、多抽到進棄牌堆 ${expDisc} 次`);
  chk('場景・五專 16／17／18 歲段考各用自己那句（by_track hs_5yr＋by_age 單一年齡；標題維持「段考」）', [16, 17, 18].every((a) => (mid5Seen.get(a) ?? 0) > 0) && mid5Bad === 0, `${mid5} 次（${[16, 17, 18].map((a) => `${a} 歲 ${mid5Seen.get(a) ?? 0}`).join('、')}）、不符 ${mid5Bad}`);
  chk('場景・大學／科大／五專 19 歲起的段考場景不出國高中預設段考句、標題是「期中考」（五專 21 歲分流後用分流路線那句）', midN > 0 && midDef === 0 && midTitle === 0, `${midN} 次（${[...midSeen].sort().map(([k, v]) => `${k} ${v}`).join('、')}）、出預設段考句 ${midDef}、標題不是期中考 ${midTitle}`);
  chk('場景・19 歲大學／科大開學不出高中版本（by_track 對到分流路線優先）', uniStart > 0 && uniStartHs === 0, `大學／科大開學場景 ${uniStart} 次、出高中版 ${uniStartHs}`);
  chk('spec §2.2-8／Q7・擠牌：期待類永不被擠、擠的是最早進手牌的非期待類', evictExp === 0 && evictOld === 0, `擠掉 ${evict} 次、擠掉期待類 ${evictExp}、不是最舊 ${evictOld}`);
  // Q13：時代牌用獨立亂數流——開關時代牌、換不同的選法，序章翻出的牌和 era_crisis 的擲骰都不變
  let offDiff = 0, rollDiff = 0, rolls = 0; const NS = Math.max(40, Math.round(NE / 20));
  const prologueOffers = (g: DeckGame, pickLast: boolean) => { const out: string[] = []; while (g.phase === 'prologue') { const o = g.prologueOffer(); out.push(o.map((m) => m.id).join(',')); g.pickMemory(o[pickLast ? o.length - 1 : 0].id); } return out.join('|'); };
  for (let k = 0; k < NS; k++) { const s = seed0 + 70000 + k * 13; const by = YEARS[k % YEARS.length];
    const a = newGame(s, { birthYear: by }), b = newGame(s, { birthYear: by, noEra: true }), c = newGame(s, { birthYear: by });
    const oa = prologueOffers(a, false), ob = prologueOffers(b, false); prologueOffers(c, true); if (oa !== ob) offDiff++;
    if (a.eraSchedule && Object.values(a.eraSchedule).some((xs) => xs.includes('era_crisis'))) rolls++;
    // 跑完整局（不同打法）再比 parent_unemployed
    a.startSchool(); c.startSchool(); playRun(a, 'greedy', makeRng(s)); playRun(c, 'passive', makeRng(s ^ 0x77));
    if (a.flags.has('parent_unemployed') !== c.flags.has('parent_unemployed')) rollDiff++; }
  chk('企劃 Q13・時代牌獨立亂數流：關掉時代牌序章翻出的牌不變；不同選法、打法下 era_crisis 擲 parent_unemployed 結果不變', offDiff === 0 && rollDiff === 0, `${NS} 個種子（有金融海嘯 ${rolls}）：序章不同 ${offDiff}、擲骰不同 ${rollDiff}`);
}
// ===== 6. 新回音牌（writing/v1.2_echo_classmates_text.md；企劃 10/17 定案） =====
{
  const ec = [...g0.cards.values()].filter((c) => c.echo_card && (c.echo_cap_group || c.stats_min || c.stats_max));
  const groupOf = (id: string) => id.replace(/_(bitter|warm)$/, ''); const groups = [...new Set(ec.map((c) => groupOf(c.id)))];
  const allGroups = [...new Set([...g0.cards.values()].filter((c) => c.echo_card && /_(bitter|warm)$/.test(c.id)).map((c) => groupOf(c.id)))]; const bothEx: string[] = [];
  const socialCards = ec.filter((c) => c.stats_min?.social !== undefined || c.stats_max?.social !== undefined);
  const mid = socialCards.find((c) => c.stats_min?.social !== undefined)?.stats_min!.social ?? NaN;
  const capOf = (grp: string) => Number(g0.v12?.echo_caps?.[grp]);
  const soc1922: number[] = [], soc1620: number[] = [], socAtEntry: number[] = []; let early = 0, firstAdult = 0; const earlyEx: string[] = []; const byGQ: Record<string, { warm: number; bitter: number }> = {}; const entryAt: Record<string, number> = {}; const bit19: Record<string, [number, number]> = {}; let fcEarly = 0, fcN = 0; const fcEx: string[] = [];
  const EFC = (g0.v12?.echo_from_card ?? {}) as Record<string, unknown>; const before = (a: number, t: number, f: unknown) => Array.isArray(f) && (a < f[0] || (a === f[0] && t < f[1]));
  let capOver = 0, maxCapped = 0, both = 0, socBad = 0, crBad = 0, runsN = 0; const hit: Record<string, number> = {};
  const byQ: Record<number, { warm: number; bitter: number; socWarm: number; socBitter: number; socPred: number; soc: number; socN: number }> = {};
  const NR6 = Math.max(200, N);
  for (const q of [1, 2, 3, 4, 5]) { const r = makeRng(seed0 ^ 0xec40 ^ q); const b = (byQ[q] = { warm: 0, bitter: 0, socWarm: 0, socBitter: 0, socPred: 0, soc: 0, socN: 0 });
    for (let k = 0; k < NR6; k++) { const pol = (['full', 'passive', 'greedy', 'worst'] as Policy[])[k % 4];
      const g = playRun(newGame(seed0 + 60000 + k * 7907 + q, { q }), pol, r, 'random', { onTurn: (x) => { if (x.age >= 19 && x.age <= 22) { soc1922.push(x.stats.social); b.soc += x.stats.social; b.socN++; } if (x.age >= 16 && x.age <= 20) soc1620.push(x.stats.social); } });
      runsN++; const caps: Record<string, number> = {};
      for (const l of g.echoLog) { const c = g0.cards.get(l.id)!; if (!ec.includes(c)) continue; hit[l.id] = (hit[l.id] ?? 0) + 1;
        if (c.echo_cap_group) caps[c.echo_cap_group] = (caps[c.echo_cap_group] ?? 0) + 1;
        const warm = l.id.endsWith('_warm'); if (warm) b.warm++; else b.bitter++;
        { const gq = (byGQ[`${groupOf(l.id)}|${q}`] ??= { warm: 0, bitter: 0 }); if (warm) gq.warm++; else gq.bitter++; }
        if (Array.isArray(EFC[l.id])) { fcN++; if (before(l.age, l.term, EFC[l.id])) { fcEarly++; if (fcEx.length < 4) fcEx.push(`${l.id}@${l.age}${l.term ? '下' : '上'}`); } }
        if (!warm) { const bb = (bit19[groupOf(l.id)] ??= [0, 0]); bb[1]++; if (l.age === 19) bb[0]++; }
        if (c.echo_cap_group === 'adult_echo') { firstAdult++; const at = `${l.age}${l.term ? '下' : '上'}`; entryAt[at] = (entryAt[at] ?? 0) + 1;
          if (l.age < 19 || (l.age === 19 && l.term < 1)) { early++; if (earlyEx.length < 4) earlyEx.push(`${l.id}@${at}`); } }
        if (socialCards.includes(c)) { socAtEntry.push(l.social); if (warm) b.socWarm++; else b.socBitter++; if (l.social >= mid) b.socPred++;
          if (warm ? l.social < c.stats_min!.social! : l.social > c.stats_max!.social!) socBad++; } }
      for (const [grp, n] of Object.entries(caps)) { maxCapped = Math.max(maxCapped, n); if (n > capOf(grp)) capOver++; }
      for (const grp of allGroups) if (g.echoLog.some((l) => l.id === `${grp}_bitter`) && g.echoLog.some((l) => l.id === `${grp}_warm`)) { both++; if (bothEx.length < 4) bothEx.push(grp); }
      if (g.flags.has('crammed') !== (g.everPlayed.has('d_cram') || g.everPlayed.has('s_cram'))) crBad++; } }
  const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
  const m1922 = med(soc1922), m1620 = med(soc1620); const mEntry = med(socAtEntry);
  console.log(`   新回音・人際（social）中位數：19–22 歲 ${m1922.toFixed(1)}（${soc1922.length} 個回合樣本）・16–20 歲 ${m1620.toFixed(1)}；目前門檻 暖 ≥ ${mid}／苦 ≤ ${mid - 1}；19–22 歲樣本 ≥ 門檻 ${pct(soc1922.filter((x) => x >= mid).length / soc1922.length)}`);
  console.log(`   新回音・單親／照顧長輩回音放進手牌那一刻的人際中位數 ${mEntry.toFixed(1)}（${socAtEntry.length} 張；≥ 門檻 ${pct(socAtEntry.filter((x) => x >= mid).length / Math.max(1, socAtEntry.length))}；這兩組 16–20 歲、一符合就放，大多在 16 歲第一個學期）`);
  console.log(`   新回音・各張放進手牌次數（${runsN} 局）：${ec.map((c) => `${c.id} ${hit[c.id] ?? 0}`).join('・')}`);
  console.log(`   新回音・苦／暖（全部新組）依分位：${[1, 2, 3, 4, 5].map((q) => `Q${q} 暖 ${pct(byQ[q].warm / Math.max(1, byQ[q].warm + byQ[q].bitter))}（${byQ[q].warm + byQ[q].bitter}）`).join('・')}`);
  console.log(`   新回音・人際分苦暖的兩組（單親、照顧長輩）依分位：${[1, 2, 3, 4, 5].map((q) => { const b = byQ[q], n = b.socWarm + b.socBitter; return `Q${q} 暖 ${n ? pct(b.socWarm / n) : '—'}（${n} 張；人際 ≥ 門檻預測 ${n ? pct(b.socPred / n) : '—'}；19–22 歲平均人際 ${(b.soc / Math.max(1, b.socN)).toFixed(1)}）`; }).join('・')}`);
  console.log(`   新回音・苦／暖依組 × 分位（Q1…Q5 的暖版比例（張數））：${groups.map((grp) => `${grp} ${[1, 2, 3, 4, 5].map((q) => { const x = byGQ[`${grp}|${q}`]; const n = x ? x.warm + x.bitter : 0; return n ? `${pct(x!.warm / n)}（${n}）` : '—'; }).join('／')}`).join('・')}`);
  const fromA = g0.v12?.echo_cap_from?.adult_echo;
  chk(`新回音・六組（adult_echo）19 歲下學期之前不進手牌（v12.json echo_cap_from.adult_echo＝${JSON.stringify(fromA)}）`, early === 0 && firstAdult > 0, `放進 ${firstAdult} 張、19 上以前 ${early}${earlyEx.length ? `（例：${earlyEx.join('、')}）` : ''}；放進的回合：${Object.entries(entryAt).sort().map(([k, v]) => `${k} ${v}`).join('・')}`);
  { const tot = Math.max(1, firstAdult); const top = Object.entries(entryAt).sort((x, y) => y[1] - x[1])[0] ?? ['—', 0]; const up = Object.entries(entryAt).filter(([k]) => k.endsWith('上')).reduce((x, [, v]) => x + v, 0);
    const per = firstAdult / Math.max(1, runsN); const ch = g0.v12?.echo_cap_chance?.adult_echo;
    chk(`新回音・六組（adult_echo）放進的回合不集中：單一回合 ≤ 40%（企劃 10/17；echo_cap_chance.adult_echo＝${ch}、echo_cooldown ${JSON.stringify(g0.v12?.echo_cooldown ? [g0.v12.echo_cooldown.min, g0.v12.echo_cooldown.max] : null)}）`, top[1] / tot <= 0.4, `最多的回合 ${top[0]} ${pct(top[1] / tot)}・上 ${pct(up / tot)}／下 ${pct(1 - up / tot)}・各回合 ${Object.entries(entryAt).sort().map(([k, v]) => `${k} ${pct(v / tot)}`).join('・')}`);
    const B19 = ['e_teenjob', 'e_filial', 'e_newyear']; const b19 = (g: string) => (bit19[g]?.[0] ?? 0) / Math.max(1, bit19[g]?.[1] ?? 0);
    chk('新回音・打工／孝親／過年三組：苦版放進手牌時在 19 歲的比例 ≤ 50%（企劃 10/17）', B19.every((g) => (bit19[g]?.[1] ?? 0) > 0 && b19(g) <= 0.5), B19.map((g) => `${g} ${pct(b19(g))}（${bit19[g]?.[0] ?? 0}／${bit19[g]?.[1] ?? 0} 張）`).join('・'));
    chk('新回音・六組（adult_echo）每局平均放進 0.8–1.0 張（企劃 10/17）', per >= 0.8 && per <= 1.0, `${per.toFixed(3)} 張／局（${firstAdult} 張、${runsN} 局；full／passive／greedy／worst 各四分之一、Q1–Q5 各 ${NR6} 局）`); }
  { // echo_from_card：資料裡有寫的牌照實際放進手牌檢查；另外用暫時設定（打工／孝親／過年六張 [20, 1]）自我測試引擎
    const ids = ['e_teenjob_bitter', 'e_teenjob_warm', 'e_filial_bitter', 'e_filial_warm', 'e_newyear_bitter', 'e_newyear_warm']; const test = Object.fromEntries(ids.map((id) => [id, [20, 1]]));
    const c2 = { ...cfg, v12: { ...V12, echo_from_card: { ...(V12.echo_from_card ?? {}), ...test } } } as typeof cfg; let tN = 0, tEarly = 0; const r = makeRng(seed0 ^ 0xefc);
    for (let k = 0; k < Math.max(200, Math.round(N / 2)); k++) { const g = new DeckGame(data, c2, cards, seed0 + 85000 + k * 31, eraVariants, { adult: true, v12: true, childhood, era, timeline, scenes }); playRun(g, (['full', 'passive'] as Policy[])[k % 2], r);
      for (const l of g.echoLog) if (ids.includes(l.id)) { tN++; if (before(l.age, l.term, test[l.id])) tEarly++; } }
    chk('回音・echo_from_card（單張最早放進手牌的回合，取代上限組 echo_cap_from）：不早於設定', fcEarly === 0 && tN > 0 && tEarly === 0, `資料設定 ${Object.keys(EFC).filter((k) => !k.startsWith('_')).length} 張、放進 ${fcN} 張、早於設定 ${fcEarly}${fcEx.length ? `（例：${fcEx.join('、')}）` : ''}；自我測試（${ids.length} 張設 [20, 1]）放進 ${tN} 張、早於設定 ${tEarly}`); }
  chk('新回音・19–22 歲六組（echo_cap_group）每局不超過上限', capOver === 0, `上限 ${capOf('adult_echo')}、單局最多 ${maxCapped}、超過 ${capOver} 局`);
  chk(`回音・同一組苦暖不會同一局都出（全部 ${allGroups.length} 組，含原有回音）`, both === 0, `${both} 次${bothEx.length ? `（${bothEx.join('、')}）` : ''}`);
  chk('新回音・人際分苦暖只看人際（暖版放進時人際 ≥ 門檻、苦版 ≤ 門檻−1；家境不影響，各分位的暖版比例＝人際 ≥ 門檻的比例）', socBad === 0 && [1, 2, 3, 4, 5].every((q) => byQ[q].socWarm === byQ[q].socPred), `不符 ${socBad}`);
  chk('新回音・crammed 旗標＝打過 d_cram 或 s_cram', crBad === 0, `${crBad} 局不符`);
  chk('新回音・八組都出現過', groups.every((grp) => (hit[`${grp}_bitter`] ?? 0) + (hit[`${grp}_warm`] ?? 0) > 0), groups.filter((grp) => !((hit[`${grp}_bitter`] ?? 0) + (hit[`${grp}_warm`] ?? 0))).join('、'));
}
// ===== 6b. 五專延後的 b_expect 撐到 21 歲分流（QA r2 新 bug 1；企劃用資料修：carry_age_max 放回 b_expect） =====
{
  // 18 下手上有 b_expect 的五專局：19、20 歲每個回合開始時都還在手上（期間沒在回合外被移走），21 歲分流後離開。
  // 合法離開只發生在回合中（打掉、removed_by 學業牌累積）；回合結束到下回合開始之間不見了＝被 age_max 移除。
  const exp = (g: DeckGame) => g.hand.find((i) => i.id === 'b_expect');
  type R5 = { held: number; bad: number; left21: number; stay21: number; badSeeds: string[] };
  const run5 = (g: DeckGame, r: Rng, plays: 'none' | 'passive', tag: string, o: R5) => {
    if (g.phase === 'prologue' || g.phase === 'prologueSummary') { while (g.phase === 'prologue') botMemoryPick(g, r); if (g.phase === 'prologueSummary') g.startSchool(); }
    let uid: number | null = null, before = false, flagged = false, checked21 = false;
    while (g.phase !== 'review') {
      if (g.phase === 'choice') { const ok = g.schoolOptions().some((x) => x.key === 'hs_5yr' && !x.locked); g.chooseSchool(plays === 'none' && ok ? 'hs_5yr' : botSchoolChoice(g, CH)); continue; }
      if (g.phase === 'branch') { g.chooseBranch(botBranchChoice(g, BR)); continue; } if (g.phase === 'housing') { g.chooseHousing(botHousingChoice(g, HO)); continue; }
      if (g.phase === 'break') { g.pickBreak(g.breakOffer[Math.floor(BK.next() * g.breakOffer.length)]); continue; }
      if (g.schoolTrack && g.schoolTrack !== 'hs_5yr') return;
      const e = exp(g);
      if (uid !== null && g.age >= 19 && g.age <= 20 && before && !g.hand.some((i) => i.uid === uid) && !flagged) { o.bad++; flagged = true; if (o.badSeeds.length < 4) o.badSeeds.push(`${tag}@${g.age}${g.term ? '下' : '上'}`); }
      if (uid !== null && g.age >= 21 && !checked21) { checked21 = true; if (!flagged && before) (g.hand.some((i) => i.uid === uid) ? o.stay21++ : o.left21++); }
      if (g.age === 18 && g.term === (g.tpy > 1 ? 1 : 0) && e && uid === null) { uid = e.uid; o.held++; }
      if (plays === 'passive') playTurn(g, 'passive', r);
      before = uid !== null && g.hand.some((i) => i.uid === uid);
      g.endYear(); }
  };
  const con: R5 = { held: 0, bad: 0, left21: 0, stay21: 0, badSeeds: [] }, nat: R5 = { held: 0, bad: 0, left21: 0, stay21: 0, badSeeds: [] };
  const NC = Math.max(100, Math.round(N / 5)), NN = N * 5;
  for (let k = 0; k < NC; k++) { const s = 7000 + k; run5(newGame(s, { q: 5, birthYear: 85 }), makeRng(s), 'none', `建構 seed ${s} Q5 85`, con); }
  for (let k = 0; k < NN; k++) { const s = 900000 + k; run5(newGame(s, { birthYear: YEARS[k % YEARS.length] }), makeRng(s ^ 0x5e), 'passive', `seed ${s}`, nat); }
  const fixed = (cfg as any).adult_branch?.carry_age_max?.ids?.includes('b_expect') || ((V12 as any).card_overrides?.b_expect?.age_max ?? 0) >= 21;
  const ok5 = con.held > 0 && con.bad + nat.bad === 0 && con.stay21 + nat.stay21 === 0;
  const name5 = '五專・18 下手上的 b_expect 撐到 21 歲分流（19、20 歲不被移除，21 歲分流後離開）';
  const det5 = `建構（Q5、85 年生、選五專、不出牌）${NC} 局中 18 下持有 ${con.held} 局、19–20 歲被移除 ${con.bad}、21 歲分流後離開 ${con.left21}／還在 ${con.stay21}；自然（躺平）${NN} 局中五專 18 下持有 ${nat.held} 局、被移除 ${nat.bad}、21 歲離開 ${nat.left21}／還在 ${nat.stay21}${con.badSeeds.length + nat.badSeeds.length ? `（例：${[...con.badSeeds, ...nat.badSeeds].join('、')}）` : ''}`;
  if (ok5 || fixed) chk(name5, ok5, det5);
  else note(`${name5}（只報告：預期失敗，等企劃的資料修正——carry_age_max 放回 b_expect，或 v12.json card_overrides.b_expect.age_max ≥ 21）`, det5);
}
// ===== 6c. ach_burnout 改看 stress_peak 旗標（企劃 10/17；目標 3–8%，只報告） =====
{
  const NB = Math.max(200, N); const cur = ACH.find((a) => a.id === 'ach_burnout'); const alt = [{ id: 'ach_burnout', conditions: { flags_any: ['stress_peak'] } }];
  const byQ: Record<number, { n: number; flag: number; sick: number; endB: number; achNow: number }> = {};
  for (const q of [1, 2, 3, 4, 5]) { const r = makeRng(seed0 ^ 0xb0e7 ^ q); const b = (byQ[q] = { n: 0, flag: 0, sick: 0, endB: 0, achNow: 0 });
    for (let k = 0; k < NB; k++) { const pol = (['full', 'passive', 'greedy', 'worst'] as Policy[])[k % 4]; const g = playRun(newGame(seed0 + 80000 + k * 6113 + q, { q }), pol, r);
      b.n++; const f = g.flags.has('stress_peak'); if (f) b.flag++; if (g.sickCount > 0) b.sick++; if (g.endingId() === 'burnout') b.endB++; if (cur && g.achievementsMet([cur]).met.length) b.achNow++;
      if (f !== (g.achievementsMet(alt).met.length > 0)) throw new Error('stress_peak 條件判斷不一致'); } }
  const T = (k: 'flag' | 'sick' | 'endB' | 'achNow') => [1, 2, 3, 4, 5].reduce((x, q) => x + byQ[q][k], 0) / (5 * NB);
  const g0p = g0.stressPeakAt();
  console.log(`ℹ️  ach_burnout 改成 stress_peak 旗標（壓力 ≥ ${g0p} 或病倒；目標 3–8%）：全體 ${pct(T('flag'))}・依分位 ${[1, 2, 3, 4, 5].map((q) => `Q${q} ${pct(byQ[q].flag / byQ[q].n)}`).join('・')}；對照：病倒過 ${pct(T('sick'))}、成就實際判定（achievements.json，v1.2 套 v12 覆寫）${pct(T('achNow'))}（full／passive／greedy／worst 各四分之一、每分位 ${NB} 局）`);
}
// ===== 7. 規格 §6.1 指標（只報告，不算通過／未通過；門檻由企劃寫在 design/v1.2-balance-log.md） =====
if (N61 > 0) {
  // A＝第 5 分位，每回合從可打的牌（不含 sticky 包袱）均勻隨機打一張，增量是負的也照打，用獨立的亂數流（企劃 10/17 第二版定義）；
  // D＝第 1 分位，每回合打快樂加最多的一張（不管學業）；兩者都不刻意處理包袱（不打 sticky）。
  // B／C＝第 1／5 分位每回合用滿（隨機）；B−／C−＝用滿挑最差（值＝分數／時間）；B+／C+＝挑最好。高壓＝每回合先打壓力加最多的（病倒率用）。
  type P61 = 'A' | 'D' | 'full' | 'worst' | 'greedy' | 'stress';
  const val = (g: DeckGame, i: Inst) => g.scoreValue(i) / Math.max(1, g.costOf(i) ?? 1);
  const eff = (g: DeckGame, i: Inst, k: StatId) => g.effectsFor(i).eff[k] ?? 0;
  const rest = Number((cfg as any).rest_stress_per_slot ?? 0);
  const cell6 = new Map<string, { n: number; lt6: number; min: number }>(); let count6 = false;
  interface Rec { route: string; score: number; post: number; sick: boolean; ending: string | null }
  const run61 = (seed: number, q: number | undefined, pol: P61, n: number): Rec[] => { const r = makeRng(seed ^ 0x61 ^ ((q ?? 0) * 31 + pol.length * 7)); const ra = makeRng((seed * 2654435761) ^ 0xa61a); const out: Rec[] = [];
    for (let k = 0; k < n; k++) { const g = newGame(seed + k * 104729 + (q ?? k % 5), q === undefined ? { q: (k % 5) + 1 } : { q });
      if (g.phase === 'prologue' || g.phase === 'prologueSummary') { while (g.phase === 'prologue') botMemoryPick(g, r); if (g.phase === 'prologueSummary') g.startSchool(); }
      while (g.phase !== 'review') {
        if (g.phase === 'choice') { g.chooseSchool(botSchoolChoice(g, CH)); continue; } if (g.phase === 'branch') { g.chooseBranch(botBranchChoice(g, BR)); continue; }
        if (g.phase === 'housing') { g.chooseHousing(botHousingChoice(g, HO)); continue; } if (g.phase === 'break') { g.pickBreak(g.breakOffer[Math.floor(BK.next() * g.breakOffer.length)]); continue; }
        if (count6) { const ids = new Set<string>(); for (const i of [...g.draw, ...g.discard, ...g.hand]) if (g.card(i).type === 'action' && (g as any).eligible(i)) ids.add(i.id);
          const key = `Q${g.quintile}・${g.age}${g.term ? '下' : '上'}・${g.route ? g.routeName(g.route) : g.schoolTrack ?? '國中'}`; const c6 = cell6.get(key) ?? { n: 0, lt6: 0, min: 99 }; c6.n++; if (ids.size < 6) c6.lt6++; c6.min = Math.min(c6.min, ids.size); cell6.set(key, c6); }
        if (pol === 'A' || pol === 'D') { const p = g.playable().filter((i) => !g.card(i).sticky);
          if (p.length) { const i = pol === 'A' ? p[Math.floor(ra.next() * p.length)]
            : p.reduce((m, x) => eff(g, x, 'happiness') > eff(g, m, 'happiness') ? x : m); g.play(i.uid); } }
        else for (;;) { const p = g.playable(); if (!p.length) break; let i: Inst;
          if (pol === 'greedy') i = p.reduce((m, x) => val(g, x) > val(g, m) ? x : m); else if (pol === 'worst') i = p.reduce((m, x) => val(g, x) < val(g, m) ? x : m);
          else if (pol === 'stress') { i = p.reduce((m, x) => eff(g, x, 'stress') > eff(g, m, 'stress') ? x : m); if (eff(g, i, 'stress') < -rest * (g.costOf(i) ?? 1)) break; }
          else i = p[Math.floor(r.next() * p.length)];
          g.play(i.uid); }
        g.endYear(); }
      out.push({ route: g.route ?? 'none', score: g.score(), post: g.score() - (g.scoreAtSplit ?? g.score()), sick: g.sickCount > 0, ending: g.endingId() }); }
    return out; };
  const mean = (rs: Rec[], f: (x: Rec) => number = (x) => x.score) => rs.reduce((a, x) => a + f(x), 0) / Math.max(1, rs.length);
  const sickR = (rs: Rec[]) => rs.filter((x) => x.sick).length / Math.max(1, rs.length);
  const tol = Math.round(5 * 10 / 3 * 10) / 10; const lv = g0.cfg.score.level_size;
  const routes = ['uni', 'uni_tech', 'work_first'];
  for (const seed of [seed0, 7]) { const t0 = Date.now(); cell6.clear();
    const A = run61(seed, 5, 'A', N61), B = run61(seed, 1, 'full', N61), C = run61(seed, 5, 'full', N61), D = run61(seed, 1, 'D', N61);
    const Bw = run61(seed, 1, 'worst', N61), Cw = run61(seed, 5, 'worst', N61), Bg = run61(seed, 1, 'greedy', N61), Cg = run61(seed, 5, 'greedy', N61), HS = run61(seed, undefined, 'stress', N61);
    const ok = (b: boolean) => (b ? '符合' : '不符合');
    console.log(`ℹ️  §6.1 指標・種子 ${seed}・每打法 ${N61} 局（只報告；${((Date.now() - t0) / 1000).toFixed(0)} 秒）`);
    console.log(`   平均變化分數（13 歲起累計）：A ${mean(A).toFixed(1)}・B ${mean(B).toFixed(1)}・C ${mean(C).toFixed(1)}・D ${mean(D).toFixed(1)}・B− ${mean(Bw).toFixed(1)}・C− ${mean(Cw).toFixed(1)}・B+ ${mean(Bg).toFixed(1)}・C+ ${mean(Cg).toFixed(1)}`);
    console.log(`   B − A ≥ ${lv}：${(mean(B) - mean(A)).toFixed(1)}（${ok(mean(B) - mean(A) >= lv)}）・C ≥ B：C ${mean(C).toFixed(1)} vs B ${mean(B).toFixed(1)}（${ok(mean(C) >= mean(B))}）・B− ≤ D + ${tol}：${mean(Bw).toFixed(1)} vs ${(mean(D) + tol).toFixed(1)}（${ok(mean(Bw) <= mean(D) + tol)}）・C− ≤ A + ${tol}：${mean(Cw).toFixed(1)} vs ${(mean(A) + tol).toFixed(1)}（${ok(mean(Cw) <= mean(A) + tol)}）`);
    console.log(`   病倒：一般打法（B／C／B+／C+）${[B, C, Bg, Cg].map((x) => pct(sickR(x))).join('／')}（目標 < 5%）・躺平 A ${pct(sickR(A))}／D ${pct(sickR(D))}（目標 0%）・高壓 ${pct(sickR(HS))}（目標 25–60%）`);
    for (const rt of routes) { const f = (rs: Rec[]) => rs.filter((x) => x.route === rt); const [a, b, c, d, bw, cw] = [A, B, C, D, Bw, Cw].map(f);
      const dd = d.length ? mean(d) : mean(D), aa = a.length ? mean(a) : mean(A); const post = (rs: Rec[]) => mean(rs, (x) => x.post);
      const ends = new Map<string, number>(); for (const x of [A, B, C, D, Bw, Cw, Bg, Cg, HS].flatMap(f)) if (x.ending) ends.set(x.ending, (ends.get(x.ending) ?? 0) + 1);
      const norm = [B, C, Bg, Cg].flatMap(f), pas = [A, D].flatMap(f);
      console.log(`   ${rt}：B 增量 − C 增量 ≤ 5（分流後）${b.length && c.length ? `${(post(b) - post(c)).toFixed(1)}（B ${post(b).toFixed(1)}／${b.length} 局、C ${post(c).toFixed(1)}／${c.length} 局；${ok(post(b) - post(c) <= 5)}）` : `樣本不足（B ${b.length}／C ${c.length}）`}`
        + `・B− ≤ D + tol ${bw.length ? `${mean(bw).toFixed(1)} vs ${(dd + tol).toFixed(1)}（${ok(mean(bw) <= dd + tol)}）` : '—'}・C− ≤ A + tol ${cw.length ? `${mean(cw).toFixed(1)} vs ${(aa + tol).toFixed(1)}（${ok(mean(cw) <= aa + tol)}）` : '—'}`
        + `・病倒 一般 ${pct(sickR(norm))}／躺平 ${pct(sickR(pas))}・結局 ${ends.size} 種（${[...ends].sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join('、')}）`); }
    count6 = true; for (let q = 1; q <= 5; q++) { run61(seed, q, 'full', Math.ceil(N61 / 2)); run61(seed, q, 'greedy', Math.floor(N61 / 2)); } count6 = false;
    { const cs = [...cell6.values()]; const tot = cs.reduce((a, c) => a + c.n, 0), lt = cs.reduce((a, c) => a + c.lt6, 0), mn = Math.min(...cs.map((c) => c.min));
      const over = [...cell6].filter(([, c]) => c.lt6 / c.n > 0.1).sort((x, y) => y[1].lt6 / y[1].n - x[1].lt6 / x[1].n), lo = [...cell6].filter(([, c]) => c.min < 5);
      const fmt = ([k, c]: [string, { n: number; lt6: number; min: number }]) => `${k} ${pct(c.lt6 / c.n)}／最少 ${c.min}（${c.n} 回合）`;
      console.log(`   每回合抽得到的行動牌（type＝action、eligible、抽牌堆＋棄牌堆＋手牌不同 id；另跑 Q1–Q5 各 ${N61} 局，一半隨機用滿、一半挑最好；QA r3 的量法）：不到 6 張的回合 ${pct(lt / Math.max(1, tot))}（${lt}／${tot}；目標每格 ≤ 10%）・最少 ${mn} 張（目標每回合 ≥ 5）・超過 10% 的格 ${over.length}／${cell6.size}${over.length ? `（${over.slice(0, 6).map(fmt).join('、')}）` : ''}・有回合不到 5 張的格 ${lo.length}${lo.length ? `（${lo.slice(0, 6).map(fmt).join('、')}）` : ''}`); } }
}
console.log(`\n${fail ? `❌ 未通過 ${fail} 項` : '✅ 全部通過'}${warn ? `（⚠️ ${warn} 項提醒）` : ''}`);
process.exit(fail ? 1 : 0);
