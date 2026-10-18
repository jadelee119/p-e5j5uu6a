// 單一檔案預覽版用的 vite 設定：沿用 vite.config.ts，只把動態 import 併進同一支 JS、CSS 不拆。
// 由 scripts/build-single-file.py 呼叫，不影響一般 build 和 GitHub Pages。
import { mergeConfig } from 'vite';
import base from '../vite.config';
export default mergeConfig(base, {
  base: './',
  build: { cssCodeSplit: false, modulePreload: false, rollupOptions: { output: { inlineDynamicImports: true } } },
});
