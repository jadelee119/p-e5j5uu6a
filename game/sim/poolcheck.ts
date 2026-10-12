// 路線×年齡事件池檢查（取代舊「每回合無條件卡≥4」）：每條路線、每個隨機回合年齡，條件可成立的隨機卡 ≥ 4。npx tsx sim/poolcheck.ts [次數]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGameData } from '../src/logic/load';
import { Game, TURNS, type ActionId } from '../src/logic/engine';
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
const N = Number(process.argv[2] ?? 6000); const MIN = 4;
const routeOf = (F: Set<string>) => {
  const hs = ['hs_elite', 'hs_normal', 'hs_vocational', 'hs_junior_college'].find((x) => F.has(x));
  const parts = [hs ?? '(pre-hs)'];
  for (const x of ['voc_study', 'voc_work', 'jc_continue']) if (F.has(x)) parts.push(x);
  const r = ['uni_top', 'uni_normal', 'uni_tech', 'military_first', 'work_first'].find((x) => F.has(x)); if (r) parts.push(r);
  return parts.join('+');
};
type Cell = { union: Set<string>; min: number; obs: number };
const cells = new Map<string, Cell>();
const pol = makeRng(5151);
for (let i = 0; i < N; i++) {
  const g = new Game(data, 200000 + i); let guard = 0; let lastTurn = -1;
  while (g.s.phase !== 'ending' && guard++ < 500) {
    const t = TURNS[g.s.turn];
    if (t?.random && lastTurn !== g.s.turn && (g.s.phase === 'ap' || g.s.phase === 'event')) {
      lastTurn = g.s.turn;
      // 注意：此時本回合的事件已抽，該卡已進 seenEvents；「可成立」只看條件，不扣已抽過的
      const pool = data.events.filter((e) => e.type === 'random' && (e.stage === t.stage || e.stage === 'any') && g.meets(e.conditions));
      const k = `${routeOf(g.s.flags)} @ ${t.age}`;
      const c = cells.get(k) ?? { union: new Set(), min: 99, obs: 0 }; c.obs++; c.min = Math.min(c.min, pool.length); pool.forEach((e) => c.union.add(e.id)); cells.set(k, c);
    }
    const p = g.s.phase;
    if (p === 'ap') {
      const acts = g.availableActions().filter((a) => !g.actionLock(a.id, g.s.stats.wealth));
      const alloc: Partial<Record<ActionId, number>> = {};
      for (let k = 0; k < g.apForTurn(); k++) { const a = acts[Math.floor(pol.next() * acts.length)] ?? acts[0]; if (a) alloc[a.id] = (alloc[a.id] ?? 0) + 1; }
      try { g.applyActions(alloc); } catch { g.applyActions({}); }
    } else if (p === 'event') {
      const ev = g.s.current!.event; const ch = ev.choices.map((c, idx) => ({ c, idx })).filter((x) => !g.choiceLocked(x.c));
      g.choose(ch[Math.floor(pol.next() * ch.length)].idx);
    } else if (p === 'result') g.continueAfterResult(); else if (p === 'summary') g.ackSummary();
  }
}
const keys = [...cells.keys()].sort();
const bad = keys.filter((k) => cells.get(k)!.union.size < MIN);
console.log(`runs ${N}, route×age cells ${keys.length}, cells < ${MIN}: ${bad.length}`);
for (const k of keys) { const c = cells.get(k)!; console.log(`${c.union.size < MIN ? 'FAIL' : ' ok '} ${k}  cards=${c.union.size} (per-turn min ${c.min}, n=${c.obs})${c.union.size < MIN ? '  ' + [...c.union].join(', ') : ''}`); }
console.log(bad.length ? 'RESULT: FAIL' : 'RESULT: PASS'); process.exit(bad.length ? 1 : 0);
