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
  const miss = g.regretMissed().map((m) => m.id);
  const drawn = g.expiringDrawn().length; // b1205fe：不含誘惑牌
  return { miss, drawn };
}
const high = (m: number, d: number) => d >= 2 && m / d >= 0.75;
interface R { n: number; hi: number; d: number[] }
function run(q: number | 'mix', policy: Policy) { const r: R = { n: 0, hi: 0, d: [] };
  for (const seed0 of seeds) { const pol = makeRng(seed0 ^ ((q === 'mix' ? 0 : q) * 31 + policy.length));
    for (let n = 0; n < N; n++) { const qq = q === 'mix' ? (n % 5) + 1 : q;
      const { miss, drawn } = one(newGame(qq, seed0 + n * 104729), policy, pol);
      r.n++; r.d.push(drawn); if (high(miss.length, drawn)) r.hi++; } }
  return r; }
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const out: string[] = []; const L = (s: string) => { out.push(s); console.log(s); };
const pols: [string, Policy][] = [['每年0–1張（躺平）', 'passive'], ['用滿隨機', 'full'], ['挑最好', 'greedy'], ['挑最差', 'worst'], ['壓力最大化', 'stress']];
L(`比例版遺憾多（抽到會過期牌≥2 且錯過≥75%）：每格 ${N} 局 × 種子 ${seeds.join('、')}`);
L('\n| 玩法 | Q1 | Q2 | Q3 | Q4 | Q5 | 最大差 | 抽到<2 比例 |\n|---|---|---|---|---|---|---|---|');
for (const [lab, p] of pols) { const rs = [1,2,3,4,5].map((q) => run(q, p)); const v = rs.map((r) => r.hi / r.n);
  const lt2 = rs.reduce((s, r) => s + r.d.filter((x) => x < 2).length, 0) / rs.reduce((s, r) => s + r.n, 0);
  L(`| ${lab} | ${v.map(pct).join(' | ')} | ${(100*(Math.max(...v)-Math.min(...v))).toFixed(1)} 點 | ${pct(lt2)} |`); }
