// 五專 B4／v0.9 卡片檢查：npx tsx sim/jccheck.ts [次數]
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
const N = Number(process.argv[2] ?? 6000);
const ROUTE_ACTS = new Set(['uni_club', 'uni_date', 'mil_drill', 'mil_guard', 'mil_leave', 'job_overtime', 'job_hunt',
  ...Object.entries(data.balance.actions as Record<string, any>).filter(([, a]) => (a.flags_any ?? []).some((f: string) => /^(uni_|military_first|work_first)/.test(f))).map(([k]) => k)]);
const ROUTES = ['uni_tech', 'uni_normal', 'military_first', 'work_first', 'uni_top'];
const fail: Record<string, number> = {}; const cnt: Record<string, number> = {};
const bad = (k: string, msg: string) => { if (!fail[k]) console.log('FAIL', k, msg); fail[k] = (fail[k] ?? 0) + 1; };
const inc = (k: string) => (cnt[k] = (cnt[k] ?? 0) + 1);
const pol = makeRng(7777);
for (let i = 0; i < N; i++) {
  const seed = 120000 + i; const g = new Game(data, seed); let guard = 0;
  let b4 = ''; let b4Flags = new Set<string>(); const grads: { age: number; flags: Set<string> }[] = []; let gradRoutePre = '';
  const seenActs18_19 = new Set<string>();
  while (g.s.phase !== 'ending' && guard++ < 500) {
    const p = g.s.phase; const age = (g as any).turnDef.age as number;
    if (p === 'ap') {
      const all = g.availableActions();
      if (g.s.flags.has('jc_continue') && (age === 18 || age === 19) && !ROUTES.some((r) => g.s.flags.has(r))) {
        inc('jc_ap_turns_18_19'); for (const a of all) { seenActs18_19.add(a.id); if (ROUTE_ACTS.has(a.id)) bad('2_route_action', `seed ${seed} age ${age} ${a.id}`); }
      }
      const acts = all.filter((a) => !g.actionLock(a.id, g.s.stats.wealth));
      const alloc: Partial<Record<ActionId, number>> = {};
      for (let k = 0; k < g.apForTurn(); k++) { const a = acts[Math.floor(pol.next() * acts.length)] ?? acts[0]; if (a) alloc[a.id] = (alloc[a.id] ?? 0) + 1; }
      try { g.applyActions(alloc); } catch { g.applyActions({}); }
    } else if (p === 'event') {
      const ev = g.s.current!.event; const f = new Set(g.s.flags);
      if (ev.type === 'branch' && ev.id.endsWith('_B4')) { b4 = ev.id; b4Flags = f; }
      if (ev.id === 'adult_jc_graduate_01') { grads.push({ age, flags: f }); gradRoutePre = ROUTES.filter((r) => f.has(r)).join(','); }
      if (ev.id === 'adult_jc_project_01') { inc('project_drawn');
        if (!(f.has('hs_junior_college') && f.has('voc_study')) || ['military_first', 'work_first', 'uni_top', 'uni_normal'].some((x) => f.has(x))) bad('4_project_cond', `seed ${seed} ${[...f]}`); }
      if (ev.id === 'senior_voc_tvee_result_01') { inc('tvee_drawn'); if (!f.has('hs_vocational') || f.has('voc_work')) bad('4_tvee_cond', `seed ${seed}`); }
      const ch = ev.choices.map((c, idx) => ({ c, idx })).filter((x) => !g.choiceLocked(x.c));
      g.choose(ch[Math.floor(pol.next() * ch.length)].idx);
    } else if (p === 'result') g.continueAfterResult();
    else if (p === 'summary') g.ackSummary();
  }
  const F = g.s.flags;
  if (g.s.phase !== 'ending') bad('stuck', `seed ${seed}`);
  // (1)
  const jcStudy = b4Flags.has('hs_junior_college') && b4Flags.has('voc_study');
  if (jcStudy) { inc('jc_voc_study'); if (b4 !== 'adult_branch_jc_B4') bad('1_jc_B4_missing', `seed ${seed} got ${b4}`); }
  else if (b4 === 'adult_branch_jc_B4') bad('1_jc_B4_leak', `seed ${seed}`);
  if (F.has('hs_junior_college') && F.has('voc_work')) { inc('jc_voc_work'); if (b4 !== 'adult_branch_future_B4') bad('1_quit_normal_B4', `seed ${seed} got ${b4}`); }
  // (3)
  if (F.has('jc_continue')) { inc('jc_continue');
    if (grads.length !== 1) inc('miss_at20:' + (g.s.log.find((l: any) => l.turn === 14)?.eventId)); if (grads.length !== 1) bad('3_grad_count', `seed ${seed} n=${grads.length} endTurn=${g.s.turn} ending=${(g.s as any).ending?.id ?? (g.s as any).endingId} log=${g.s.log.slice(-4).map((l: any) => l.eventId)}`);
    else if (grads[0].age !== 20) bad('3_grad_age', `seed ${seed}`);
    if (gradRoutePre) bad('3_route_before_grad', `seed ${seed} ${gradRoutePre}`);
    const r = ['uni_tech', 'uni_normal', 'military_first', 'work_first'].filter((x) => F.has(x));
    if (r.length !== 1) bad('3_route_after', `seed ${seed} ${r}`); else inc('grad_' + r[0]);
  } else if (grads.length) bad('3_grad_leak', `seed ${seed}`);
  if (seenActs18_19.size) for (const a of seenActs18_19) inc('act18_19:' + a);
}
console.log('runs', N); console.log('counts', cnt); console.log('failures', fail);
console.log(Object.keys(fail).length ? 'RESULT: FAIL' : 'RESULT: PASS'); process.exit(Object.keys(fail).length ? 1 : 0);
