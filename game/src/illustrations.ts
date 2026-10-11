// 插圖：由 scripts/optimize-images.mjs 從 art/generated/manifest.json 產生 .illustrations/<event_id>.webp，
// 這裡用 glob 讓 Vite 打包。美術重畫同名檔案後重新 build 即可，不用改程式。
const files = import.meta.glob('../.illustrations/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const byId: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) byId[path.split('/').pop()!.replace(/\.webp$/, '')] = url;
export const illustrationFor = (eventId: string): string | undefined => byId[eventId];
