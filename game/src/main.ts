import './theme.css';
import './fonts.css';
import './style.css';
import { gameData } from './data';
import { illustrationFor } from './illustrations';
import { Game, TURNS, type ActionId } from './logic/engine';
import { STATS, STAT_NAMES, STAGE_NAMES } from './logic/types';

const app = document.getElementById('app')!;
let game: Game; let alloc: Partial<Record<ActionId, number>> = {};
const tx = (s: string | undefined) => esc(game.t(s));
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function start(seed?: number) {
  const urlSeed = Number(new URLSearchParams(location.search).get('seed'));
  game = new Game(gameData, seed ?? (urlSeed || undefined));
  renderIntro();
}

function statsHtml() {
  const s = game.s.stats;
  return `<div class="stats">${STATS.map((k) => `<div>${STAT_NAMES[k]} ${s[k]}<div class="bar ${k === 'stress' ? 'stress' + (s[k] >= 70 ? ' hot' : '') : ''}"><i style="width:${s[k]}%"></i></div></div>`).join('')}</div>`;
}
function header() {
  const t = TURNS[game.s.turn]; const s = game.s;
  return `<div class="card"><div class="muted">第 ${s.turn + 1}/${TURNS.length} 回合・${STAGE_NAMES[t.stage]}${t.label ? '・' + game.t(t.label) : ''}・${t.age} 歲（民國 ${game.minguoYear} 年）・${s.county.name}</div>${statsHtml()}</div>`;
}

function renderIntro() {
  const s = game.s;
  const fb = gameData.countiesSource === 'fallback' ? `<p class="warn">縣市修正值為暫代資料（data/counties.json 尚未產出）。</p>` : '';
  const op = game.openingText(); const opImg = illustrationFor(`opening_q${s.quintile}`);
  app.innerHTML = `<h1>台灣人生 Roguelike 模擬器</h1>
  <div class="card${opImg ? ' has-pic' : ''}">${opImg ? `<figure class="polaroid tilt"><img src="${opImg}" alt=""></figure>` : ''}
  ${op ? `<p class="opening">${esc(op)}</p>` : ''}<p class="muted">民國 ${s.birthYear} 年（西元 ${s.birthYear + 1911} 年）・<b>${s.county.name}</b></p>
  <p>你家的所得落在全國第 <b>${s.quintile}</b> 分位（Q${s.quintile}，1 最低、5 最高）。${s.flags.has('golden_spoon') ? '嘴裡含著一根金湯匙。' : ''}</p>
  <p class="muted">這一次人生只有一次，選了就不能回頭。</p>${statsHtml()}${fb}
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
  const used = Object.values(alloc).reduce((a, b) => a + (b ?? 0), 0);
  const acts = game.availableActions();
  const penalty = TURNS[game.s.turn].ap && total < 5 && game.s.apPenalty ? '（崩潰後遺症：AP -1）' : '';
  app.innerHTML = header() + `<div class="card"><h2>分配行動點：剩 ${total - used} / ${total} ${penalty}</h2>
  ${acts.map((a) => { const lk = game.actionLock(a.id); const n = alloc[a.id] ?? 0;
    return `<div class="act"><div>${a.name}<div class="lk">${lk ? '🔒 ' + lk : a.desc}</div></div>
    <div><button data-a="${a.id}" data-d="-1" ${n === 0 ? 'disabled' : ''}>－</button><span class="n">${n}</span><button data-a="${a.id}" data-d="1" ${used >= total || lk ? 'disabled' : ''}>＋</button></div></div>`; }).join('')}
  <button class="primary" id="ok">確定${used < total ? `（還有 ${total - used} 點沒用）` : ''}</button></div>`;
  app.querySelectorAll<HTMLButtonElement>('button[data-a]').forEach((b) => b.onclick = () => {
    const id = b.dataset.a as ActionId; alloc[id] = Math.max(0, (alloc[id] ?? 0) + Number(b.dataset.d)); renderAp();
  });
  document.getElementById('ok')!.onclick = () => { game.applyActions(alloc); alloc = {}; render(); };
}

function renderEvent() {
  const cur = game.s.current!; const e = cur.event;
  const tag = e.type === 'branch' ? '<span class="tag">不可逆分岔</span>' : e.type === 'forced' ? '<span class="tag">強制事件</span>' : '';
  const img = illustrationFor(e.id);
  const pic = img ? `<figure class="polaroid tilt"><img src="${img}" alt="${tx(e.title)}" loading="eager"></figure>` : '';
  app.innerHTML = header() + `<div class="card${img ? ' has-pic' : ''}">${pic}${tag}<h2>${tx(e.title)}</h2><p>${tx(e.text)}</p>
  ${e.choices.map((c, i) => { const locked = game.choiceLocked(c);
    return `<button class="choice" data-i="${i}" ${locked ? 'disabled' : ''}>${locked ? '🔒 ' : ''}${tx(c.text)}${locked && c.lock_text ? `<span class="lock">${tx(c.lock_text)}</span>` : ''}</button>`; }).join('')}</div>`;
  app.querySelectorAll<HTMLButtonElement>('button.choice').forEach((b) => b.onclick = () => { game.choose(Number(b.dataset.i)); render(); });
}

function renderResult() {
  const r = game.s.lastResult!;
  app.innerHTML = header() + `<div class="card"><div class="muted">${esc(r.title)}・你選了「${esc(r.choice)}」</div><p>${esc(r.text)}</p><button class="primary" id="ok">繼續</button></div>`;
  document.getElementById('ok')!.onclick = () => { game.continueAfterResult(); render(); };
}

function renderSummary() {
  const sm = game.s.summary!;
  const d = STATS.filter((k) => sm.deltas[k]).map((k) => { const v = sm.deltas[k]!;
    return `<span class="delta ${(k === 'stress' ? -v : v) > 0 ? 'up' : 'down'}">${STAT_NAMES[k]} ${v > 0 ? '+' : ''}${v}</span>`; }).join('　');
  app.innerHTML = header() + `<div class="card"><h2>${sm.title}</h2><p class="pre">${esc(sm.text)}</p><p>${d || '各項數值沒有變化。'}</p><button class="primary" id="ok">下一個階段</button></div>`;
  document.getElementById('ok')!.onclick = () => { game.ackSummary(); render(); };
}

function renderEnding() {
  const e = game.ending(); const r = game.review();
  app.innerHTML = `<h1>結局：${esc(e.title)}</h1><div class="card"><p>${esc(e.text)}</p>${statsHtml()}</div>
  <div class="card"><h2>人生回顧相簿</h2><div class="album">${r.album.map((a, i) => { const img = illustrationFor(a.eventId);
    return `<figure class="polaroid ${i % 2 ? 'tilt-r' : 'tilt'}${img ? '' : ' no-pic'}"><span class="tape"></span>${img ? `<img src="${img}" alt="" loading="lazy">` : `<div class="blank">${esc(a.title)}</div>`}
    <figcaption><span class="tag">${a.stageName}</span><span class="cap">${esc(a.caption)}</span><small class="muted">${esc(a.title)}：${esc(a.choice)}</small></figcaption></figure>`; }).join('')}
    <figure class="polaroid tilt-r no-pic empty"><span class="tape"></span><div class="blank">22 歲以後</div><figcaption><span class="cap">（還沒拍）</span></figcaption></figure></div></div>
  <div class="card"><p>${esc(r.effort)}</p><p>${esc(r.regret)}</p>${r.mountain ? `<h2>${esc(r.mountain.title)}</h2><p>${esc(r.mountain.text)}</p>` : ''}</div>
  <button class="primary" id="again">再活一次</button>`;
  document.getElementById('again')!.onclick = () => start(Math.floor(Math.random() * 2 ** 31));
}

start();
