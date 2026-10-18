// 時代牌牌圖 SVG → PNG（1280×720），再做 era-contact-sheet.png（每張疊上 tv-frame.svg，框色＝各自主色）。
// 需要 puppeteer-core（NODE_PATH 指向它的 node_modules）。PNG 之後跑 pack_era.py 壓成調色盤。
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';
const puppeteer = createRequire(import.meta.url)('puppeteer-core');
const src = path.dirname(url.fileURLToPath(import.meta.url)); const dir = path.resolve(src, '..');
const only = process.argv[2];
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--allow-file-access-from-files'], headless: true });
const p = await b.newPage();
const files = fs.readdirSync(path.join(src, 'svg')).filter((f) => f.endsWith('.svg') && (!only || f.includes(only))).sort();
for (const f of files) {
  await p.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await p.goto('file://' + path.join(src, 'svg', f), { waitUntil: 'networkidle0' });
  await p.screenshot({ path: path.join(dir, f.replace('.svg', '.png')) });
}
if (!only) {
  const man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const frame = fs.readFileSync(path.join(dir, 'tv-frame.svg'), 'utf8');
  const css = fs.readFileSync(path.join(dir, 'tv-frame.css'), 'utf8');
  const tiles = Object.entries(man.cards).map(([id, c]) => `<figure><div class="tv-box" style="--acc:${c.accent}"><img class="tv-art" src="${id}.png"><span class="tv-frame">${frame}</span></div><figcaption><i style="background:${c.accent}"></i>${id}</figcaption></figure>`).join('');
  fs.writeFileSync(path.join(dir, '.sheet.html'), `<!doctype html><meta charset="utf-8"><style>${css}
  body{margin:0;background:#EDEFE8;font:14px "Noto Sans TC",sans-serif;color:#33302B}.g{display:grid;grid-template-columns:repeat(3,400px);gap:20px 18px;padding:24px}
  figure{margin:0}figcaption{margin-top:6px;display:flex;gap:6px;align-items:center}i{width:12px;height:12px;border-radius:50%;display:inline-block}</style><div class="g">${tiles}</div>`);
  await p.setViewport({ width: 24 * 2 + 3 * 400 + 2 * 18, height: 400, deviceScaleFactor: 1.5 });
  await p.goto('file://' + path.join(dir, '.sheet.html'), { waitUntil: 'networkidle0' });
  await p.screenshot({ path: path.join(dir, 'era-contact-sheet.png'), fullPage: true });
  fs.unlinkSync(path.join(dir, '.sheet.html'));
}
await b.close(); console.log('rendered', files.length);
