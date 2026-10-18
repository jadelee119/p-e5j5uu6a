import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import type { Plugin } from 'vite';
import { nameBreakIssues, frozenNameIssues, frozenHandCards, parseBreakTable, fmtNameIssue, nameBreakStrict } from './src/logic/names';

// 時代牌場景圖：同名有 .webp 就只用 .webp（480×270），沒有才退回 .png；build 時就決定，沒被選到的 PNG 不會進 dist
const eraArtDir = fileURLToPath(new URL('../art/deck/era/', import.meta.url));
function eraArt(): Plugin {
  const id = 'virtual:era-art', rid = '\0' + id;
  return { name: 'era-art', resolveId: (s) => (s === id ? rid : undefined),
    load(s) { if (s !== rid) return;
      const files = readdirSync(eraArtDir); const pick = new Map<string, string>();
      for (const f of files) { const m = /^(era_[a-z0-9_]+)\.(webp|png)$/.exec(f); if (!m) continue; if (m[2] === 'webp' || !pick.has(m[1])) pick.set(m[1], f); }
      const ents = [...pick].sort(); return ents.map(([, f], k) => `import u${k} from ${JSON.stringify(eraArtDir + f + '?url')};`).join('\n') + `\nexport default {${ents.map(([n], k) => `${JSON.stringify(n)}: u${k}`).join(', ')}};`; } };
}

// 回音牌插圖（v1.2）：路徑規則在 data/deck/v12.json echo_art（pattern 的 {group}、ext 先後）。每組只挑第一個存在的副檔名（webp 優先），
// build 時就決定：沒被選到的 PNG 不進 dist，沒檔的組不出現在清單裡（畫面走沒插圖樣式，不會發請求、不會 404）
const rootDir = fileURLToPath(new URL('../', import.meta.url));
function echoArt(): Plugin {
  const id = 'virtual:echo-art', rid = '\0' + id;
  return { name: 'echo-art', resolveId: (s) => (s === id ? rid : undefined),
    load(s) { if (s !== rid) return;
      const ea = (JSON.parse(readFileSync(rootDir + 'data/deck/v12.json', 'utf8')) as { echo_art?: { pattern?: string; ext?: string[]; manifest?: string } }).echo_art;
      if (!ea?.pattern?.includes('{group}')) return 'export default {};\nexport const focus = {};';
      // 手牌裁切焦點：美術 manifest 的 groups.<組名>.hand_focus（只收「數字% 數字%」，其他忽略＝置中）；manifest 只在 build 時讀，不進 dist
      const focus: Record<string, string> = {};
      try { const man = JSON.parse(readFileSync(rootDir + (ea.manifest ?? ''), 'utf8')) as { groups?: Record<string, { hand_focus?: unknown }> };
        for (const [grp, v] of Object.entries(man.groups ?? {})) if (typeof v.hand_focus === 'string' && /^\d{1,3}(\.\d+)?% \d{1,3}(\.\d+)?%$/.test(v.hand_focus)) focus[grp] = v.hand_focus; } catch { /* 沒有 manifest＝全部置中 */ }
      const slash = ea.pattern.lastIndexOf('/'); const dir = rootDir + ea.pattern.slice(0, slash + 1); const base = ea.pattern.slice(slash + 1);
      const exts = ea.ext?.length ? ea.ext : ['webp', 'png']; const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`^${base.split('{group}').map(esc).join('([a-z0-9_]+)')}\\.(${exts.map(esc).join('|')})$`);
      let files: string[] = []; try { files = readdirSync(dir); } catch { /* 還沒有資料夾＝全部走沒插圖樣式 */ }
      const pick = new Map<string, string>();
      for (const f of files) { const m = re.exec(f); if (!m) continue; const cur = pick.get(m[1]); if (!cur || exts.indexOf(m[2]) < exts.indexOf(cur.slice(cur.lastIndexOf('.') + 1))) pick.set(m[1], f); }
      const ents = [...pick].sort(); return ents.map(([, f], k) => `import u${k} from ${JSON.stringify(dir + f + '?url')};`).join('\n') + `\nexport default {${ents.map(([n], k) => `${JSON.stringify(n)}: u${k}`).join(', ')}};\nexport const focus = ${JSON.stringify(focus)};`; } };
}

// v1.2 牌名斷點（文案 00c1e09、ed107df）：build 時掃 cards_v12.json 的 name，和凍結檔牌名配 data/name_breaks_v12.json 的斷點版本（規則見 src/logic/names.ts）。
// src/logic/names.ts 的 NAME_BREAK_STRICT（預設 true）有問題就 build 失敗；NAME_BREAK_STRICT=0 環境變數可暫時改成警告
function nameBreaks(): Plugin {
  return { name: 'name-breaks', buildStart() {
    const rd = (f: string) => JSON.parse(readFileSync(rootDir + 'data/' + f, 'utf8')); const d = rd('deck/cards_v12.json');
    const table = existsSync(rootDir + 'data/name_breaks_v12.json') ? parseBreakTable(rd('name_breaks_v12.json')) : {};
    const issues = [...nameBreakIssues(d.cards ?? d), ...frozenNameIssues(frozenHandCards([rd('deck/cards.json'), rd('deck/cards_adult.json')], d), table)];
    if (!issues.length) return; const msg = `牌名斷點：${issues.length} 個問題\n` + issues.map((i) => '  ' + fmtNameIssue(i)).join('\n');
    if (nameBreakStrict()) this.error(msg); else this.warn(msg); } };
}

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
// 顯示用 v0.x（取 major.minor）；單一來源：package.json version
const appVersion = 'v' + pkg.version.split('.').slice(0, 2).join('.');

// data/ 與 writing/ 是唯一資料來源：透過 @data / @writing alias 直接 import，不複製。
export default defineConfig({
  plugins: [eraArt(), echoArt(), nameBreaks()],
  // GitHub Pages：BASE_PATH=/<repo>/ npm run build；預設 '/'
  base: process.env.BASE_PATH || '/',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  resolve: {
    alias: {
      '@data': fileURLToPath(new URL('../data', import.meta.url)),
      '@writing': fileURLToPath(new URL('../writing', import.meta.url)),
    },
  },
  server: { fs: { allow: ['..'] } },
});
