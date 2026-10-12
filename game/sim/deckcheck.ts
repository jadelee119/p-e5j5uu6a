// §6 驗收：npx tsx sim/deckcheck.ts [次數] [種子]
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGameData } from '../src/logic/load';
import { DeckGame, drawablePool, type CardDef, type DeckConfig } from '../src/logic/deck';
import { makeRng } from '../src/logic/rng';
import { STATS, type StatId } from '../src/logic/types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rj = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const data = buildGameData({
  eventFiles: readdirSync(join(root, 'data/events')).filter((f) => f.endsWith('.json')).map((f) => rj(`data/events/${f}`)),
  endings: rj('data/endings.json'), countiesJson: rj('data/counties.json'), balance: rj('data/balance.json'),
  birthYears: rj('data/birth_years.json'), eraTerms: rj('data/era_terms.json'), opening: rj('data/opening.json'),
  narrationMd: readFileSync(join(root, 'writing/stage_narrations.md'), 'utf8'),
});
const cfg = rj('data/deck/config.json') as DeckConfig; const cards = rj('data/deck/cards.json').cards as CardDef[];
const N = Number(process.argv[2] ?? 5000); const seed0 = Number(process.argv[3] ?? 2026);
let fail = 0;

function newGame(q: number, seed: number) {
  // 強制分位：重抽種子直到開局分位符合（沿用原本開局機率，不改引擎）
  for (let s = seed; ; s += 7919) { const g = new DeckGame(data, cfg, cards, s); if (g.quintile === q) return g; }
}
type Policy = 'passive' | 'full' | 'greedy' | 'worst';
const W = cfg.score.weights;
const value = (g: DeckGame, i: any) => g.scoreValue(i) / Math.max(1, g.costOf(i) ?? 1);
interface R { label: string; sick: number; expect: number; mean: number; statMean: number; plays: number; stat: Record<StatId, number> }
const rows: R[] = [];
function run(label: string, q: number, policy: Policy): R {
  const pol = makeRng(seed0 ^ (q * 31 + policy.length)); let sum = 0, sumStat = 0, plays = 0, sickN = 0, expN = 0; const missed = new Map<string, number>();
  const stat = Object.fromEntries(STATS.map((k) => [k, 0])) as Record<StatId, number>;
  for (let n = 0; n < N; n++) {
    const g = newGame(q, seed0 + n * 104729);
    g.setTalent({}); let sk = false, ex = false;
    while (g.phase !== 'review') {
      const limit = policy === 'passive' ? pol.int(0, 1) : Infinity; let k = 0;
      while (k < limit) { const p = g.playable(); if (!p.length) break;
        let i = p[Math.floor(pol.next() * p.length)];
        if (policy === 'greedy') i = p.reduce((m, x) => value(g, x) > value(g, m) ? x : m);
        if (policy === 'worst') i = p.reduce((m, x) => value(g, x) < value(g, m) ? x : m);
        if (g.effectsFor(i).expect) ex = true; g.play(i.uid); k++; plays++; }
      g.endYear();
    }
    if (g.sickCount) sickN++; if (ex) expN++;
    const tagPart = g.tagBonus();
    sum += g.score(); sumStat += g.score() - tagPart;
    const d = g.deltas(); for (const k of STATS) stat[k] += d[k] / N;
    for (const m of g.missed) missed.set(m.id, (missed.get(m.id) ?? 0) + 1);
  }
  const r = { label, sick: sickN / N, expect: expN / N, mean: sum / N, statMean: sumStat / N, plays: plays / N, stat };
  console.log(`${label}: 變化量平均 ${r.mean.toFixed(1)}（屬性部分 ${r.statMean.toFixed(1)}）・每局出牌 ${r.plays.toFixed(2)} 張・`
    + STATS.map((k) => `${k} ${stat[k] >= 0 ? '+' : ''}${stat[k].toFixed(1)}`).join(' ')
    + `・病倒 ${(100 * r.sick).toFixed(1)}%・期待 ${(100 * r.expect).toFixed(1)}%` + `・錯過率 ${[...missed].map(([k, v]) => `${k} ${(100 * v / N).toFixed(0)}%`).join('、') || '無'}`);
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
chk('C ≥ B', C.mean >= B.mean, `C ${C.mean.toFixed(1)} vs B ${B.mean.toFixed(1)}`);
chk('B− ≤ D + 5', Bw.mean <= D.mean + 5, `B− ${Bw.mean.toFixed(1)} vs D ${D.mean.toFixed(1)}`);
chk('C− ≤ A + 5', Cw.mean <= A.mean + 5, `C− ${Cw.mean.toFixed(1)} vs A ${A.mean.toFixed(1)}`);
// 躺平結局：A / D 判定為躺平，且文字依家境不同
const pe = (q: number) => { const g = newGame(q, seed0); g.setTalent({}); while (g.phase !== 'review') g.endYear(); return g.passiveEnding(); };
const texts = [1, 2, 3, 4, 5].map(pe);
chk('躺平結局依家境不同', !!texts[0] && !!texts[4] && texts[0] !== texts[4] && texts[2] !== texts[0] && texts[2] !== texts[4],
  texts.map((t, k) => `Q${k + 1}「${(t ?? '（無）').slice(0, 10)}…」`).join(' '));
// 病倒可觸發：每年把能打的牌中壓力加最多的先打（壓力最大化貪婪），跨分位跑多個種子，至少要觸發一次
{
  const th = cfg.forced.f_sick.stress_at_least; let maxStress = 0, sickRuns = 0, expRuns = 0;
  for (let n = 0; n < N; n++) {
    const g = newGame((n % 5) + 1, seed0 + n * 104729); g.setTalent({}); let sick = false, ex = false;
    while (g.phase !== 'review') {
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
for (let q = 1; q <= 5; q++) for (const age of cfg.ages) { const p = drawablePool(cfg, cards, q, age);
  const ok = p.length >= 6; if (!ok) fail++;
  console.log(`Q${q} ${age}歲：${p.length} 張 ${ok ? '' : '✗ '}(${p.join(',')})`); }
const echoes = cards.filter((c) => c.expires_age !== null && c.echo && c.echo.age >= 16 && c.echo.age <= 22);
console.log(`\n有 16–22 歲回響的可錯過牌：${echoes.length} 張（門檻 3）${echoes.length >= 3 ? '' : ' ✗'}`); if (echoes.length < 3) fail++;
console.log(fail ? `\n✗ ${fail} 項未通過` : '\n全部通過'); process.exit(fail ? 1 : 0);
