/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

declare module 'virtual:era-art' { const urls: Record<string, string>; export default urls; }
declare module 'virtual:echo-art' { const urls: Record<string, string>; export default urls; export const focus: Record<string, string>; }
