// 沒走的路統計：npx tsx sim/missedstats.ts [次數] [種子...]（政策與 deckcheck.ts 相同，只統計不改玩法）
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGameData } from '../src/logic/load';
import { DeckGame, botSchoolChoice, type CardDef, type DeckConfig } from '../src/logic/deck';
import { makeRng } from '../src/logic/rng';
const CH = makeRng(0x5c4001); // 選校用（獨立於出牌亂數）

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rj = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const data = buildGameData({
  eventFiles: readdirSync(join(root, 'data/events')).filter((f) => f.endsWith('.json')).map((f) => rj(`data/events/${f}`)),
  endings: rj('data/endings.json'), countiesJson: rj('data/counties.json'), balance: rj('data/balance.json'),
  birthYears: rj('data/birth_years.json'), eraTerms: rj('data/era_terms.json'), opening: rj('data/opening.json'),
  narrationMd: readFileSync(join(root, 'writing/stage_narrations.md'), 'utf8'),
});
const cfg = rj('data/deck/config.json') as DeckConfig; const cards = rj('data/deck/cards.json').cards as CardDef[];
const name = (id: string) => (cards.find((c) => c.id === id) as any)?.name ?? id;
const N = Number(process.argv[2] ?? 5000);
const seeds = process.argv.slice(3).map(Number); if (!seeds.length) seeds.push(2026, 7, 31337);
type Policy = 'passive' | 'full' | 'greedy' | 'worst' | 'stress';
const value = (g: DeckGame, i: any) => g.scoreValue(i) / Math.max(1, g.costOf(i) ?? 1);
function newGame(q: number, seed: number) { for (let s = seed; ; s += 7919) { const g = new DeckGame(data, cfg, cards, s); if (g.quintile === q) return g; } }
function one(g: DeckGame, policy: Policy, pol: ReturnType<typeof makeRng>) {
  g.setTalent({});
  while (g.phase !== 'review') { if (g.phase === 'choice') { g.chooseSchool(botSchoolChoice(g, CH)); continue; }
    if (policy === 'stress') {
      for (;;) { const p = g.playable(); if (!p.length) break;
        const i = p.reduce((m, x) => (g.effectsFor(x).eff.stress ?? 0) > (g.effectsFor(m).eff.stress ?? 0) ? x : m);
        if ((g.effectsFor(i).eff.stress ?? 0) < -(cfg.rest_stress_per_slot ?? 0) * (g.costOf(i) ?? 1)) break; g.play(i.uid); }
    } else {
      const limit = policy === 'passive' ? pol.int(0, 1) : Infinity; let k = 0;
      while (k < limit) { const p = g.playable(); if (!p.length) break;
        let i = p[Math.floor(pol.next() * p.length)];
        if (policy === 'greedy') i = p.reduce((m, x) => value(g, x) > value(g, m) ? x : m);
        if (policy === 'worst') i = p.reduce((m, x) => value(g, x) < value(g, m) ? x : m);
        g.play(i.uid); k++; }
    }
    g.endYear();
  }
  return g.missed.map((m) => m.id);
}
interface Acc { counts: number[]; cards: Map<string, number>; n: number }
const acc = (): Acc => ({ counts: [], cards: new Map(), n: 0 });
function run(q: number | 'mix', policy: Policy, a: Acc) {
  for (const seed0 of seeds) {
    const pol = makeRng(seed0 ^ ((q === 'mix' ? 0 : q) * 31 + policy.length));
    for (let n = 0; n < N; n++) {
      const qq = q === 'mix' ? (n % 5) + 1 : q;
      const ids = one(newGame(qq, seed0 + n * 104729), policy, pol);
      a.counts.push(ids.length); a.n++; for (const id of new Set(ids)) a.cards.set(id, (a.cards.get(id) ?? 0) + 1);
    }
  }
  return a;
}
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
function summ(a: Acc) {
  const c = [...a.counts].sort((x, y) => x - y); const n = c.length;
  const dist = [0, 1, 2, 3, 4, 5].map((k) => c.filter((v) => (k === 5 ? v >= 5 : v === k)).length / n);
  const ge = (k: number) => c.filter((v) => v >= k).length / n;
  return { dist, mean: c.reduce((s, v) => s + v, 0) / n, median: c[Math.floor(n / 2)], p67: c[Math.floor(n * 2 / 3)], max: c[n - 1], ge };
}
const bots: [string, number | 'mix', Policy][] = [
  ['A Q5・每年0–1張', 5, 'passive'], ['B Q1・用滿隨機', 1, 'full'], ['C Q5・用滿隨機', 5, 'full'], ['D Q1・每年0–1張', 1, 'passive'],
  ['B+ Q1・挑最好', 1, 'greedy'], ['B− Q1・挑最差', 1, 'worst'], ['C+ Q5・挑最好', 5, 'greedy'], ['C− Q5・挑最差', 5, 'worst'],
  ['高壓 Q1–5輪流・壓力最大化', 'mix', 'stress'],
];
const out: string[] = [];
const L = (s: string) => { out.push(s); console.log(s); };
L(`每個 bot：${N} 局 × 種子 ${seeds.join('、')}（共 ${N * seeds.length} 局）`);
L('\n| bot | 0 | 1 | 2 | 3 | 4 | 5+ | 平均 | 中位數 | ≥2 | ≥3 | ≥4 | 最大 |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const all = acc(); const perBot: [string, Acc][] = [];
for (const [lab, q, p] of bots) { const a = run(q, p, acc()); perBot.push([lab, a]); const s = summ(a);
  a.counts.forEach((v) => all.counts.push(v));
  L(`| ${lab} | ${s.dist.map(pct).join(' | ')} | ${s.mean.toFixed(2)} | ${s.median} | ${pct(s.ge(2))} | ${pct(s.ge(3))} | ${pct(s.ge(4))} | ${s.max} |`); }
{ const s = summ(all); L(`| **全部 bot 合併** | ${s.dist.map(pct).join(' | ')} | ${s.mean.toFixed(2)} | ${s.median} | ${pct(s.ge(2))} | ${pct(s.ge(3))} | ${pct(s.ge(4))} | ${s.max} |`); }
for (const [lab, p] of [['B/C 用滿隨機', 'full'], ['每年0–1張（A/D）', 'passive'], ['挑最好（B+/C+）', 'greedy']] as [string, Policy][]) {
  L(`\n### 分位拆解：${lab}\n\n| 分位 | 0 | 1 | 2 | 3 | 4 | 5+ | 平均 | 中位數 | ≥3 |\n|---|---|---|---|---|---|---|---|---|---|`);
  for (let q = 1; q <= 5; q++) { const s = summ(run(q, p, acc()));
    L(`| Q${q} | ${s.dist.map(pct).join(' | ')} | ${s.mean.toFixed(2)} | ${s.median} | ${pct(s.ge(3))} |`); }
}
L('\n### 最常錯過的牌（該 bot 中有錯過此牌的局數比例，前 6）\n');
for (const [lab, a] of perBot) L(`- ${lab}：` + ([...a.cards].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k, v]) => `${name(k)}（${k}）${pct(v / a.n)}`).join('、') || '無'));
