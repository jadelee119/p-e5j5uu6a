// §6 驗收：npx tsx sim/deckcheck.ts [次數] [種子] [adult]（第三個參數 adult＝打開 18→22 骨架）
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGameData } from '../src/logic/load';
import { DeckGame, botSchoolChoice, botBranchChoice, botHousingChoice, drawablePool, type CardDef, type DeckConfig } from '../src/logic/deck';
import { makeRng } from '../src/logic/rng';
const CH = makeRng(0x5c4001); // 選校用（獨立於出牌亂數）
import { STATS, type StatId } from '../src/logic/types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rj = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const data = buildGameData({
  eventFiles: readdirSync(join(root, 'data/events')).filter((f) => f.endsWith('.json')).map((f) => rj(`data/events/${f}`)),
  endings: rj('data/endings.json'), countiesJson: rj('data/counties.json'), balance: rj('data/balance.json'),
  birthYears: rj('data/birth_years.json'), eraTerms: rj('data/era_terms.json'), opening: rj('data/opening.json'),
  narrationMd: readFileSync(join(root, 'writing/stage_narrations.md'), 'utf8'),
});
const cfg = rj('data/deck/config.json') as DeckConfig;
const N = Number(process.argv[2] ?? 5000); const seed0 = Number(process.argv[3] ?? 2026);
const ADULT = process.argv[4] === 'adult' || !!cfg.adult_branch?.enabled;
const cards = [...rj('data/deck/cards.json').cards, ...(ADULT ? rj('data/deck/cards_adult.json').cards : [])] as CardDef[];
const AGES = ADULT ? [...cfg.ages, ...cfg.adult_branch!.ages] : cfg.ages;
const BR = makeRng(0xb2a7c4); // 分流用
const HO = makeRng(0x40a5e); // 住處用
const ROUTES = ['uni', 'uni_tech', 'work_first'];
type RunRec = { q: number; route: string; score: number; post: number; sick: boolean; ending: string | null; loan: boolean };
const recs: Record<string, RunRec[]> = {};
let fail = 0;

function newGame(q: number, seed: number) {
  // 強制分位：重抽種子直到開局分位符合（沿用原本開局機率，不改引擎）
  for (let s = seed; ; s += 7919) { const g = new DeckGame(data, cfg, cards, s, undefined, { adult: ADULT }); if (g.quintile === q) return g; }
}
type Policy = 'passive' | 'full' | 'greedy' | 'worst';
const W = cfg.score.weights;
const value = (g: DeckGame, i: any) => g.scoreValue(i) / Math.max(1, g.costOf(i) ?? 1);
interface R { label: string; sick: number; expect: number; mean: number; statMean: number; plays: number; stat: Record<StatId, number> }
const rows: R[] = [];
function run(label: string, q: number, policy: Policy): R {
  const pol = makeRng(seed0 ^ (q * 31 + policy.length)); let sum = 0, sumStat = 0, plays = 0, sickN = 0, expN = 0; const missed = new Map<string, number>(); const trk: Record<string, number> = {}; let sickSenior = 0, sickJunior = 0;
  const stat = Object.fromEntries(STATS.map((k) => [k, 0])) as Record<StatId, number>;
  for (let n = 0; n < N; n++) {
    const g = newGame(q, seed0 + n * 104729);
    g.setTalent({}); let sk = false, ex = false;
    while (g.phase !== 'review') { if (g.phase === 'choice') { g.chooseSchool(botSchoolChoice(g, CH)); continue; }
      if (g.phase === 'branch') { g.chooseBranch(botBranchChoice(g, BR)); continue; } if (g.phase === 'housing') { g.chooseHousing(botHousingChoice(g, HO)); continue; }
      const limit = policy === 'passive' ? pol.int(0, 1) : Infinity; let k = 0;
      while (k < limit) { const p = g.playable(); if (!p.length) break;
        let i = p[Math.floor(pol.next() * p.length)];
        if (policy === 'greedy') i = p.reduce((m, x) => value(g, x) > value(g, m) ? x : m);
        if (policy === 'worst') i = p.reduce((m, x) => value(g, x) < value(g, m) ? x : m);
        if (g.effectsFor(i).expect) ex = true; g.play(i.uid); k++; plays++; }
      g.endYear();
    }
    if (g.sickCount) sickN++; if (ex) expN++; if (g.track) trk[g.track] = (trk[g.track] ?? 0) + 1; if (g.sickAges.some((a) => a <= 15)) sickJunior++; if (g.sickAges.some((a) => a >= 16)) sickSenior++;
    const tagPart = g.tagBonus();
    sum += g.score(); sumStat += g.score() - tagPart;
    const d = g.deltas(); for (const k of STATS) stat[k] += d[k] / N;
    for (const m of g.missed) missed.set(m.id, (missed.get(m.id) ?? 0) + 1);
    if (ADULT) (recs[label] ??= []).push({ q, route: g.route ?? 'none', score: g.score(), post: g.score() - (g.scoreAtSplit ?? 0), sick: g.sickCount > 0, ending: g.endingId(), loan: g.hasLoan });
  }
  const r = { label, sick: sickN / N, expect: expN / N, mean: sum / N, statMean: sumStat / N, plays: plays / N, stat };
  console.log(`${label}: 變化量平均 ${r.mean.toFixed(1)}（屬性部分 ${r.statMean.toFixed(1)}）・每局出牌 ${r.plays.toFixed(2)} 張・`
    + STATS.map((k) => `${k} ${stat[k] >= 0 ? '+' : ''}${stat[k].toFixed(1)}`).join(' ')
    + `・病倒 ${(100 * r.sick).toFixed(1)}%・期待 ${(100 * r.expect).toFixed(1)}%` + `（13–15 歲 ${(100 * sickJunior / N).toFixed(1)}%・16–18 歲 ${(100 * sickSenior / N).toFixed(1)}%）`
    + `・選校 ${['hs_general', 'hs_vocational', 'hs_5yr'].map((k) => `${cfg.school_choice!.options[k].name} ${(100 * (trk[k] ?? 0) / N).toFixed(0)}%`).join('/')}`
    + `・錯過率 ${[...missed].map(([k, v]) => `${k} ${(100 * v / N).toFixed(0)}%`).join('、') || '無'}`);
  rows.push(r); return r;
}
console.log(`== deckcheck：各 ${N} 局 ==`);
const A = run('A 第5分位・每年0–1張', 5, 'passive');
const B = run('B 第1分位・每年用滿（隨機）', 1, 'full');
const C = run('C 第5分位・每年用滿（隨機）', 5, 'full');
const D = run('D 第1分位・每年0–1張', 1, 'passive');
const Bg = run('B+ 第1分位・用滿・挑最好', 1, 'greedy');
const Bw = run('B− 第1分位・用滿・挑最差', 1, 'worst');
const Cg = run('C+ 第5分位・用滿・挑最好', 5, 'greedy');
const Cw = run('C− 第5分位・用滿・挑最差', 5, 'worst');
const lv = cfg.score.level_size;
const chk = (name: string, ok: boolean, msg: string) => { console.log(`${name}：${msg} → ${ok ? '通過' : '未通過'}`); if (!ok) fail++; };
console.log('');
chk('B − A ≥ 20', B.mean - A.mean >= lv, `${(B.mean - A.mean).toFixed(1)}`);
chk(ADULT ? 'C ≥ B（全局，13 歲起累計）' : 'C ≥ B', C.mean >= B.mean, `C ${C.mean.toFixed(1)} vs B ${B.mean.toFixed(1)}`);
const tol = Math.round(5 * AGES.length / 3 * 10) / 10; // §11：每 3 年 +5
chk(`B− ≤ D + ${tol}`, Bw.mean <= D.mean + tol, `B− ${Bw.mean.toFixed(1)} vs D ${D.mean.toFixed(1)}`);
chk(`C− ≤ A + ${tol}`, Cw.mean <= A.mean + tol, `C− ${Cw.mean.toFixed(1)} vs A ${A.mean.toFixed(1)}`);
// 躺平結局：A / D 判定為躺平，且文字依家境不同
const pe = (q: number) => { const g = newGame(q, seed0); g.setTalent({}); while (g.phase !== 'review') { if (g.phase === 'choice') { g.chooseSchool(botSchoolChoice(g, CH)); continue; } if (g.phase === 'branch') { g.chooseBranch(botBranchChoice(g, BR)); continue; } if (g.phase === 'housing') { g.chooseHousing(botHousingChoice(g, HO)); continue; } g.endYear(); } return g.passiveEnding(); };
const texts = [1, 2, 3, 4, 5].map(pe);
chk('躺平結局依家境不同', !!texts[0] && !!texts[4] && texts[0] !== texts[4] && texts[2] !== texts[0] && texts[2] !== texts[4],
  texts.map((t, k) => `Q${k + 1}「${(t ?? '（無）').slice(0, 10)}…」`).join(' '));
// 病倒可觸發：每年把能打的牌中壓力加最多的先打（壓力最大化貪婪），跨分位跑多個種子，至少要觸發一次
{
  const th = cfg.forced.f_sick.stress_at_least; let maxStress = 0, sickRuns = 0, expRuns = 0;
  for (let n = 0; n < N; n++) {
    const g = newGame((n % 5) + 1, seed0 + n * 104729); g.setTalent({}); let sick = false, ex = false;
    while (g.phase !== 'review') { if (g.phase === 'choice') { g.chooseSchool(botSchoolChoice(g, CH)); continue; }
      if (g.phase === 'branch') { g.chooseBranch(botBranchChoice(g, BR)); continue; } if (g.phase === 'housing') { g.chooseHousing(botHousingChoice(g, HO)); continue; }
      for (;;) { const p = g.playable(); if (!p.length) break;
        const i = p.reduce((m, x) => (g.effectsFor(x).eff.stress ?? 0) > (g.effectsFor(m).eff.stress ?? 0) ? x : m);
        if ((g.effectsFor(i).eff.stress ?? 0) < -(cfg.rest_stress_per_slot ?? 0) * (g.costOf(i) ?? 1)) break; // 只有比休息更降壓時才不打
        if (g.effectsFor(i).expect) ex = true; g.play(i.uid); maxStress = Math.max(maxStress, g.stats.stress); }
      g.endYear(); maxStress = Math.max(maxStress, g.stats.stress);
    }
    if (g.sickCount) sickRuns++; if (ex) expRuns++;
  }
  const sr = sickRuns / N; const eth = (cards.find((c) => c.id === 'b_expect')!.in_hand?.stress_at_least) ?? 0;
  chk('病倒可觸發', sickRuns > 0, `壓力最大化 ${N} 局：最高壓力 ${maxStress}／門檻 ${th}，觸發 ${sickRuns} 局`);
  chk('病倒・高壓打法 25–60%', sr >= 0.25 && sr <= 0.6, `${(100 * sr).toFixed(1)}%`);
  const normal = [B, C, Bg, Cg].map((r) => r.sick); chk('病倒・一般打法 < 5%', normal.every((x) => x < 0.05), [B, C, Bg, Cg].map((r) => `${r.label.split(' ')[0]} ${(100 * r.sick).toFixed(1)}%`).join(' '));
  chk('病倒・躺平 0%', A.sick === 0 && D.sick === 0, `A ${(100 * A.sick).toFixed(1)}% D ${(100 * D.sick).toFixed(1)}%`);
  const er = Math.max(expRuns / N, ...rows.map((r) => r.expect));
  chk('期待可觸發', er > 0, `高壓打法 ${(100 * expRuns / N).toFixed(1)}%、各打法最高 ${(100 * er).toFixed(1)}%`);
  chk('期待早於病倒', eth < th, `期待 ${eth} < 病倒 ${th}`);
  console.log('各牌打出時的壓力變化（首次）：' + cards.filter((c) => c.effects && c.effects.stress !== undefined)
    .map((c) => `${c.id} ${c.effects.stress! >= 0 ? '+' : ''}${c.effects.stress}`).join('、'));
}
console.log(`取捨檢查：B+ − B− = ${(Bg.mean - Bw.mean).toFixed(1)}，C+ − C− = ${(Cg.mean - Cw.mean).toFixed(1)}`);

console.log('\n== 每個分位×年齡的可抽牌（門檻 6） ==');
for (let q = 1; q <= 5; q++) for (const age of cfg.ages) for (const t of age >= (cfg.school_choice?.age ?? 99) ? Object.keys(cfg.school_choice!.options) : [undefined]) {
  const p = drawablePool(cfg, cards, q, age, t); const ok = p.length >= 6; if (!ok) fail++;
  console.log(`Q${q} ${age}歲${t ? `・${cfg.school_choice!.options[t].name}` : ''}：${p.length} 張 ${ok ? '' : '✗ '}(${p.join(',')})`); }
if (ADULT) { const ab = cfg.adult_branch!;
  for (let q = 1; q <= 5; q++) for (const age of ab.ages) {
    const combos: [string, string | undefined][] = [];
    for (const r of ROUTES) for (const t of ['hs_general', 'hs_vocational', 'hs_5yr']) { if (t === 'hs_5yr' && r === 'uni') continue; if (t !== 'hs_5yr' && age < ab.branch.age) continue; if (t === 'hs_5yr' && age < ab.branch_jc.age) continue; combos.push([t, r]); }
    for (const t of ['hs_5yr']) if (age < ab.branch_jc.age) combos.push([t, undefined]);
    for (const [t, r] of combos) { const p = drawablePool(cfg, cards, q, age, t, r); const ok = p.length >= 6; if (!ok) fail++;
      if (!ok || q === 1 || q === 5) console.log(`Q${q} ${age}歲・${cfg.school_choice!.options[t].name}${r ? `→${ab.route_names[r]}` : ''}：${p.length} 張 ${ok ? '' : '✗ '}`); } }
}
const echoes = cards.filter((c) => c.expires_age !== null && c.echo && c.echo.age >= 16 && c.echo.age <= 22);
console.log(`\n有 16–22 歲回響的可錯過牌：${echoes.length} 張（門檻 3）${echoes.length >= 3 ? '' : ' ✗'}`); if (echoes.length < 3) fail++;
// 選校分流（自然分位、隨機打法，對照 data/track_ratios_source.md：普高≈45%、高職 45–50%、五專 <10%）
{ const CH2 = makeRng(0x5c4001), pol = makeRng(seed0 ^ 4242); const cnt: Record<string, number> = {};
  for (let n = 0; n < N; n++) { const g = new DeckGame(data, cfg, cards, seed0 + n * 104729); g.setTalent({});
    while (g.phase !== 'choice' && g.phase !== 'review') { for (;;) { const p = g.playable(); if (!p.length) break; g.play(p[Math.floor(pol.next() * p.length)].uid); } g.endYear(); }
    if (g.phase === 'choice') { const t = botSchoolChoice(g, CH2); cnt[t] = (cnt[t] ?? 0) + 1; } }
  const f = (k: string) => (cnt[k] ?? 0) / N;
  chk('\n選校分流・五專 < 10%', f('hs_5yr') < 0.1, `普高門檻 學業≥${cfg.school_choice!.general_academic_min}・自然分位隨機打法：普高 ${(100 * f('hs_general')).toFixed(1)}%、高職 ${(100 * f('hs_vocational')).toFixed(1)}%、五專 ${(100 * f('hs_5yr')).toFixed(1)}%`); }
if (ADULT) {
  console.log('\n== 18→22 骨架（§6，假設值） ==');
  const all = (lbl: string) => recs[lbl] ?? [];
  // 分流比例（四種隨機／躺平假玩家合併，依分位）
  const pool = [A, B, C, D, Bg, Bw, Cg, Cw].flatMap((r) => all(r.label));
  const split = (rs: RunRec[]) => ROUTES.map((r) => `${cfg.adult_branch!.route_names[r]} ${(100 * rs.filter((x) => x.route === r).length / Math.max(1, rs.length)).toFixed(1)}%`).join('／');
  console.log(`分流（全部打法合併）：${split(pool)}`);
  // 每分位每條路 ≥ 1%（用滿隨機打法 B／C 只有 Q1、Q5；另跑一組各分位隨機用滿）
  const perQ: Record<number, RunRec[]> = {};
  { const pol = makeRng(seed0 ^ 0x77); for (let q = 1; q <= 5; q++) { perQ[q] = []; for (let n = 0; n < Math.min(N, 2000); n++) { const g = newGame(q, seed0 + n * 104729); g.setTalent({});
    while (g.phase !== 'review') { if (g.phase === 'choice') { g.chooseSchool(botSchoolChoice(g, CH)); continue; } if (g.phase === 'branch') { g.chooseBranch(botBranchChoice(g, BR)); continue; } if (g.phase === 'housing') { g.chooseHousing(botHousingChoice(g, HO)); continue; }
      for (;;) { const p = g.playable(); if (!p.length) break; g.play(p[Math.floor(pol.next() * p.length)].uid); } g.endYear(); }
    perQ[q].push({ q, route: g.route ?? 'none', score: g.score(), post: g.score() - (g.scoreAtSplit ?? 0), sick: g.sickCount > 0, ending: g.endingId(), loan: g.hasLoan }); } } }
  for (let q = 1; q <= 5; q++) { const rs = perQ[q]; const min = Math.min(...ROUTES.map((r) => rs.filter((x) => x.route === r).length / rs.length));
    chk(`分流・Q${q} 每條路 ≥ 1%`, min >= 0.01, split(rs)); }
  // 三條路各自：有錢打滿 ≥ 窮打滿、打最差 ≤ 躺平 + tol、病倒率
  const mean = (rs: RunRec[]) => rs.reduce((a, x) => a + x.score, 0) / Math.max(1, rs.length);
  const sick = (rs: RunRec[]) => rs.filter((x) => x.sick).length / Math.max(1, rs.length);
  for (const r of ROUTES) { const f = (lbl: string) => all(lbl).filter((x) => x.route === r); const nm = cfg.adult_branch!.route_names[r];
    const [b, c, d, a, bw, cw] = [B, C, D, A, Bw, Cw].map((x) => f(x.label));
    const post = (rs: RunRec[]) => rs.reduce((s, x) => s + x.post, 0) / Math.max(1, rs.length);
    if (b.length && c.length) chk(`${nm}・B 增量 − C 增量 ≤ 5（只算分流後：結束分數 − 分流當下分數）`, post(b) - post(c) <= 5, `C ${post(c).toFixed(1)}（${c.length} 局） vs B ${post(b).toFixed(1)}（${b.length} 局），差 ${(post(b) - post(c)).toFixed(1)}；參考：13 歲起累計 C ${mean(c).toFixed(1)} vs B ${mean(b).toFixed(1)}`); else console.log(`${nm}・C ≥ B：樣本不足（B ${b.length}／C ${c.length}）`);
    const dd = d.length ? mean(d) : D.mean, aa = a.length ? mean(a) : A.mean;
    if (bw.length) chk(`${nm}・B− ≤ D + ${tol}`, mean(bw) <= dd + tol, `B− ${mean(bw).toFixed(1)}（${bw.length} 局） vs D ${dd.toFixed(1)}`);
    if (cw.length) chk(`${nm}・C− ≤ A + ${tol}`, mean(cw) <= aa + tol, `C− ${mean(cw).toFixed(1)}（${cw.length} 局） vs A ${aa.toFixed(1)}`);
    const norm = [B, C, Bg, Cg].map((x) => f(x.label)).flat(); chk(`${nm}・病倒 一般打法 < 5%`, sick(norm) < 0.05, `${(100 * sick(norm)).toFixed(1)}%`);
    const pas = [A, D].map((x) => f(x.label)).flat(); chk(`${nm}・病倒 躺平 0%`, sick(pas) === 0, `${(100 * sick(pas)).toFixed(1)}%`);
    const ends = new Map<string, number>(); for (const x of [...pool.filter((x) => x.route === r), ...Object.values(perQ).flat().filter((x) => x.route === r)]) if (x.ending) ends.set(x.ending, (ends.get(x.ending) ?? 0) + 1);
    chk(`${nm}・至少 3 種結局`, ends.size >= 3, [...ends].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join('、'));
  }
  const study = Object.values(perQ).flat().filter((x) => x.route === 'uni' || x.route === 'uni_tech');
  const lr = study.filter((x) => x.loan).length / Math.max(1, study.length);
  chk('學貸・讀大學或科大約兩成（假設 10–30%）', lr >= 0.1 && lr <= 0.3, `${(100 * lr).toFixed(1)}%（各分位隨機用滿）`);
  const allEnd = new Set([...pool, ...Object.values(perQ).flat()].map((x) => x.ending)); console.log(`全部結局種類：${allEnd.size}（${[...allEnd].join('、')}）`);
}
console.log(fail ? `\n✗ ${fail} 項未通過` : '\n全部通過'); process.exit(fail ? 1 : 0);
