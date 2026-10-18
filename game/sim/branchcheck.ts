// 18 歲分流資格：npx tsx sim/branchcheck.ts [次數] [種子]（自然分位、隨機用滿；e9c6fc1 目標：普高 ~95% 至少能選大學或科大、高職 ~80% 能選科大）
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGameData } from '../src/logic/load';
import { DeckGame, botSchoolChoice, type CardDef, type DeckConfig } from '../src/logic/deck';
import { makeRng } from '../src/logic/rng';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rj = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const data = buildGameData({ eventFiles: readdirSync(join(root, 'data/events')).filter((f) => f.endsWith('.json')).map((f) => rj(`data/events/${f}`)),
  endings: rj('data/endings.json'), countiesJson: rj('data/counties.json'), balance: rj('data/balance.json'), birthYears: rj('data/birth_years.json'),
  eraTerms: rj('data/era_terms.json'), opening: rj('data/opening.json'), narrationMd: readFileSync(join(root, 'writing/stage_narrations.md'), 'utf8') });
const cfg = rj('data/deck/config.json') as DeckConfig; const cards = [...rj('data/deck/cards.json').cards, ...rj('data/deck/cards_adult.json').cards] as CardDef[];
const N = Number(process.argv[2] ?? 3000), seed0 = Number(process.argv[3] ?? 2026); const CH = makeRng(0x5c4001), pol = makeRng(seed0 ^ 99);
const acad: Record<string, number[]> = {}; const elig: Record<string, Record<string, number>> = {}; const cnt: Record<string, number> = {};
for (let n = 0; n < N; n++) { const g = new DeckGame(data, cfg, cards, seed0 + n * 104729, undefined, { adult: true }); g.setTalent({});
  while (g.phase !== 'branch' && g.phase !== 'review') { if (g.phase === 'choice') { g.chooseSchool(botSchoolChoice(g, CH)); continue; }
    for (;;) { const p = g.playable(); if (!p.length) break; g.play(p[Math.floor(pol.next() * p.length)].uid); } g.endYear(); }
  if (g.phase !== 'branch') continue; const t = g.track!; (acad[t] ??= []).push(g.stats.academic); cnt[t] = (cnt[t] ?? 0) + 1;
  const ok = g.branchOptions().filter((o) => !o.locked).map((o) => o.key); const e = (elig[t] ??= {});
  for (const k of ok) e[k] = (e[k] ?? 0) + 1; if (ok.includes('uni') || ok.includes('uni_tech')) e.any_study = (e.any_study ?? 0) + 1; }
const pct = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
for (const t of Object.keys(acad)) { const a = acad[t];
  console.log(`${t}（${cnt[t]} 人，${t === 'hs_5yr' ? '21 歲' : '19 歲'}開頭）學業 p5 ${pct(a, .05)} p20 ${pct(a, .2)} p50 ${pct(a, .5)} p80 ${pct(a, .8)}・可選：` + Object.entries(elig[t]).map(([k, v]) => `${k} ${(100 * v / cnt[t]).toFixed(1)}%`).join('、')); }
// 假玩家實際分流（botBranchChoice）：依高中路線、全體計
{ const { botBranchChoice, botHousingChoice } = await import('../src/logic/deck'); const HO = makeRng(0x40a5e); const BR = makeRng(0xb2a7c4); const pol2 = makeRng(seed0 ^ 7); const CH2 = makeRng(0x5c4001);
  const by: Record<string, Record<string, number>> = {}; const tot: Record<string, number> = {};
  for (let n = 0; n < N; n++) { const g = new DeckGame(data, cfg, cards, seed0 + n * 104729, undefined, { adult: true }); g.setTalent({});
    while (g.phase !== 'review') { if (g.phase === 'choice') { g.chooseSchool(botSchoolChoice(g, CH2)); continue; } if (g.phase === 'branch') { g.chooseBranch(botBranchChoice(g, BR)); continue; } if (g.phase === 'housing') { g.chooseHousing(botHousingChoice(g, HO)); continue; }
      for (;;) { const p = g.playable(); if (!p.length) break; g.play(p[Math.floor(pol2.next() * p.length)].uid); } g.endYear(); }
    const t = g.track!; (by[t] ??= {})[g.route!] = (by[t][g.route!] ?? 0) + 1; tot[t] = (tot[t] ?? 0) + 1; }
  const all: Record<string, number> = {}; for (const t of Object.keys(by)) for (const [k, v] of Object.entries(by[t])) all[k] = (all[k] ?? 0) + v;
  for (const t of [...Object.keys(by), 'ALL']) { const m = t === 'ALL' ? all : by[t]; const s = t === 'ALL' ? N : tot[t];
    console.log(`分流 ${t}（${s}）：` + ['uni', 'uni_tech', 'work_first'].map((k) => `${k} ${(100 * (m[k] ?? 0) / s).toFixed(1)}%`).join('、')); } }
