import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
// 顯示用 v0.x（取 major.minor）；單一來源：package.json version
const appVersion = 'v' + pkg.version.split('.').slice(0, 2).join('.');

// data/ 與 writing/ 是唯一資料來源：透過 @data / @writing alias 直接 import，不複製。
export default defineConfig({
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
