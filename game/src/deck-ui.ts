// 人生手牌（?mode=deck）手機一屏版面 A（橫向手牌）＋童年序章。畫面上不顯示任何數字。
// 版面：design/mockups/v1.2-mobile/（A-horizontal-hand、C-childhood-prologue）；外觀：art/ui/mobile-v12/skin.css（README §8）。
// v1.2 開關：網址 ?v12=1／?v12=0；沒寫就看 data/deck/v12.json 的 enabled。一年一回合的 v1.1 玩法用同一套畫面（沒有學期圖示、先選天賦）。
import './deck-mobile.css';
import '../../art/ui/mobile-v12/skin.css';
import '../../art/deck/era/tv-frame.css';
import cardsJson from '@data/deck/cards.json';
import cfgJson from '@data/deck/config.json';
import eraJson from '@data/era_terms.json';
import adultJson from '@data/deck/cards_adult.json';
import endingsJson from '@data/endings.json';
import statLabels from '@data/stat_labels.json';
import v12Json from '@data/deck/v12.json';
import v12CardsJson from '@data/deck/cards_v12.json';
import childhoodJson from '@data/deck/childhood.json';
import eraCardsJson from '@data/deck/era_cards.json';
import timelineJson from '@data/timeline.json';
import scenesJson from '@data/deck/scenes.json';
import { gameData } from './data';
import { illustrationFor } from './illustrations';
import { DeckGame, achForMode, type AchDef, type CardDef, type DeckConfig, type Inst, type PlayResult } from './logic/deck';
import { plainName, packLines, splitLines, ZWSP, NAME_LINES_MAX } from './logic/names';
import { checkBreakTable, handBreakName } from './name-breaks';
import { loadTimeline, type ChildhoodData, type EraData, type V12Config } from './logic/v12';
import { STATS, STAT_NAMES, type StatId } from './logic/types';

// 牌面圖示：art/deck/<card id>.jpg；時代牌舊電視框：art/deck/era/<card id>.*（還沒到就用 CSS 畫的框）
const deckIcons = import.meta.glob('../../art/deck/*.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
// 只取 art/deck/era/era_<id>.png（1280×720）；glob 只給網址，圖在畫面真的顯示時才下載（不打包進 JS、不預先載入）
import echoArtUrls, { focus as echoArtFocus } from 'virtual:echo-art'; // 回音牌圖：data/deck/v12.json echo_art 規則，build 時挑好（vite.config.ts echoArt plugin）
import eraArtUrls from 'virtual:era-art'; // 時代牌圖：有 .webp 用 .webp，沒有才用 .png（vite.config.ts eraArt plugin）
// 舊電視框：art/deck/era/tv-frame.svg（螢幕透明、牌圖墊在下面、框色吃 --acc），內嵌進 DOM 讓 SVG 裡的 var(--acc) 生效；沒有檔案就用 CSS 畫的框
const tvFrame = Object.values(import.meta.glob('../../art/deck/era/tv-frame.svg', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>)[0];
// 記憶牌插圖：art/deck/memory/<id>.png（4:5；只用 png，不載入帶濾鏡的 svg，手機上比較省；沒有就用類別色佔位）
const memArtFiles = import.meta.glob('../../art/deck/memory/mem_*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const baseName = (k: string) => k.split('/').pop()!.replace(/\.\w+$/, '');
const memArt = (id: string) => Object.entries(memArtFiles).find(([k]) => baseName(k) === id)?.[1];
const iconFor = (id: string) => deckIcons[`../../art/deck/${id}.jpg`];
/** 回音牌插圖（v1.2，data/deck/v12.json echo_art）：組名＝牌 id 去掉 strip_suffix（_bitter／_warm）再去掉 strip_prefix（e_），苦暖共用一張。
 *  組名→圖的清單由 vite.config.ts echoArt plugin 在 build 時照 pattern／ext 產生（每組只收 webp 或退回 png 其中一張）；沒檔的組不在清單裡，走沒插圖樣式（不破圖、不發 404） */
function echoGroup(c: CardDef | undefined): string | undefined {
  const ea = (g.v12 as any)?.echo_art as { strip_prefix?: string; strip_suffix?: string[] } | undefined;
  if (!c?.echo_card || !ea) return undefined;
  let grp = c.id; const suf = (ea.strip_suffix ?? []).find((x) => grp.endsWith(x)); if (suf) grp = grp.slice(0, -suf.length);
  if (ea.strip_prefix && grp.startsWith(ea.strip_prefix)) grp = grp.slice(ea.strip_prefix.length);
  return grp;
}
function echoArt(c: CardDef | undefined): string | undefined { const grp = echoGroup(c); return grp ? echoArtUrls[grp] : undefined; }
/** 手牌 7:5 框裡回音圖的裁切焦點（美術 manifest hand_focus，build 時讀入）；沒寫＝置中（skin 預設 50% 50%）。詳情頁不用，照樣顯示整張 */
function handFocus(c: CardDef, img: string): string { const grp = echoGroup(c); const f = grp && echoArtUrls[grp] === img ? echoArtFocus[grp] : undefined; return f ? ` style="object-position:${f}"` : ''; }
/** 牌的插圖：先看 icons（art/deck/*.jpg），v1.2 回音牌再看 echo_art */
const cardArt = (id: string) => g.view(id).icons.map(iconFor).find(Boolean) ?? (g.v12 ? echoArt(g.cards.get(id)) : undefined);
import achData from '@data/achievements.json';
const achIcons = import.meta.glob('../../art/achievements/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const ACH = (achData as any).achievements as (AchDef & { name: string; desc: string })[];
/** 回顧頁的成就面板開關（企劃 10/17 核可：開，只列名稱和說明；關掉也照樣存檔）。面板只列已解鎖的名字，不出現「幾／幾」這類數字（QA r1 bug 6） */
const SHOW_ACH_PANEL = true;
let achRun: { game: DeckGame; fresh: string[]; got: string[] } | null = null;
/** 這局達成的成就併進 localStorage 'achievements'（跟原本玩法同一份），回傳面板 HTML；同一局重繪不重複算「新」 */
function achPanel(): string {
  if (achRun?.game !== g) {
    let saved: unknown = []; try { saved = JSON.parse(localStorage.getItem('achievements') ?? '[]'); } catch { saved = []; }
    const got = new Set<string>(Array.isArray(saved) ? saved.filter((x): x is string => typeof x === 'string') : []);
    const fresh = g.achievementsMet(ACH).met.filter((id) => !got.has(id)); fresh.forEach((id) => got.add(id));
    try { localStorage.setItem('achievements', JSON.stringify([...got])); } catch { /* 無痕模式存不了就算了 */ }
    achRun = { game: g, fresh, got: [...got] };
  }
  if (!SHOW_ACH_PANEL) return '';
  const got = new Set(achRun.got); const list = ACH.filter((a) => got.has(a.id));
  const items = list.map((a0) => { const a = achForMode(a0, !!g.v12); const ic = achIcons[`../../art/achievements/${a.id}.png`]; const isNew = achRun!.fresh.includes(a.id);
    return `<div class="ach${isNew ? ' new' : ''}" data-ach="${a.id}">${ic ? `<img src="${ic}" alt="" loading="lazy">` : '<span class="ach-q">★</span>'}<div><b>${esc(plainName(a.name))}${isNew ? ' <i class="ach-new">新</i>' : ''}</b><small class="muted">${esc(a.desc)}</small></div></div>`; }).join('');
  return `<div class="card ach-card"><h2>解鎖的成就</h2>${items ? `<div class="achs">${items}</div>` : '<p class="muted">還沒有解鎖的成就。</p>'}</div>`;
}
const eraArt = (id: string): string | undefined => eraArtUrls[id];
const baseCfg = cfgJson as unknown as DeckConfig; const cards = (cardsJson as any).cards as CardDef[];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// ----- 屬性列（圖示同 main.ts SB_ICONS；等級文字 data/stat_labels.json） -----
const SB_ICONS: Record<StatId, string> = {
  academic: '<path d="M3 6c3-1.5 6-1.2 9 .6 3-1.8 6-2.1 9-.6v12c-3-1.4-6-1.1-9 .6-3-1.7-6-2-9-.6z"/><path d="M12 6.6v12"/>',
  happiness: '<circle cx="12" cy="12" r="8.6"/><path d="M8.3 10h.1M15.6 10h.1M8 14.2c2.3 2.6 5.7 2.6 8 0"/>',
  stress: '<path d="M4 15c0-4 3.5-7 8-7s8 3 8 7z"/><path d="M7 15l-1 4M12 15v4.5M17 15l1 4M9 5l1.5 1.6M14.6 4.5 13.4 6.4"/>',
  health: '<path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/><path d="M8 12.5h2.2l1-2 1.7 4 1-2H16"/>',
  social: '<circle cx="8.5" cy="9" r="3"/><circle cx="16" cy="9.5" r="2.6"/><path d="M3.5 19c.6-3.4 2.7-5 5-5s4.4 1.6 5 5M13.5 15c.8-.9 1.7-1.3 2.6-1.3 2 0 3.7 1.6 4.2 4.6"/>',
  wealth: '<rect x="3.5" y="8" width="17" height="11" rx="2"/><path d="M8 8V6.3c0-1.1.9-2 2-2h4a2 2 0 0 1 2 2V8M3.5 12.5h17"/><circle cx="12" cy="14.6" r="1.3"/>' };
type StatLabel = { mins: number[]; labels: string[]; danger: { below?: number; atLeast?: number } };
const LABELS = statLabels as unknown as Record<StatId, StatLabel>;
const statLv = (k: StatId, v: number) => { let lv = 1; LABELS[k].mins.forEach((x, i) => { if (v >= x) lv = i + 1; }); return lv; };
const isDanger = (k: StatId, v: number) => { const d = LABELS[k].danger; return (d.below !== undefined && v < d.below) || (d.atLeast !== undefined && v >= d.atLeast); };
const svg = (paths: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const HOURGLASS = svg('<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/>');
const LOCK = svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>');

// 牌的主色：cards.json accent；沒填的牌（大學、v1.2 新牌）用固定色盤依 id 挑，避免全部同色
const PALETTE = ['#3A6FB0', '#4A7038', '#A8322D', '#6B4A8C', '#B8902F', '#2F7A78', '#C25A80', '#8A5A2B', '#5C6F8C', '#7A8A2E'];
const accentOf = (c: CardDef) => { if (c.accent) return c.accent; if (c.type === 'burden') return '#7A5C48'; if (c.type === 'forced') return '#6E6A64';
  let h = 0; for (const ch of c.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; };
const TYPE_TAG: Record<string, string> = { burden: '包袱', growth: '成長', forced: '強制' };
const MEM_Q = ['那時候，你最常在做什麼？', '大人最常為了什麼事唸你？', '後來回想起小學，最先想到的是……']; // 工程暫代，待劇情文案

let app: HTMLElement; let g: DeckGame; let alloc: Record<string, number> = {}; let last: PlayResult | null = null;
let committed = false; let memPick: string | null = null; let eraActShown = -1; let heldShown: string[] = []; let resOpen = false;
/** 一次只接受一下點擊，避免連點對已過時的手牌呼叫 g.play */
function once(fn: () => void) { return () => { if (committed) return; committed = true; app.classList.add('committing'); setTimeout(() => { committed = false; app.classList.remove('committing'); fn(); }, 120); }; }

export function startDeck(root: HTMLElement, _renderStats?: (s: Record<StatId, number>) => string, seed?: number) {
  app = root; document.body.classList.add('dk-body'); // 深色主題沿用 main.ts 設的 data-theme（存檔的 theme 或系統深色；QA r1 bug 5）
  const qs = new URLSearchParams(location.search); const urlSeed = Number(qs.get('seed'));
  const v12 = qs.has('v12') ? qs.get('v12') !== '0' : !!(v12Json as any).enabled;
  // 18→22：網址 ?adult=1／0 優先；v1.2 看 v12.json adult（企劃定案 Q5：預設開），v1.1 看 config adult_branch.enabled
  const aq = qs.get('adult'); const adult = aq === '1' ? true : aq === '0' ? false : v12 ? ((v12Json as any).adult ?? !!baseCfg.adult_branch?.enabled) : !!baseCfg.adult_branch?.enabled;
  const cfg = { ...baseCfg, v12: v12Json as unknown as V12Config } as DeckConfig;
  const list = [...cards, ...(adult ? (adultJson as any).cards : []), ...(v12 ? (v12CardsJson as any).cards : [])] as CardDef[];
  const birth = Number(qs.get('birth')) || undefined;
  g = new DeckGame(gameData, cfg, list, seed ?? (urlSeed || undefined), (eraJson as any).deck_card_variants, {
    adult, v12, childhood: childhoodJson as unknown as ChildhoodData, era: eraCardsJson as unknown as EraData, timeline: loadTimeline(timelineJson),
    scenes: (scenesJson as any).scenes, birthYear: birth, prologue: qs.get('prologue') === 'skip' ? 'skip' : 'play' });
  if (v12) checkBreakTable((id) => g.cards.get(id)?.name);
  alloc = {}; last = null; memPick = null; eraActShown = -1; heldShown = []; resOpen = false;
  if (g.v12) render(); else renderTalent();
  if (qs.get('debug') === '1') Object.assign(window as any, { __deck: g, __deckRender: render }); // 版面測試用（Playwright 塞滿手牌）
}

// ----- 共用區塊 -----
const multi = () => g.tpy > 1;
const span = () => (multi() ? '這學期' : '今年');
const clocks = (n: number, full: number, cls = '') => `<span class="slots ${cls}" aria-label="時間">${Array.from({ length: full }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
function topbar(right = '') {
  const t = g.termName(); const sem = multi() && g.phase !== 'break' ? `<span class="sem" data-sem="${g.term + 1}" aria-label="${esc(t)}"><i></i><i></i></span>` : '';
  return `<div class="topbar"><span class="where">${esc(g.stageOf(g.age))}${sem}${t ? `<span>${esc(t)}</span>` : ''}<span>${esc(g.base.s.county.name)}</span></span>${right}</div>`;
}
function resbar() {
  return `<div class="resbar" role="button" aria-label="屬性">${STATS.map((k) => { const v = g.stats[k]; const lv = statLv(k, v);
    return `<button class="res${isDanger(k, v) ? ' danger' : ''}" data-res aria-label="${STAT_NAMES[k]}：${LABELS[k].labels[lv - 1]}">${svg(SB_ICONS[k])}<span class="meter">${[1, 2, 3, 4, 5].map((x) => `<b class="${x <= lv ? 'on' : ''}"></b>`).join('')}</span></button>`; }).join('')}</div>
  <div class="res-pop${resOpen ? ' open' : ''}">${STATS.map((k) => `<div><span>${STAT_NAMES[k]}</span><b>${LABELS[k].labels[statLv(k, g.stats[k]) - 1]}</b></div>`).join('')}</div>`;
}
function mount(html: string, cls = 'screen') {
  document.body.classList.toggle('dk-scroll', cls !== 'screen');
  app.innerHTML = `<div class="dk ${cls}${g?.v12 ? ' v12' : ''}">${html}</div>`; // v12 class：只給 v1.2 的樣式（v1.1 凍結）
  app.querySelectorAll<HTMLElement>('[data-res]').forEach((b) => b.onclick = () => { resOpen = !resOpen; app.querySelector('.res-pop')?.classList.toggle('open', resOpen); });
  app.querySelector<HTMLElement>('.res-pop')?.addEventListener('click', () => { resOpen = false; app.querySelector('.res-pop')?.classList.remove('open'); });
}
function crt(id: string, cons?: string, big = false) {
  const v = g.view(id); const art = eraArt(id);
  const c = g.cards.get(id); const acc = c ? accentOf(c) : '#4A423B';
  return `<div class="crt${art ? ' has-art' : ''}${tvFrame ? ' framed' : ''}${big ? ' big' : ''}" data-era="${id}" style="--acc:${acc}"><div class="tube">${art ? `<img src="${art}" alt="" decoding="async" onerror="this.remove()">` : `<span class="nm">${esc(v.name)}</span>`}${tvFrame ? `<span class="frame" aria-hidden="true">${tvFrame}</span>` : ''}</div>
    <div class="t"><b>${esc(v.name)}</b><span>${esc(v.line)}</span>${cons ? `<span class="cons">${esc(cons)}</span>` : ''}</div></div>`;
}

function render() {
  const p = g.phase;
  if (p === 'review') renderReview(); else if (p === 'prologue') renderPrologue(); else if (p === 'prologueSummary') renderSummary();
  else if (p === 'choice') renderChoice(); else if (p === 'branch') renderBranch(); else if (p === 'housing') renderHousing();
  else if (p === 'break') renderBreak(); else renderTurn();
}

// ----- v1.1：天賦 -----
function renderTalent() {
  const pts = baseCfg.talent.points; const left = g.talentLeft() - Object.values(alloc).reduce((a, b) => a + b, 0); const op = g.openingText();
  mount(`<div class="topbar"><span class="where">人生手牌</span>${clocks(left, pts, 'prog')}</div>
  <div class="pick"><div class="head"><h1>你比較常遇到什麼事</h1>${op ? `<p class="sub">${esc(op)}</p>` : ''}
  <p class="sub">每${span() === '今年' ? '年' : '學期'}抽一手牌，但時間只夠打其中幾張。沒打的牌會被丟掉，有些錯過那個年紀就不會再來。</p></div>
  <div class="opts" style="flex:1;justify-content:center">${Object.entries(baseCfg.talent.options).map(([k, o]) => `<div class="tal"><span>${esc(o.name)} ${clocks(alloc[k] ?? 0, pts, 'prog')}</span><span class="pm"><button class="btn" data-k="${k}" data-d="-1" aria-label="少一點" ${(alloc[k] ?? 0) <= 0 ? 'disabled' : ''}>－</button><button class="btn" data-k="${k}" data-d="1" aria-label="多一點" ${left <= 0 ? 'disabled' : ''}>＋</button></span></div>`).join('')}</div>
  <div class="footer"><button class="btn primary" id="ok">開始國中</button><p class="muted" style="text-align:center;margin-top:6px"><a href="./">回到原本的玩法</a></p></div></div>`);
  app.querySelectorAll<HTMLButtonElement>('button[data-k]').forEach((b) => b.onclick = () => { const k = b.dataset.k!; alloc[k] = Math.max(0, (alloc[k] ?? 0) + Number(b.dataset.d)); renderTalent(); });
  document.getElementById('ok')!.onclick = once(() => { g.setTalent(alloc); render(); });
}

// ----- v1.2 童年序章 -----
function progDots() { const n = g.childhood?.ages.length ?? 3; return clocks(Math.min(g.actIdx + 1, n), n, 'prog'); }
function renderPrologue() {
  // 這一幕排到的時代牌：選之前先看一眼舊電視（第二行＝序章版後果）
  if (g.eraThisTurn.length && eraActShown !== g.actIdx) {
    mount(`<div class="topbar"><span class="where">童年・${esc(g.actLabel())}</span>${progDots()}</div>
    <div class="pro" data-screen="prologue-era"><div><p class="sub">${esc(g.actLabel())}</p><h1>那幾年，電視上一直在播……</h1></div>
    <div class="mems">${g.eraThisTurn.map((id) => crt(id, g.eraConsequence(id), true)).join('')}</div>
    <div class="footer"><button class="btn primary" id="ok">繼續</button></div></div>`);
    document.getElementById('ok')!.onclick = once(() => { eraActShown = g.actIdx; renderPrologue(); }); return;
  }
  const ch = g.childhood!; const showCons = (ch as any).show_consequence !== false;
  mount(`<div class="topbar"><span class="where">童年・${esc(g.actLabel())}</span>${progDots()}</div>
  <div class="pro" data-screen="prologue"><div><p class="sub">${esc(g.actLabel())}</p><h1>${esc(MEM_Q[g.actIdx] ?? MEM_Q[0])}</h1></div>
  <div class="mems">${g.offer.map((m) => { const v = g.memoryView(m);
    const ma = memArt((m as any).art ?? m.id) ?? memArt(m.id);
    return `<button class="mem${memPick === m.id ? ' sel' : ''}" data-m="${m.id}" data-cat="${m.category}">${ma ? `<img class="ph mart" src="${ma}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph',textContent:${JSON.stringify(v.category).replace(/"/g, '&quot;')}}))">` : `<div class="ph">${esc(v.category)}</div>`}<div class="txt">
      <b><i class="cat" title="${esc(v.category)}" aria-label="${esc(v.category)}"></i>${esc(v.name)}</b><span class="l">${esc(v.situation)}</span>
      ${showCons ? `<span class="cons">${esc(v.consequence)}</span>` : ''}<span class="adds">放進牌堆：${v.adds.map((a) => `<i>${esc(a)}</i>`).join('')}</span></div></button>`; }).join('')}</div>
  <div class="footer"><button class="btn primary" id="ok" ${memPick ? '' : 'disabled'}>${memPick ? '就是這個' : '選一張'}</button></div></div>`);
  const sel = g.offer.find((m) => m.id === memPick); if (sel) app.querySelector<HTMLElement>('.pro')!.style.setProperty('--sel-acc', `var(--cat-${sel.category})`);
  app.querySelectorAll<HTMLButtonElement>('.mem').forEach((b) => b.onclick = () => { memPick = b.dataset.m!; renderPrologue(); });
  document.getElementById('ok')!.onclick = once(() => { if (!memPick) return; const id = memPick; memPick = null; g.pickMemory(id); render(); });
}
function renderSummary() {
  const ch = g.childhood!;
  mount(`<div class="topbar"><span class="where">童年</span>${clocks(ch.ages.length, ch.ages.length, 'prog')}</div>
  <div class="pro" data-screen="summary"><div><h1>你帶著這些長大了</h1></div><p class="sumline">${esc(g.prologueSummary())}</p>
  <p class="sub">這幾張牌已經放進你的牌堆，國中的時候會比較常遇到。</p>
  <div class="sum">${g.memories.map((m) => { const v = g.memoryView(m); const a = m.adds[0]; const c = a ? g.cards.get(a) : undefined; const ma = memArt((m as any).art ?? m.id) ?? memArt(m.id); const img = ma ?? (a ? iconFor(a) : undefined);
    return `<div class="mini" style="--acc:${c ? accentOf(c) : `var(--cat-${m.category})`}">${img ? `<img src="${img}" alt=""${ma ? ' class="mart-wide"' : ''}>` : `<div class="ph">${esc(v.category)}</div>`}<b>${esc(v.adds.join('、'))}</b><span class="when">${esc(ch.acts[String(m.act)]?.label ?? '')}・${esc(v.name)}</span></div>`; }).join('')}</div>
  <div class="footer"><button class="btn primary" id="go">開始國中</button></div></div>`);
  document.getElementById('go')!.onclick = once(() => { g.startSchool(); render(); });
}

// ----- 選擇畫面 -----
function pickScreen(id: string, title: string, line: string, opts: string, screen: string) {
  const img = iconFor(id);
  mount(topbar() + resbar() + `<div class="pick" data-screen="${screen}"><div class="head"><h1>${esc(title)}</h1>${line ? `<p class="sub">${esc(line)}</p>` : ''}</div>
  <div class="hero">${img ? `<img src="${img}" alt="">` : ''}</div><div class="opts">${opts}</div></div>`);
}
function optBtns(list: { key: string; opt: { name: string }; locked?: string | null }[], attr: string, note?: (k: string) => string | undefined) {
  return list.map((o) => { const n = note?.(o.key); return `<button class="btn${o.locked ? '' : ' primary'}" data-${attr}="${o.key}" ${o.locked ? 'disabled' : ''}>${esc(o.opt.name)}</button>${o.locked ? `<p class="why">${esc(o.locked)}</p>` : ''}${n ? `<p class="note">${esc(n)}</p>` : ''}`; }).join('');
}
/** 16 歲：選校。普高沒到門檻時顯示文案的提示，學費句（v1.2 system_rules）放在選項下面 */
function renderChoice() {
  const fc = g.cards.get('f_school_choice');
  pickScreen('f_school_choice', fc ? g.view(fc.id).name : '選校', fc ? g.view(fc.id).line : '', optBtns(g.schoolOptions(), 't', (k) => g.choiceNote?.(k)), 'choice');
  app.querySelectorAll<HTMLButtonElement>('button[data-t]').forEach((b) => b.onclick = once(() => { g.chooseSchool(b.dataset.t!); last = null; render(); }));
}
function renderBranch() {
  const id = g.branchDef()?.age === baseCfg.adult_branch?.branch_jc.age ? 'f_branch_jc' : 'f_branch'; const c = g.cards.get(id);
  pickScreen(id, c ? g.view(id).name : '', c ? g.view(id).line : '', optBtns(g.branchOptions(), 'b'), 'branch');
  app.querySelectorAll<HTMLButtonElement>('button[data-b]').forEach((b) => b.onclick = once(() => { g.chooseBranch(b.dataset.b!); last = null; render(); }));
}
function renderHousing() {
  const h = baseCfg.adult_branch!.housing!;
  pickScreen('f_housing', h.title, '', optBtns(g.housingOptions(), 'h'), 'housing');
  app.querySelectorAll<HTMLButtonElement>('button[data-h]').forEach((b) => b.onclick = once(() => { g.chooseHousing(b.dataset.h!); last = null; render(); }));
}
/** v1.2 寒暑假：翻兩張選一張，不算一手 */
function renderBreak() {
  const names = (g.v12 as any).term_names ?? {}; const kind = g.breakKind ?? 'summer';
  mount(topbar() + resbar() + `<div class="pick" data-screen="break"><div class="head"><h1>${esc(names[kind] ?? '')}</h1><p class="sub">放假了。這段時間你拿來做什麼？</p></div>
  <div class="brk">${g.breakOffer.map((id) => { const c = g.cards.get(id)!; const v = g.view(id); const img = v.icons.map(iconFor).find(Boolean);
    return `<button class="mini" data-k="${id}" style="--acc:${accentOf(c)}">${img ? `<img src="${img}" alt="">` : `<div class="ph">${esc(v.name)}</div>`}<span class="t"><b>${esc(v.name)}</b><span>${esc(v.line)}</span></span></button>`; }).join('')}</div></div>`);
  app.querySelectorAll<HTMLButtonElement>('.brk .mini').forEach((b) => b.onclick = once(() => { g.pickBreak(b.dataset.k!); last = null; render(); }));
}

// ----- 回合（版面 A） -----
function mini(i: Inst, k: number, n: number, fan: boolean) {
  const c = g.card(i); const v = g.view(c.id); const img = cardArt(c.id); const lock = g.lockReason(i); const cost = g.costOf(i);
  const burden = c.type === 'burden'; const fuse = g.v12 && burden && c.sticky && c.trigger_after ? `<span class="fuse" style="--fuse-total:${c.trigger_after};--fuse-burnt:${Math.min(c.trigger_after, g.heldTurns.get(i.uid) ?? 0)}"></span>` : '';
  // 引信（只有 v1.2 包袱牌有）放進底列、夾在時鐘和鎖之間，不再自己佔一行（375 寬時原本把兩行牌名擠成一行，QA 10/17）
  const soon = i.ephemeral || c.temp || (c.expires_age !== null && c.expires_age <= g.age);
  // v1.2（美術 10/17）：沒插圖時圖框不寫牌名（名字只在下面出現一次）；非包袱牌的類別標籤放在牌名上面，不蓋到別張
  const tag = TYPE_TAG[c.type] ? `<span class="badge">${TYPE_TAG[c.type]}</span>` : ''; const tagAbove = !!(g.v12 && !burden && tag);
  const pic = img ? `<img src="${img}" alt="" loading="lazy"${g.v12 ? handFocus(c, img) : ''}>` : g.v12 ? '<div class="ph" aria-hidden="true"></div>' : `<div class="ph">${esc(v.name)}</div>`;
  // 文案插了斷點、而且照斷點排得進兩行的牌名才加 has-brk（keep-all 只在詞界換行）；沒插的、或要排三行的（namecheck12 會列出來）照舊逐字換行，不會撐破或被截掉
  const nameBrk = (g.v12 ? handBreakName(c.id, v.name) : undefined) ?? v.nameBrk; // 凍結檔牌名的斷點來自 data/name_breaks_v12.json
  const brk = !!(g.v12 && nameBrk.includes(ZWSP) && packLines(nameBrk) <= NAME_LINES_MAX);
  return `<button class="mini${burden ? ' is-burden' : ''}${brk ? ' has-brk' : ''}${c.type === 'forced' ? ' is-forced' : ''}${g.v12 && c.echo_card ? ' is-echo' : ''}${lock ? ' off' : ''}${img ? '' : ' no-art'}${tagAbove ? ' has-tag' : ''}" data-u="${i.uid}" data-card="${c.id}" style="--acc:${accentOf(c)}${fan ? `;--i:${k};--n:${n}` : ''}" aria-label="${esc(v.name)}">
    ${tagAbove ? pic + tag : tag + pic}
    <b>${brk ? splitLines(nameBrk).map(esc).join('<br>') : esc(v.name)}</b><span class="foot">${cost ? clocks(cost, cost) : '<span></span>'}${fuse}${lock ? LOCK : soon ? HOURGLASS : ''}</span></button>`;
}
function stageHtml() {
  if (last) { const ill = last.eventId ? illustrationFor(last.eventId) : undefined; const img = ill ?? cardArt(last.card.id);
    return `<div class="result" data-screen="result">${img ? `<div class="pic"><img class="art" src="${img}" alt=""></div>` : ''}<span class="who">你打出了「${esc(g.view(last.card.id).name)}」</span><p>${esc(last.text)}</p>${last.sick ? `<p class="sick">${esc(last.sick.text)}</p>` : ''}</div>`; }
  const era = g.v12 ? g.eraRecent : []; const eraNames = era.map((id) => `${g.view(id).name}：`);
  const notes = g.yearNotes.filter((n) => !heldShown.includes(n) && !eraNames.some((e) => n.startsWith(e)));
  const sc = g.scene; const body = era.map((id) => crt(id)).join('') + (sc ? `<div class="scene"><b>${esc(sc.name)}</b>${sc.text ? `<p>${esc(g.fill(sc.text))}</p>` : ''}</div>` : '')
    + (notes.length ? `<div class="notes">${notes.map((n) => `<p>${esc(n)}</p>`).join('')}</div>` : '');
  return `<div class="open-scroll" data-screen="turn">${body || `<div class="notes"><p>新的${multi() ? '學期' : '一年'}開始了。</p></div>`}</div>`;
}
/** v1.2 扇形手牌裡，有沒有哪張牌的牌名被右邊下一張蓋到：逐字取右緣內 1px、上下置中那一點，看最上層是不是這張牌（含旋轉） */
function fanHidesText(row: HTMLElement): boolean {
  const cards = Array.from(row.querySelectorAll<HTMLElement>('.mini'));
  for (let k = 0; k < cards.length - 1; k++) { const b = cards[k].querySelector('b'); if (!b) continue;
    const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); const r = document.createRange(); let t: Node | null;
    while ((t = w.nextNode())) { const s = t.textContent ?? '';
      for (let i = 0; i < s.length; i++) { if (s[i] === ZWSP) continue; r.setStart(t, i); r.setEnd(t, i + 1); const q = r.getBoundingClientRect(); if (!q.width) continue;
        const e = document.elementFromPoint(q.right - 1, q.top + q.height / 2); if (!e || !cards[k].contains(e)) return true; } } }
  return false;
}
/** v1.2 橫向捲動手牌（QA r8b B1）：吸附位置要扣掉左邊釘住的包袱區，第一張可捲的牌在 scrollLeft 0 就整張露出；
 *  釘住區加上一張牌放不下（包袱太多）就不釘，整列一起捲，每張都捲得出來 */
function fitScrollRow(row: HTMLElement | null) {
  if (!row) return; const pin = row.querySelector<HTMLElement>('.pinned');
  const rest = Array.from(row.querySelectorAll<HTMLElement>(':scope > .mini'));
  if (pin) { const maxW = Math.max(0, ...rest.map((m) => m.offsetWidth)); const start = rest.length ? rest[0].offsetLeft : pin.offsetLeft + pin.offsetWidth;
    if (start + maxW + 12 > row.clientWidth) row.classList.add('unpin'); }
  const first = row.querySelector<HTMLElement>(row.classList.contains('unpin') || !pin ? '.mini' : ':scope > .mini');
  row.style.setProperty('--snap-pad', `${first ? first.offsetLeft : 0}px`); row.scrollLeft = 0;
  // 兩端提示（企劃 R8b-1）：哪一邊還有牌就在那一邊淡出／釘住區右緣加陰影，捲到底那一端就拿掉
  const edges = () => { const max = row.scrollWidth - row.clientWidth; row.classList.toggle('more-l', row.scrollLeft > 1); row.classList.toggle('more-r', row.scrollLeft < max - 1); };
  edges(); row.addEventListener('scroll', edges, { passive: true });
  // 滑鼠垂直滾輪轉成橫向捲動（企劃 R8b-1）：只有真的能橫捲、而且這一下主要是垂直時才攔；觸控板橫滑（deltaX 為主）照原生
  let idle = 0;
  row.addEventListener('wheel', (e) => {
    if (row.scrollWidth <= row.clientWidth + 1 || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.preventDefault(); row.classList.add('wheeling'); row.scrollLeft += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? row.clientWidth : 1);
    clearTimeout(idle); idle = window.setTimeout(() => row.classList.remove('wheeling'), 160);
  }, { passive: false });
}
// v1.2（QA r8 bug 1、企劃 10/17）：扇形的牌名只能放在沒被下一張蓋住的地方。依序試：一般扇形 → 扇形左右邊距縮小（露出多一點）→ 再把手牌牌名縮到 12px → 都不行就改橫向捲動（不重疊）
const FAN_STEPS = ['', ' fan-tight', ' fan-tight fan-sm'];
function renderTurn(fanStep = 0) {
  const hand = [...g.hand].sort((a, b) => Number(g.card(b).type === 'burden') - Number(g.card(a).type === 'burden'));
  const fan = hand.length <= 7 && (!g.v12 || fanStep < FAN_STEPS.length); const burdens = hand.filter((i) => g.card(i).type === 'burden'); const rest = hand.filter((i) => !burdens.includes(i));
  const row = fan ? `<div class="handrow fan${g.v12 ? FAN_STEPS[fanStep] : ''}">${hand.map((i, k) => mini(i, k, hand.length, true)).join('')}</div>`
    : `<div class="handrow">${burdens.length ? `<div class="pinned">${burdens.map((i, k) => mini(i, k, burdens.length, false)).join('')}</div>` : ''}${rest.map((i, k) => mini(i, k, rest.length, false)).join('')}</div>`;
  const capN = Math.max(g.cfg.hand_size, hand.length);
  const played = g.playedThisYear.length ? `<div class="played">${span()}做了：${g.playedThisYear.map((i) => esc(g.view(i.id).name)).join('、')}</div>` : '';
  const endLabel = `${g.slotsLeft > 0 && g.playable().length ? '剩下的就算了，' : ''}過完${span()}`;
  mount(topbar(clocks(g.slotsLeft, g.cfg.time_slots)) + resbar() + `<div class="stage">${stageHtml()}${played}</div>
  <div class="handlabel"><span>手牌${fan ? '' : '（往左右滑）'}</span><span class="cap" aria-label="手牌位置">${Array.from({ length: capN }, (_, k) => `<b class="${k < hand.length ? (g.card(hand[k]).type === 'burden' ? 'used burden' : 'used') : ''}"></b>`).join('')}</span></div>
  ${row}<div class="actionbar"><button class="btn primary" id="end">${endLabel}</button></div>
  <div class="scrim"></div><div class="sheet"></div><div class="toast" role="status"></div>`);
  app.querySelectorAll<HTMLButtonElement>('.handrow .mini').forEach((b) => b.onclick = () => openSheet(Number(b.dataset.u)));
  app.querySelector<HTMLElement>('.scrim')!.onclick = closeSheet;
  document.getElementById('end')!.onclick = once(endTerm);
  if (g.v12 && fan) { const row = app.querySelector<HTMLElement>('.handrow.fan'); if (row && fanHidesText(row)) renderTurn(fanStep + 1); }
  if (g.v12 && !fan) fitScrollRow(app.querySelector<HTMLElement>('.handrow'));
}
function openSheet(uid: number) {
  const i = g.hand.find((h) => h.uid === uid); if (!i) return; const c = g.card(i); const v = g.view(c.id);
  const img = cardArt(c.id); const lock = g.lockReason(i); const cost = g.costOf(i); const burden = c.type === 'burden';
  const sheet = app.querySelector<HTMLElement>('.sheet')!; sheet.className = `sheet${burden ? ' is-burden' : ''}`; sheet.style.setProperty('--acc', accentOf(c));
  const fuse = g.v12 && burden && c.sticky && c.trigger_after ? `<span class="fuse" style="--fuse-total:${c.trigger_after};--fuse-burnt:${Math.min(c.trigger_after, g.heldTurns.get(i.uid) ?? 0)}"></span>` : '';
  const rule = burden ? (c.sticky ? `背著的每個${multi() ? '學期' : '年'}都會痛一下，不會自己走。${c.trigger_after ? '引信燒完的那一回合會出事。' : ''}處理掉要花時間。` : '這張牌一直在你的牌堆裡，處理掉要花時間。')
    : c.type === 'forced' ? '翻開就發生了，佔一格手牌。' : '';
  const btns = c.type === 'forced' ? `<button class="btn primary" data-act="close">知道了</button>`
    : burden ? `<button class="btn" data-act="close">先背著</button><button class="btn primary" data-act="play" ${lock ? 'disabled' : ''}>花時間處理掉</button>`
    : `<button class="btn" data-act="close">先不要</button><button class="btn primary" data-act="play" ${lock ? 'disabled' : ''}>打出這張</button>`;
  sheet.innerHTML = `<div class="grab"></div><div class="body">${img ? `<img class="art${g.v12 && c.echo_card ? ' echo-art' : ''}" src="${img}" alt="">` : g.v12 ? '<div class="ph big" aria-hidden="true"></div>' : `<div class="ph big">${esc(v.name)}</div>`}
    <h3>${esc(c.detail_name ? g.fill(c.detail_name) : v.name)}${TYPE_TAG[c.type] ? `<span class="tag">${TYPE_TAG[c.type]}</span>` : ''}</h3><p class="line">${esc(v.line)}</p>
    ${rule ? `<p class="rule">${esc(rule)}</p>` : ''}${fuse}${cost ? `<p class="cost">要花的時間 ${clocks(cost, cost)}</p>` : ''}${lock ? `<p class="lock">${esc(lock)}</p>` : ''}</div>
    <div class="row">${btns}</div>`;
  sheet.querySelectorAll<HTMLButtonElement>('[data-act="close"]').forEach((b) => b.onclick = closeSheet);
  const pb = sheet.querySelector<HTMLButtonElement>('[data-act="play"]'); if (pb) pb.onclick = once(() => { if (!g.hand.some((h) => h.uid === uid) || g.lockReason(i)) return; last = g.play(uid); render(); });
  requestAnimationFrame(() => { sheet.classList.add('open'); app.querySelector('.scrim')!.classList.add('open'); });
}
function closeSheet() { app.querySelector('.sheet')?.classList.remove('open'); app.querySelector('.scrim')?.classList.remove('open'); }
/** 過完這學期：背著的包袱晃一下、held_text 便條（引擎 endYear 之後就會清掉，所以先在這裡收集） */
function endTerm() {
  const sticky = g.v12 ? g.hand.filter((i) => g.card(i).sticky) : [];
  const held = [...new Set(sticky.map((i) => g.card(i).held_text).filter((t): t is string => !!t).map((t) => g.fill(t)))];
  const go = () => { heldShown = held; last = null; g.endYear(); render(); };
  if (!sticky.length) { go(); return; }
  for (const i of sticky) app.querySelector(`.mini[data-u="${i.uid}"]`)?.classList.add('shake');
  const toast = app.querySelector<HTMLElement>('.toast'); if (held.length && toast) { toast.innerHTML = held.map(esc).join('<br>'); toast.classList.add('show'); }
  committed = true; setTimeout(() => { committed = false; go(); }, held.length ? 1600 : 700);
}

// ----- 回顧（可以捲） -----
function renderReview() {
  const yrs = '這幾年';
  const d = g.deltas(); const traj = g.trajectory(); const regret = g.regretLevel();
  const ds = STATS.filter((k) => d[k]).map((k) => { const v = d[k]; return `<span class="delta ${(k === 'stress' ? -v : v) > 0 ? 'up' : 'down'}">${STAT_NAMES[k]} ${Math.abs(v) >= 15 ? '大幅' : ''}${v > 0 ? '變多了' : '變少了'}</span>`; }).join('　');
  const pic = (id: string) => cardArt(id);
  const photo = (id: string, cap: string | undefined, cls: string, style = '') => { const img = pic(id); const v = g.view(id);
    return `<figure class="rv-card ${cls}" style="${style}" data-card="${id}">${img ? `<img src="${img}" alt="${esc(v.name)}" loading="lazy">` : g.v12 ? '<div class="blank" aria-hidden="true"></div>' : `<div class="blank">${esc(v.name)}</div>`}<figcaption><b>${esc(v.name)}</b>${cap ? `<span class="cap">${esc(cap)}</span>` : ''}</figcaption></figure>`; };
  const album = Object.entries(g.playCount).map(([id, n]) => ({ c: g.cards.get(id)!, n })).filter((x) => x.c.type !== 'forced' && x.c.type !== 'era' && g.text(x.c.id, 'album_text')).sort((a, b) => b.n - a.n).slice(0, 3);
  const missed = g.missed.slice(0, 5);
  const tilt = (k: number) => `${k % 2 ? '' : '-'}${(2 + ((k * 7) % 3) / 2).toFixed(1)}deg`;
  const kept = [...new Set([...g.draw, ...g.discard, ...g.hand].map((i) => i.id).filter((id) => ['burden', 'growth'].includes(g.cards.get(id)!.type)))];
  const eraLines = g.v12 ? g.eraReviewLines() : [];
  const ending = (() => { const id = g.endingId(); const e = id ? (endingsJson as any).endings.find((x: any) => x.id === id) : null; return e ? `<div class="card"><p class="muted">${esc(e.title)}</p><p class="pre">${esc((regret === 'high' ? e.regret_high : e.regret_low) ?? '')}</p></div>` : ''; })();
  mount(`<div class="review" data-screen="review">${ending}<h1 class="rv-title">結局：${regret === 'high' ? '有些門你沒有推開，它們後來也沒有再開過。' : '回頭看的時候，大部分的路你都走過了。'}</h1>
  <div class="card"><h2>${yrs}</h2><p>${ds || `${yrs}，什麼都沒變。`}</p>
  ${g.passiveEnding() ? `<p class="pre">${esc(g.passiveEnding()!)}</p>` : ''}<p>${traj.length ? `大家記得的你：${traj.map(esc).join('、')}` : `大家好像不太記得你${yrs}在幹嘛。`}</p>${g.sickCount ? `<p class="muted">那幾年，${g.sickCount === 1 ? '你病倒過。' : '你病倒過好幾回。'}</p>` : ''}</div>
  ${eraLines.length ? `<div class="card eralines"><h2>那幾年</h2>${eraLines.map((t) => `<p>${esc(t)}</p>`).join('')}</div>` : ''}
  <h2 class="rv-h">人生相簿・${g.runStageLabel()}</h2>${album.length ? `<div class="rv-row">${album.map((x) => photo(x.c.id, g.text(x.c.id, 'album_text'), 'played')).join('')}</div>` : `<p class="muted">${yrs}沒留下什麼照片。</p>`}
  <h2 class="rv-h rv-missed-h">沒走的路</h2>${missed.length ? `<div class="rv-row">${missed.map((m, k) => { const c = g.cards.get(m.id)!; return photo(m.id, g.text(m.id, 'regret_text') ?? m.echo?.text, 'missed', `--acc:${accentOf(c)};--tilt:${tilt(k)}`); }).join('')}</div>` : '<p class="muted">該做的，你都做了。</p>'}
  ${g.branchNotTaken ? `<p class="muted">如果當時選了${esc(g.branchNotTaken.name)}……${g.branchNotTaken.text ? esc(g.branchNotTaken.text) : ''}</p>` : ''}
  ${kept.length ? `<h2 class="rv-h">還留在身上的</h2><div class="rv-row">${kept.map((id) => photo(id, undefined, 'kept')).join('')}</div>` : ''}
  ${achPanel()}
  <button class="btn primary" id="again">再來一局</button><p class="muted" style="text-align:center;margin-top:8px"><a href="./">回到原本的玩法</a></p></div>`, 'review-wrap');
  window.scrollTo(0, 0);
  document.getElementById('again')!.onclick = () => startDeck(app, undefined, Math.floor(Math.random() * 2 ** 31));
}
