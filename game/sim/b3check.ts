// B3 分岔槽檢查：npx tsx sim/b3check.ts [次數] [事件檔路徑(可選，覆蓋 data/events)]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGameData } from '../src/logic/load';
import { Game, type ActionId } from '../src/logic/engine';
import { makeRng } from '../src/logic/rng';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rj = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const evDir = join(root, 'data/events');
const data = buildGameData({
  eventFiles: process.argv[3] ? [JSON.parse(readFileSync(process.argv[3], 'utf8'))] : readdirSync(evDir).filter((f) => f.endsWith('.json')).map((f) => rj(`data/events/${f}`)),
  endings: rj('data/endings.json'),
  countiesJson: existsSync(join(root, 'data/counties.json')) ? rj('data/counties.json') : undefined,
  balance: rj('data/balance.json'), birthYears: rj('data/birth_years.json'), eraTerms: rj('data/era_terms.json'),
  opening: existsSync(join(root, 'data/opening.json')) ? rj('data/opening.json') : undefined,
  narrationMd: readFileSync(join(root, 'writing/stage_narrations.md'), 'utf8'),
});
const N = Number(process.argv[2] ?? 5000);
const HS = ['hs_elite', 'hs_normal', 'hs_vocational', 'hs_junior_college'];
const tab = new Map<string, Map<string, number>>();
const pol = makeRng(4242);
for (let i = 0; i < N; i++) {
  const g = new Game(data, 90000 + i); let guard = 0; let b3 = '(skipped)';
  while (g.s.phase !== 'ending' && guard++ < 500) {
    const p = g.s.phase;
    if (p === 'ap') {
      const acts = g.availableActions().filter((a) => !g.actionLock(a.id, g.s.stats.wealth));
      const alloc: Partial<Record<ActionId, number>> = {};
      for (let k = 0; k < g.apForTurn(); k++) { const a = acts[Math.floor(pol.next() * acts.length)] ?? acts[0]; if (a) alloc[a.id] = (alloc[a.id] ?? 0) + 1; }
      try { g.applyActions(alloc); } catch { g.applyActions({}); }
    } else if (p === 'event') {
      const ev = g.s.current!.event; if (ev.type === 'branch' && ev.id.endsWith('_B3')) b3 = ev.id;
      const ch = ev.choices.map((c, idx) => ({ c, idx })).filter((x) => !g.choiceLocked(x.c));
      g.choose(ch[Math.floor(pol.next() * ch.length)].idx);
    } else if (p === 'result') g.continueAfterResult();
    else if (p === 'summary') g.ackSummary();
  }
  const hs = HS.find((f) => g.s.flags.has(f)) ?? '(none)';
  const m = tab.get(hs) ?? new Map(); m.set(b3, (m.get(b3) ?? 0) + 1); tab.set(hs, m);
}
for (const [hs, m] of tab) console.log(hs, Object.fromEntries(m));
