// 記憶牌 SVG → PNG（headless Chrome，1.25× ＝ 600×750；之後跑 pack_png.py 壓成調色盤 PNG），再拼 contact-sheet.png。
// 需要 puppeteer-core：在任意暫存資料夾 npm i puppeteer-core 後以 NODE_PATH 指向（同 art/ui/mobile-v12/src/render.mjs）。
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';
const puppeteer = createRequire(import.meta.url)('puppeteer-core'); // require 會吃 NODE_PATH（ESM import 不會）
const dir = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const only = process.argv[2];
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--allow-file-access-from-files'], headless: true });
const p = await b.newPage();
const files = fs.readdirSync(dir).filter((f) => /^mem_.*\.svg$/.test(f) && (!only || f.includes(only))).sort();
for (const f of files) {
  await p.setViewport({ width: 480, height: 600, deviceScaleFactor: 1.25 });
  await p.goto('file://' + path.join(dir, f), { waitUntil: 'networkidle0' });
  await p.screenshot({ path: path.join(dir, f.replace('.svg', '.png')) });
}
if (!only) {
  // contact sheet：6 欄 × 5 列，每格下方小字寫 id（只在開發文件上，不進美術圖）
  const man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const tiles = Object.entries(man.cards).map(([id, c]) => `<figure><img src="${id}.png"><figcaption><i style="background:${c.accent}"></i>${id}</figcaption></figure>`).join('');
  const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#EDEFE8;font:13px/1.2 "Noto Sans TC",sans-serif;color:#33302B}
  .g{display:grid;grid-template-columns:repeat(6,200px);gap:18px 16px;padding:24px}figure{margin:0}img{width:200px;height:250px;display:block;border-radius:7px;box-shadow:0 2px 6px #0002}
  figcaption{margin-top:6px;display:flex;gap:6px;align-items:center}i{width:12px;height:12px;border-radius:50%;display:inline-block}</style><div class="g">${tiles}</div>`;
  fs.writeFileSync(path.join(dir, '.contact.html'), html);
  await p.setViewport({ width: 24 * 2 + 6 * 200 + 5 * 16, height: 24 * 2 + 5 * (250 + 26) + 4 * 18, deviceScaleFactor: 1 });
  await p.goto('file://' + path.join(dir, '.contact.html'), { waitUntil: 'networkidle0' });
  await p.screenshot({ path: path.join(dir, 'contact-sheet.png') });
  fs.unlinkSync(path.join(dir, '.contact.html'));
}
await b.close();
console.log('rendered', files.length);
