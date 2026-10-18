// 舊電視框預覽：SVG 內嵌進 HTML（讓 var(--acc) 生效），下面墊真實牌圖，三種主色 → tv-frame-preview.png。
// 也匯出單張 tv-frame.png（備用色、螢幕透明）。需要 puppeteer-core（NODE_PATH，同 memory/src/render.mjs）。
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';
const puppeteer = createRequire(import.meta.url)('puppeteer-core');
const dir = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const deck = process.env.DECK_DIR || path.resolve(dir, '..');
const svg = fs.readFileSync(path.join(dir, 'tv-frame.svg'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'tv-frame.css'), 'utf8');
const samples = [['d_play.jpg', '#8A5A3C', '木頭（備用色）'], ['s_study.jpg', '#3A6FB0', '#3A6FB0'], ['f_recession.jpg', '#A8322D', '#A8322D']];
const box = (img, acc, w) => `<div class="tv-box" style="--acc:${acc};width:${w}px"><img class="tv-art" src="file://${path.join(deck, img)}"><span class="tv-frame">${svg}</span></div>`;
const html = `<!doctype html><meta charset="utf-8"><style>${css}
body{margin:0;background:#EDEFE8;font:14px "Noto Sans TC",sans-serif;color:#33302B;padding:24px}
.row{display:flex;gap:24px;align-items:flex-end;margin-bottom:18px}.cap{margin-top:6px}</style>
<div class="row">${samples.map(([i, a, c]) => `<div>${box(i, a, 400)}<div class="cap">--acc: ${c}</div></div>`).join('')}</div>
<div class="row">${samples.map(([i, a]) => box(i, a, 150)).join('')}<div class="cap">← 實際小尺寸（寬 150px）</div></div>`;
fs.writeFileSync(path.join(dir, '.preview.html'), html);
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--allow-file-access-from-files'], headless: true });
const p = await b.newPage();
await p.setViewport({ width: 24 * 2 + 400 * 3 + 24 * 2, height: 24 + 225 + 30 + 18 + 90 + 24, deviceScaleFactor: 1.5 });
await p.goto('file://' + path.join(dir, '.preview.html'), { waitUntil: 'networkidle0' });
await p.screenshot({ path: path.join(dir, 'tv-frame-preview.png'), fullPage: true });
fs.unlinkSync(path.join(dir, '.preview.html'));
await p.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
await p.goto('file://' + path.join(dir, 'tv-frame.svg'), { waitUntil: 'networkidle0' });
await p.screenshot({ path: path.join(dir, 'tv-frame.png'), omitBackground: true });
await b.close(); console.log('ok');
