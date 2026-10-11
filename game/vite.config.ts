import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
// data/ 與 writing/ 是唯一資料來源：透過 @data / @writing alias 直接 import，不複製。
export default defineConfig({
  // GitHub Pages：BASE_PATH=/<repo>/ npm run build；預設 '/'
  base: process.env.BASE_PATH || '/',
  resolve: {
    alias: {
      '@data': fileURLToPath(new URL('../data', import.meta.url)),
      '@writing': fileURLToPath(new URL('../writing', import.meta.url)),
    },
  },
  server: { fs: { allow: ['..'] } },
});
