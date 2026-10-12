// 讀 art/generated/manifest.json，把每張插圖轉成 webp（寬 ≤ 800px、quality 80）
// 輸出到 game/.illustrations/<event_id>.webp（不改 art/ 原檔）。原檔較新時才重轉。
import sharp from 'sharp';
import { readFileSync, existsSync, mkdirSync, statSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const game = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(game, '..');
const out = join(game, '.illustrations');
mkdirSync(out, { recursive: true });
const manPath = join(root, 'art/generated/manifest.json');
const manifest = existsSync(manPath) ? JSON.parse(readFileSync(manPath, 'utf8')) : {};
let before = 0, after = 0, made = 0, missing = [];
const keep = new Set();
for (const [id, rel] of Object.entries(manifest)) {
  const src = join(root, rel);
  if (!existsSync(src)) { missing.push(`${id} → ${rel}`); continue; }
  const dst = join(out, `${id}.webp`); keep.add(`${id}.webp`);
  before += statSync(src).size;
  if (!existsSync(dst) || statSync(dst).mtimeMs < statSync(src).mtimeMs) {
    await sharp(src).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 80 }).toFile(dst); made++;
  }
  after += statSync(dst).size;
}
for (const f of readdirSync(out)) if (!keep.has(f)) rmSync(join(out, f)); // 已從 manifest 移除的圖
const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log(`[illustrations] ${keep.size} 張：原檔 ${kb(before)} → webp ${kb(after)}（本次轉檔 ${made} 張）`);
if (missing.length) console.warn('[illustrations] manifest 指向的檔案不存在：\n  ' + missing.join('\n  '));

// 行動圖示：art/actions/<action_id>.png → game/.actions/<action_id>.webp（128px）。沒有圖就不產生，UI 自動退回無圖示。
{
  const srcDir = join(root, 'art/actions'); const outA = join(game, '.actions'); mkdirSync(outA, { recursive: true });
  const keepA = new Set(); let madeA = 0;
  if (existsSync(srcDir)) for (const f of readdirSync(srcDir)) {
    if (!f.endsWith('.png')) continue;
    const id = f.replace(/\.png$/, '').replace(/^act_/, ''); const src = join(srcDir, f); const dst = join(outA, `${id}.webp`); keepA.add(`${id}.webp`);
    if (!existsSync(dst) || statSync(dst).mtimeMs < statSync(src).mtimeMs) { await sharp(src).resize({ width: 128, withoutEnlargement: true }).webp({ quality: 85 }).toFile(dst); madeA++; }
  }
  for (const f of readdirSync(outA)) if (!keepA.has(f)) rmSync(join(outA, f));
  console.log(`[actions] ${keepA.size} 個行動圖示（本次轉檔 ${madeA} 個）`);
}
