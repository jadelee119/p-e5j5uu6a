// 選校分流校準：npx tsx sim/trackcheck.ts [次數] [種子] [門檻...]
// 自然開局（家境分位照原本機率），假玩家三種打法（躺平、用滿隨機、挑最好）各 1/3，選校照 config.school_choice.sim_policy
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGameData } from '../src/logic/load';
import { DeckGame, botSchoolChoice, type CardDef, type DeckConfig } from '../src/logic/deck';
import { makeRng } from '../src/logic/rng';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rj = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const data = buildGameData({
  eventFiles: readdirSync(join(root, 'data/events')).filter((f) => f.endsWith('.json')).map((f) => rj(`data/events/${f}`)),
  endings: rj('data/endings.json'), countiesJson: rj('data/counties.json'), balance: rj('data/balance.json'),
  birthYears: rj('data/birth_years.json'), eraTerms: rj('data/era_terms.json'), opening: rj('data/opening.json'),
  narrationMd: readFileSync(join(root, 'writing/stage_narrations.md'), 'utf8'),
});
const cfg0 = rj('data/deck/config.json') as DeckConfig; const cards = rj('data/deck/cards.json').cards as CardDef[];
const N = Number(process.argv[2] ?? 3000); const seed0 = Number(process.argv[3] ?? 2026);
const ths = process.argv.slice(4).map(Number); if (!ths.length) ths.push(cfg0.school_choice!.general_academic_min ?? 0);
const value = (g: DeckGame, i: any) => g.scoreValue(i) / Math.max(1, g.costOf(i) ?? 1);
console.log(`門檻 → 普高/高職/五專（${N} 局，自然分位，打法 ${process.env.MODE ?? '躺平/隨機/挑最好各 1/3'}）｜16 歲學業中位數｜各分位普高率`);
for (const th of ths) {
  const cfg = { ...cfg0, school_choice: { ...cfg0.school_choice!, general_academic_min: th } };
  const pol = makeRng(seed0 ^ 99), CH = makeRng(0x5c4001); const cnt: Record<string, number> = {}; const acad: number[] = [];
  const qg: Record<number, [number, number]> = { 1: [0, 0], 2: [0, 0], 3: [0, 0], 4: [0, 0], 5: [0, 0] };
  for (let n = 0; n < N; n++) {
    const g = new DeckGame(data, cfg, cards, seed0 + n * 104729); g.setTalent({}); const mode = process.env.MODE === 'full' ? 1 : process.env.MODE === 'greedy' ? 2 : n % 3;
    while (g.age < 16 || g.phase !== 'choice') {
      const limit = mode === 0 ? pol.int(0, 1) : Infinity; let k = 0;
      while (k < limit) { const p = g.playable(); if (!p.length) break;
        const i = mode === 2 ? p.reduce((m, x) => value(g, x) > value(g, m) ? x : m) : p[Math.floor(pol.next() * p.length)]; g.play(i.uid); k++; }
      g.endYear();
    }
    acad.push(g.stats.academic); const t = botSchoolChoice(g, CH); cnt[t] = (cnt[t] ?? 0) + 1;
    qg[g.quintile][1]++; if (t === 'hs_general') qg[g.quintile][0]++;
  }
  acad.sort((a, b) => a - b); const p = (k: string) => `${(100 * (cnt[k] ?? 0) / N).toFixed(1)}%`;
  console.log(`學業≥${th}：普高 ${p('hs_general')}・高職 ${p('hs_vocational')}・五專 ${p('hs_5yr')}｜中位數 ${acad[N >> 1]}｜`
    + Object.entries(qg).map(([q, [a, b]]) => `Q${q} ${(100 * a / Math.max(1, b)).toFixed(0)}%`).join(' '));
}
