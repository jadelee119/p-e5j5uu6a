// 回音牌 SVG → PNG（headless Chrome，1.25× ＝ 600×750；之後跑 pack_echo.py 壓成調色盤 PNG＋輸出 WebP），再拼 contact-sheet.png。
// 需要 puppeteer-core：在任意暫存資料夾 npm i puppeteer-core 後以 NODE_PATH 指向（同 art/deck/memory/src/render.mjs）。
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';
const puppeteer = createRequire(import.meta.url)('puppeteer-core');
const src = path.dirname(url.fileURLToPath(import.meta.url));
const dir = path.resolve(src, '..');
const only = process.argv[2];
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--allow-file-access-from-files'], headless: true });
const p = await b.newPage();
const files = fs.readdirSync(src).filter((f) => /^echo_.*\.svg$/.test(f) && (!only || f.includes(only))).sort();
for (const f of files) {
  await p.setViewport({ width: 480, height: 600, deviceScaleFactor: 1.25 });
  await p.goto('file://' + path.join(src, f), { waitUntil: 'networkidle0' });
  await p.screenshot({ path: path.join(dir, f.replace('.svg', '.png')) });
}
if (!only) {
  // contact sheet：4 欄，每格下方小字寫組名和主色（只在開發文件上，不進美術圖）
  const man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const ent = Object.entries(man.groups);
  const tiles = ent.map(([gid, c]) => `<figure><img src="echo_${gid}.png"><figcaption><i style="background:${c.accent}"></i>${gid} ${c.accent}</figcaption></figure>`).join('');
  const cols = 4, rows = Math.ceil(ent.length / cols);
  const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#EDEFE8;font:14px/1.2 "Noto Sans TC",sans-serif;color:#33302B}
  .g{display:grid;grid-template-columns:repeat(${cols},240px);gap:18px 16px;padding:24px}figure{margin:0}img{width:240px;height:300px;display:block;border-radius:7px;box-shadow:0 2px 6px #0002}
  figcaption{margin-top:6px;display:flex;gap:6px;align-items:center}i{width:12px;height:12px;border-radius:50%;display:inline-block}</style><div class="g">${tiles}</div>`;
  fs.writeFileSync(path.join(dir, '.contact.html'), html);
  await p.setViewport({ width: 48 + cols * 240 + (cols - 1) * 16, height: 48 + rows * (300 + 26) + (rows - 1) * 18, deviceScaleFactor: 1 });
  await p.goto('file://' + path.join(dir, '.contact.html'), { waitUntil: 'networkidle0' });
  await p.screenshot({ path: path.join(dir, 'contact-sheet.png') });
  fs.unlinkSync(path.join(dir, '.contact.html'));
}
await b.close();
console.log('rendered', files.length);
