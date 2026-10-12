import './theme.css';
import './fonts.css';
import './style.css';
import './dark.css';
import '../../art/stat-bars/stat-bars.css';
import statLabels from '@data/stat_labels.json';
import { gameData } from './data';
import achData from '@data/achievements.json';
const achIcons = import.meta.glob('../../art/achievements/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const iconFor = (id: string) => Object.entries(achIcons).find(([p]) => p.endsWith(`/${id}.png`))?.[1];
const ACH = (achData as any).achievements as { id: string; name: string; desc: string; conditions?: any }[];
function achHtml(): string {
  const got = new Set<string>(JSON.parse(localStorage.getItem('achievements') ?? '[]'));
  const fresh = game.achievementsMet(ACH).filter((id) => !got.has(id)); fresh.forEach((id) => got.add(id)); // BUG-12：只有之前沒存過的才算新
  localStorage.setItem('achievements', JSON.stringify([...got]));
  const items = ACH.map((a) => { const has = got.has(a.id); const ic = has ? iconFor(a.id) : undefined;
    return `<div class="ach${has ? '' : ' locked'}${fresh.includes(a.id) ? ' new' : ''}">${ic ? `<img src="${ic}" alt="">` : `<span class="ach-q">${has ? '★' : '？'}</span>`}<div><b>${has ? esc(a.name) : '？？？'}</b>${has ? `<small class="muted">${esc(a.desc)}</small>` : ''}</div></div>`; }).join('');
  return `<div class="card"><h2>成就 ${got.size} / ${ACH.length}</h2><div class="achs">${items}</div></div>`;
}
import { illustrationFor, actionIconFor } from './illustrations';
import { Game, TURNS, type ActionId } from './logic/engine';
import { STATS, STAT_NAMES, STAGE_NAMES, type StatId } from './logic/types';

const OPENING_IMG = ['opening_moon', 'opening_dawn', 'opening_charm', 'opening_chain', 'opening_keys'];
// 深色模式：預設跟系統，手動切換後記在 localStorage
(() => {
  const root = document.documentElement; const saved = localStorage.getItem('theme');
  const apply = (t: string) => { root.dataset.theme = t; btn.textContent = t === 'dark' ? '☀️ 淺色' : '🌙 深色'; };
  const btn = document.createElement('button'); btn.className = 'theme-toggle'; btn.type = 'button';
  btn.onclick = () => { const t = root.dataset.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('theme', t); apply(t); };
  document.body.appendChild(btn);
  apply(saved ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
})();
const DECK_VERSION = 'v1.0 試玩一';
// 角落版本號（單一來源：package.json → Vite define __APP_VERSION__）
(() => {
  const el = document.createElement('div');
  el.className = 'app-version';
  // 新玩法（人生手牌）另計版本：v1.0 試玩N；舊玩法沿用 package.json
  const v = new URLSearchParams(location.search).get('mode') === 'deck' ? DECK_VERSION : __APP_VERSION__;
  el.textContent = v;
  el.title = '版本 ' + v;
  document.body.appendChild(el);
})();
const app = document.getElementById('app')!;
let game: Game; let alloc: Partial<Record<ActionId, number>> = {};
const tx = (s: string | undefined) => esc(game.t(s));
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function start(seed?: number) {
  const urlSeed = Number(new URLSearchParams(location.search).get('seed'));
  game = new Game(gameData, seed ?? (urlSeed || undefined));
  renderIntro();
}

// 上方六個值：屬性條 v1（art/stat-bars），只顯示 5 段長條＋文字標籤，不顯示數字（寬度由 data-lv 決定）
const SB_ICONS: Record<StatId, string> = {
academic:'<path d="M3 6c3-1.5 6-1.2 9 .6 3-1.8 6-2.1 9-.6v12c-3-1.4-6-1.1-9 .6-3-1.7-6-2-9-.6z"/><path d="M12 6.6v12"/>',
happiness:'<circle cx="12" cy="12" r="8.6"/><path d="M8.3 10h.1M15.6 10h.1M8 14.2c2.3 2.6 5.7 2.6 8 0"/>',
stress:'<path d="M4 15c0-4 3.5-7 8-7s8 3 8 7z"/><path d="M7 15l-1 4M12 15v4.5M17 15l1 4M9 5l1.5 1.6M14.6 4.5 13.4 6.4"/>',
health:'<path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/><path d="M8 12.5h2.2l1-2 1.7 4 1-2H16"/>',
social:'<circle cx="8.5" cy="9" r="3"/><circle cx="16" cy="9.5" r="2.6"/><path d="M3.5 19c.6-3.4 2.7-5 5-5s4.4 1.6 5 5M13.5 15c.8-.9 1.7-1.3 2.6-1.3 2 0 3.7 1.6 4.2 4.6"/>',
wealth:'<rect x="3.5" y="8" width="17" height="11" rx="2"/><path d="M8 8V6.3c0-1.1.9-2 2-2h4a2 2 0 0 1 2 2V8M3.5 12.5h17"/><circle cx="12" cy="14.6" r="1.3"/>'};
type StatLabel = { mins: number[]; labels: string[]; danger: { below?: number; atLeast?: number } };
const LABELS = statLabels as unknown as Record<StatId, StatLabel>;
const statLv = (k: StatId, v: number) => { const m = LABELS[k].mins; let lv = 1; m.forEach((x, i) => { if (v >= x) lv = i + 1; }); return lv; };
const statWord = (k: StatId, v: number) => LABELS[k].labels[statLv(k, v) - 1];
const isDanger = (k: StatId, v: number) => { const d = LABELS[k].danger; return (d.below !== undefined && v < d.below) || (d.atLeast !== undefined && v >= d.atLeast); };
const sbSvg = (k: StatId) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SB_ICONS[k]}</svg>`;
function statsHtml() {
  const s = game.s.stats;
  return `<div class="sb-grid">${STATS.map((k) => { const v = s[k]; const lv = statLv(k, v); const w = statWord(k, v);
    return `<div class="sb sb-${k}${isDanger(k, v) ? ' is-danger' : ''}" data-lv="${lv}" role="img" aria-label="${STAT_NAMES[k]}：${w}"><span class="sb-icon">${sbSvg(k)}</span><div class="sb-head"><span class="sb-name">${STAT_NAMES[k]}</span><span class="sb-label">${w}</span></div><div class="sb-bar"><i></i></div></div>`; }).join('')}</div>`;
}
// 蠟筆濾鏡（給長條毛邊），整頁放一次
document.body.insertAdjacentHTML('beforeend', '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="sb-crayon"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="2.2"/></filter></svg>');
/** 一次性點擊：點下去就定案，之後的點擊全部忽略（防連點） */
let committed = false;
function once(fn: () => void) { return () => { if (committed) return; committed = true; app.classList.add('committing'); setTimeout(() => { fn(); committed = false; app.classList.remove('committing'); }, 120); }; }
function header() {
  const t = TURNS[game.s.turn]; const s = game.s;
  return `<div class="card"><div class="muted">第 ${s.turn + 1}/${TURNS.length} 回合・${STAGE_NAMES[t.stage]}${t.label ? '・' + game.t(t.label) : ''}・${t.age} 歲（民國 ${game.minguoYear} 年）・${s.county.name}</div>${statsHtml()}</div>`;
}

function renderIntro() {
  const s = game.s;
  const fb = gameData.countiesSource === 'fallback' ? `<p class="warn">縣市修正值為暫代資料（data/counties.json 尚未產出）。</p>` : '';
  const op = game.openingText(); const opImg = illustrationFor(OPENING_IMG[s.quintile - 1]);
  app.innerHTML = `<h1>台灣人生 Roguelike 模擬器</h1>
  <div class="card${opImg ? ' has-pic' : ''}">${opImg ? `<figure class="polaroid tilt"><img src="${opImg}" alt=""></figure>` : ''}
  ${op ? `<p class="opening">${esc(op)}</p>` : ''}<p class="muted">民國 ${s.birthYear} 年（西元 ${s.birthYear + 1911} 年）・<b>${s.county.name}</b></p>
  
  <a class="deck-entry" href="?mode=deck">🃏 試玩新玩法：人生手牌 v1.0 試玩一（國中三年）</a>
  <p class="muted">這一次人生只有一次，選了就不能回頭。</p>${fb}
  <p class="muted">種子：${s.seed}</p><button class="primary" id="go">開始人生</button></div>`;
  document.getElementById('go')!.onclick = render;
}

function render() {
  const p = game.s.phase;
  if (p === 'ap') renderAp(); else if (p === 'event') renderEvent(); else if (p === 'result') renderResult();
  else if (p === 'summary') renderSummary(); else renderEnding();
  window.scrollTo(0, 0);
}

function renderAp() {
  const total = game.apForTurn();
  const used = Object.values(alloc).reduce<number>((a, b) => a + (b ?? 0), 0);
  const acts = game.availableActions();
  const penalty = TURNS[game.s.turn].ap && total < 5 && game.s.apPenalty ? '（崩潰後遺症：AP -1）' : '';
  app.innerHTML = header() + `<div class="card"><h2>分配行動點：剩 ${total - used} / ${total} ${penalty}</h2>
  ${acts.map((a) => { const lk = game.actionLock(a.id); const n = alloc[a.id] ?? 0;
    const ic = actionIconFor(a.id);
    return `<div class="act act-${a.id}">${ic ? `<img class="act-icon" src="${ic}" alt="" width="40" height="40">` : ''}<div class="act-body">${esc(a.name)}<div class="lk">${lk ? '🔒 ' + esc(lk) : `${a.flavor ? `<span class="act-flavor">${esc(a.flavor)}</span> ` : ''}<span class="act-arrows">${esc(a.desc)}</span>`}</div></div>
    <div><button data-a="${a.id}" data-d="-1" ${n === 0 ? 'disabled' : ''}>－</button><span class="n">${n}</span><button data-a="${a.id}" data-d="1" ${used >= total || lk ? 'disabled' : ''}>＋</button></div></div>`; }).join('')}
  <button class="primary" id="ok">確定${used < total ? `（還有 ${total - used} 點沒用）` : ''}</button></div>`;
  app.querySelectorAll<HTMLButtonElement>('button[data-a]').forEach((b) => b.onclick = () => {
    const id = b.dataset.a as ActionId; alloc[id] = Math.max(0, (alloc[id] ?? 0) + Number(b.dataset.d)); renderAp();
  });
  document.getElementById('ok')!.onclick = once(() => { game.applyActions(alloc); alloc = {}; render(); });
}

function renderEvent() {
  const cur = game.s.current!; const e = cur.event;
  const tag = e.type === 'branch' ? '<span class="tag">不可逆分岔</span>' : e.type === 'forced' ? '<span class="tag">強制事件</span>' : '';
  const img = illustrationFor(e.id);
  const pic = img ? `<figure class="polaroid tilt"><img src="${img}" alt="${tx(e.title)}" loading="eager"></figure>` : '';
  app.innerHTML = header() + `<div class="card${img ? ' has-pic' : ''}">${pic}${tag}<h2>${tx(e.title)}</h2><p>${tx(e.text)}</p>
  ${game.visibleChoices().map((i) => { const c = e.choices[i]!; const locked = game.choiceLocked(c);
    return `<button class="choice" data-i="${i}" ${locked ? 'disabled' : ''}>${locked ? '🔒 ' : ''}${tx(c.text)}${locked ? `<span class="lock">${esc(game.lockText(c) ?? '家裡負擔不起。')}</span>` : ''}</button>`; }).join('')}</div>`;
  app.querySelectorAll<HTMLButtonElement>('button.choice').forEach((b) => b.onclick = () => { if (committed) return; b.classList.add('chosen'); once(() => { game.choose(Number(b.dataset.i)); render(); })(); });
}

function renderResult() {
  const r = game.s.lastResult!;
  app.innerHTML = header() + `<div class="card"><div class="muted">${esc(r.title)}・你選了「${esc(r.choice)}」</div><p>${esc(r.text)}</p><button class="primary" id="ok">繼續</button></div>`;
  document.getElementById('ok')!.onclick = once(() => { game.continueAfterResult(); render(); });
}

function renderSummary() {
  const sm = game.s.summary!;
  const d = STATS.filter((k) => sm.deltas[k]).map((k) => { const v = sm.deltas[k]!;
    return `<span class="delta ${(k === 'stress' ? -v : v) > 0 ? 'up' : 'down'}">${STAT_NAMES[k]} ${Math.abs(v) >= 15 ? '大幅' : ''}${v > 0 ? '變多了' : '變少了'}</span>`; }).join('　');
  app.innerHTML = header() + `<div class="card"><h2>${sm.title}</h2><p class="pre">${esc(sm.text)}</p><p>${d || '這個階段，什麼都沒變。'}</p><button class="primary" id="ok">下一個階段</button></div>`;
  document.getElementById('ok')!.onclick = once(() => { game.ackSummary(); render(); });
}

function renderEnding() {
  const e = game.ending(); const r = game.review();
  const eImg = illustrationFor(`ending_${e.id}`);
  app.innerHTML = `<h1>結局：${esc(e.title)}</h1><div class="card ending-${e.id}${eImg ? ' has-pic' : ''}">${eImg ? `<figure class="polaroid tilt ending-pic sat-q${e.quintile}"><img src="${eImg}" alt=""></figure>` : ''}<p>${esc(e.text)}</p>${statsHtml()}</div>
  <div class="card"><h2>人生回顧相簿</h2><div class="album">${r.album.map((a, i) => { const img = illustrationFor(a.eventId);
    return `<figure class="polaroid ${i % 2 ? 'tilt-r' : 'tilt'}${img ? '' : ' no-pic'}"><span class="tape"></span>${img ? `<img src="${img}" alt="" loading="lazy">` : `<div class="blank">${esc(a.title)}</div>`}
    <figcaption><span class="tag">${a.stageName}</span><span class="cap">${esc(a.caption)}</span><small class="muted">${esc(a.title)}：${esc(a.choice)}</small></figcaption></figure>`; }).join('')}
    <figure class="polaroid tilt-r no-pic empty"><span class="tape"></span><div class="blank">22 歲以後</div><figcaption><span class="cap">（還沒拍）</span></figcaption></figure></div></div>
  <div class="card">${r.origin ? `<p><b>${esc(r.origin)}</b></p>` : ''}<p>${esc(r.effort)}</p><p>${esc(r.regret)}</p>${r.mountain ? `<h2>${esc(r.mountain.title)}</h2><p>${esc(r.mountain.text)}</p>` : ''}</div>
  ${achHtml()}<button class="primary" id="again">再活一次</button>`;
  document.getElementById('again')!.onclick = () => start(Math.floor(Math.random() * 2 ** 31));
}

if (new URLSearchParams(location.search).get('mode') === 'deck') {
  // v1.0 人生手牌雛形：另一個入口，原本玩法不受影響
  import('./deck-ui').then((m) => m.startDeck(app, (st) => { const keep = game; game = { s: { stats: st } } as any; const h = statsHtml(); game = keep; return h; }));
} else start();

