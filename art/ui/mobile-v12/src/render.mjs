// SVG → PNG（headless Chrome，2× 解析度）。需要 puppeteer-core：在任意暫存資料夾 npm i puppeteer-core 後以 NODE_PATH 指向。
import puppeteer from 'puppeteer-core';
import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';
const dir = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--allow-file-access-from-files'], headless: true });
const p = await b.newPage();
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.svg'))) {
  const svg = fs.readFileSync(path.join(dir, f), 'utf8');
  const [, w, h] = svg.match(/width="(\d+)" height="(\d+)"/);
  await p.setViewport({ width: +w, height: +h, deviceScaleFactor: 2 });
  await p.goto('file://' + path.join(dir, f), { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 300));
  await p.screenshot({ path: path.join(dir, f.replace('.svg', '.png')) });
  console.log(f);
}
await b.close();
