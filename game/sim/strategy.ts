// 刻意路線模擬：npm exec tsx sim/strategy.ts -- 每策略次數
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
  eventFiles: readdirSync(evDir).filter((f) => f.endsWith('.json')).map((f) => rj(`data/events/${f}`)),
  endings: rj('data/endings.json'),
  countiesJson: existsSync(join(root, 'data/counties.json')) ? rj('data/counties.json') : undefined,
  balance: rj('data/balance.json'), birthYears: rj('data/birth_years.json'), eraTerms: rj('data/era_terms.json'),
  opening: existsSync(join(root, 'data/opening.json')) ? rj('data/opening.json') : undefined,
  narrationMd: readFileSync(join(root, 'writing/stage_narrations.md'), 'utf8'),
});
type S = { name: string; target: string; acts: string[]; flags: string[]; qmax?: number; qmin?: number };
const STRATS: S[] = [
  { name: '技職：讀高職、實習考照', target: '技職之光', acts: ['voc_intern', 'voc_license', 'study', 'exercise'], flags: ['hs_vocational'] },
  { name: '志願役：先當兵、簽約', target: '志願役', acts: ['mil_drill', 'mil_leave', 'exercise', 'socialize'], flags: ['military_first', 'signed_volunteer'] },
  { name: '存款：直接工作、加班', target: '存款很漂亮', acts: ['job_overtime', 'work', 'study'], flags: ['work_first'] },
  { name: '追夢：學才藝、大學玩社團', target: '追夢的人', acts: ['talent', 'uni_club', 'play', 'socialize'], flags: ['path_talent', 'uni_tech', 'uni_normal'] },
  { name: '學位與帳單：Q1–Q2 讀大學', target: '學位與帳單', acts: ['study', 'cram', 'exercise', 'rest'], flags: ['uni_top', 'uni_normal', 'uni_tech'], qmax: 2 },
  { name: '逆風：Q1–Q2 拚命讀書', target: '逆風飛行', acts: ['study', 'cram', 'rest', 'exercise'], flags: ['hs_elite', 'hs_normal', 'uni_top', 'uni_normal'], qmax: 2 },
  { name: '還沒出發：Q4–Q5 都在玩', target: '還沒出發', acts: ['play', 'rest', 'socialize'], flags: [], qmin: 4 },
  { name: '平凡就是福：玩樂交朋友運動', target: '平凡就是福', acts: ['socialize', 'play', 'exercise', 'mil_leave', 'uni_club'], flags: [] },
];
const N = Number(process.argv[2] ?? 2000);
console.log('| 策略 | 目標結局 | 達成率 | 最常見結局 |\n|---|---|---|---|');
for (const st of STRATS) {
  const pol = makeRng(777); let hit = 0, n = 0; const ends = new Map<string, number>();
  for (let i = 0; n < N && i < N * 20; i++) {
    const g = new Game(data, 50000 + i);
    if ((st.qmax && g.s.quintile > st.qmax) || (st.qmin && g.s.quintile < st.qmin)) continue;
    n++; let guard = 0;
    while (g.s.phase !== 'ending' && guard++ < 500) {
      const p = g.s.phase;
      if (p === 'ap') {
        const alloc: Partial<Record<ActionId, number>> = {}; const acts = g.availableActions(); let w = g.s.stats.wealth;
        for (let k = 0; k < g.apForTurn(); k++) {
          const ok = acts.filter((a) => !g.actionLock(a.id, w));
          const stressed = g.s.stats.stress >= 70;
          const pref = stressed ? ok.filter((a) => a.id === 'rest' || a.id === 'exercise') : st.acts.map((id) => ok.find((a) => a.id === id)).filter(Boolean) as typeof ok;
          const pool = pref.length ? pref : ok;
          const a = pool[k % pool.length];
          alloc[a.id] = (alloc[a.id] ?? 0) + 1;
          if (a.id === 'cram') w -= 5; if (a.id === 'talent') w -= 4;
        }
        g.applyActions(alloc);
      } else if (p === 'event') {
        const ch = g.s.current!.event.choices.map((c, idx) => ({ c, idx })).filter((x) => !g.choiceLocked(x.c));
        const want = ch.find((x) => (x.c.set_flags ?? []).some((f: string) => st.flags.includes(f)));
        g.choose((want ?? ch[Math.floor(pol.next() * ch.length)]).idx);
      } else if (p === 'result') g.continueAfterResult();
      else if (p === 'summary') g.ackSummary();
    }
    const t = g.ending().title; ends.set(t, (ends.get(t) ?? 0) + 1); if (t === st.target) hit++;
  }
  const top = [...ends].sort((a, b) => b[1] - a[1])[0];
  console.log(`| ${st.name} | ${st.target} | ${(100 * hit / n).toFixed(1)}% | ${top[0]} ${(100 * top[1] / n).toFixed(0)}% |`);
}
