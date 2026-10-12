// v1.0 人生手牌雛形畫面（?mode=deck）。畫面上不顯示任何數字。
import cardsJson from '@data/deck/cards.json';
import cfgJson from '@data/deck/config.json';
import eraJson from '@data/era_terms.json';
import { gameData } from './data';
import { illustrationFor } from './illustrations';
import { DeckGame, type CardDef, type DeckConfig, type Inst, type PlayResult } from './logic/deck';
import { STATS, STAT_NAMES, type StatId } from './logic/types';

// 牌面圖示：art/deck/<card id>.jpg（美術 9b10418）；結果畫面仍用原本事件插圖
const deckIcons = import.meta.glob('../../art/deck/*.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const iconFor = (id: string) => deckIcons[`../../art/deck/${id}.jpg`];
const cfg = cfgJson as unknown as DeckConfig; const cards = (cardsJson as any).cards as CardDef[];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const TYPE_TAG: Record<string, string> = { action: '', burden: '包袱', growth: '成長', forced: '強制事件' };
let app: HTMLElement; let g: DeckGame; let alloc: Record<string, number> = {}; let last: PlayResult | null = null;
let committed = false;
/** 跟主遊戲一樣：一次只接受一下點擊，避免連點對已過時的手牌呼叫 g.play */
function once(fn: () => void) { return () => { if (committed) return; committed = true; app.classList.add('committing'); setTimeout(() => { committed = false; app.classList.remove('committing'); fn(); }, 120); }; }
let statsHtml: (s: Record<StatId, number>) => string;

export function startDeck(root: HTMLElement, renderStats: (s: Record<StatId, number>) => string, seed?: number) {
  app = root; statsHtml = renderStats;
  const urlSeed = Number(new URLSearchParams(location.search).get('seed'));
  g = new DeckGame(gameData, cfg, cards, seed ?? (urlSeed || undefined), (eraJson as any).deck_card_variants); alloc = {}; last = null;
  renderTalent();
}
const header = () => `<div class="card"><div class="muted">人生手牌 v1.0 試玩一・國中・${g.age} 歲・${esc(g.base.s.county.name)}</div>${statsHtml(g.stats)}</div>`;
const dots = (n: number, full: number) => `<span class="slots" aria-label="時間">${Array.from({ length: full }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
function cardHtml(i: Inst, opts: { btn: boolean }) {
  const c = g.card(i); const v = g.view(c.id); const img = v.icons.map(iconFor).find(Boolean) ?? (c.result_event ? illustrationFor(c.result_event) : undefined);
  const lock = opts.btn ? g.lockReason(i) : null; const cost = g.costOf(i);
  return `<${opts.btn ? `button data-u="${i.uid}" ${lock ? 'disabled' : ''}` : 'div'} class="dcard t-${c.type}">
    ${img ? `<img src="${img}" alt="" loading="lazy" data-card="${c.id}">` : `<div class="dblank">${esc(v.name)}</div>`}
    <b>${esc(v.name)}${TYPE_TAG[c.type] ? `<span class="tag">${TYPE_TAG[c.type]}</span>` : ''}</b>
    <small>${esc(v.line)}</small>
    ${cost !== null && cost > 0 ? `<span class="dcost">${dots(cost, cost)}</span>` : ''}${lock ? `<span class="lock">${esc(lock)}</span>` : ''}
  </${opts.btn ? 'button' : 'div'}>`;
}

function renderTalent() {
  const left = g.talentLeft() - Object.values(alloc).reduce((a, b) => a + b, 0);
  const op = g.base.openingText();
  app.innerHTML = `<h1>人生手牌 v1.0 試玩一</h1><div class="card">${op ? `<p class="opening">${esc(op)}</p>` : ''}
  <p class="muted">每年抽一手牌，但時間只夠打其中幾張。沒打的牌會被丟掉，有些錯過那個年紀就不會再來。</p></div>
  <div class="card"><h2>天賦：你比較常遇到什麼事 ${dots(left, cfg.talent.points)}</h2>
  ${Object.entries(cfg.talent.options).map(([k, o]) => `<div class="act"><span>${esc(o.name)} ${dots(alloc[k] ?? 0, cfg.talent.points)}</span><span><button data-k="${k}" data-d="-1" ${(alloc[k] ?? 0) <= 0 ? 'disabled' : ''}>－</button> <button data-k="${k}" data-d="1" ${left <= 0 ? 'disabled' : ''}>＋</button></span></div>`).join('')}
  <button class="primary" id="ok">開始國一</button><p class="muted"><a href="./">回到原本的玩法</a></p></div>`;
  app.querySelectorAll<HTMLButtonElement>('button[data-k]').forEach((b) => b.onclick = () => { const k = b.dataset.k!; alloc[k] = Math.max(0, (alloc[k] ?? 0) + Number(b.dataset.d)); renderTalent(); });
  document.getElementById('ok')!.onclick = once(() => { g.setTalent(alloc); render(); });
}
function render() { if (g.phase === 'review') renderReview(); else renderYear(); window.scrollTo(0, 0); }
function renderYear() {
  const notes = g.yearNotes.length && !g.playedThisYear.length ? `<p class="pre">${g.yearNotes.map(esc).join('\n')}</p>` : '';
  const res = last ? `<div class="card">${last.eventId && illustrationFor(last.eventId) ? `<figure class="polaroid tilt"><img src="${illustrationFor(last.eventId)}" alt=""></figure>` : ''}<div class="muted">你打出了「${esc(g.view(last.card.id).name)}」</div><p class="pre">${esc(last.text)}</p></div>${last.sick ? `<div class="card t-forced">${last.sick.eventId && illustrationFor(last.sick.eventId) ? `<figure class="polaroid tilt"><img src="${illustrationFor(last.sick.eventId)}" alt=""></figure>` : ''}<div class="muted">你病倒了</div><p class="pre">${esc(last.sick.text)}</p></div>` : ''}` : '';
  app.innerHTML = header() + res + `<div class="card"><h2>今年的時間 ${dots(g.slotsLeft, cfg.time_slots)}</h2>${notes}
  <div class="hand">${g.hand.map((i) => cardHtml(i, { btn: true })).join('')}</div>
  ${g.playedThisYear.length ? `<p class="muted">今年做了：${g.playedThisYear.map((i) => esc(g.view(i.id).name)).join('、')}</p>` : ''}
  <button class="primary" id="end">${g.slotsLeft > 0 && g.playable().length ? '剩下的就算了，過完這一年' : '過完這一年'}</button></div>`;
  app.querySelectorAll<HTMLButtonElement>('button.dcard').forEach((b) => b.onclick = once(() => { const u = Number(b.dataset.u); if (!g.hand.some((h) => h.uid === u)) return; last = g.play(u); render(); }));
  document.getElementById('end')!.onclick = once(() => { last = null; g.endYear(); render(); });
}
function renderReview() {
  const d = g.deltas(); const traj = g.trajectory();
  const ds = STATS.filter((k) => d[k]).map((k) => { const v = d[k]; return `<span class="delta ${(k === 'stress' ? -v : v) > 0 ? 'up' : 'down'}">${STAT_NAMES[k]} ${Math.abs(v) >= 15 ? '大幅' : ''}${v > 0 ? '變多了' : '變少了'}</span>`; }).join('　');
  app.innerHTML = `<h1>國中三年，結束</h1>${header()}<div class="card"><h2>這三年</h2><p>${ds || '這三年，什麼都沒變。'}</p>
  ${g.passiveEnding() ? `<p class="pre">${esc(g.passiveEnding()!)}</p>` : ''}<p>${traj.length ? `大家記得的你：${traj.map(esc).join('、')}` : '大家好像不太記得你這三年在幹嘛。'}</p></div>
  <div class="card"><h2>沒走的路</h2>${g.missed.length ? `<div class="album">${g.missed.map((m, k) => `<figure class="polaroid ${k % 2 ? 'tilt-r' : 'tilt'} no-pic missed"><span class="tape"></span><div class="blank">${esc(m.name)}</div><figcaption>${m.echo ? `<span class="tag">${m.echo.age} 歲</span><span class="cap">${esc(m.echo.text)}</span>` : '<span class="cap">（後來沒再想起）</span>'}</figcaption></figure>`).join('')}</div>` : '<p>該做的，你都做了。</p>'}</div>
  <button class="primary" id="again">再活一次</button><p class="muted"><a href="./">回到原本的玩法</a></p>`;
  document.getElementById('again')!.onclick = () => startDeck(app, statsHtml, Math.floor(Math.random() * 2 ** 31));
}
