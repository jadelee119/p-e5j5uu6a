#!/usr/bin/env python3
"""v1.2 預覽用單一 HTML：一個檔案、不用網路，雙擊打開就是 ?mode=deck&v12=1。
用法（在 game/ 底下）：python3 scripts/build-single-file.py [輸出檔]（預設 /workspace/preview/taiwan-life-v1.2-preview.html，不在 repo 裡）
- 不碰 dist/、不碰 GitHub Pages、不改 data/ 的 v12.json（enabled 照舊 false，靠網址參數 v12=1 打開）
- 外部字型的 @import 拿掉（離線不報錯），用後備字型
- 圖片只在這個檔案裡縮成最長邊 MAX_SIDE、轉 WebP（品質 Q），正式版圖檔不變
- 建置來源標在分頁標題、<meta name="build-commit">、檔頭註解和 console（畫面上不放，守「畫面不出現阿拉伯數字」）
"""
import base64, io, mimetypes, os, re, subprocess, sys, tempfile
from PIL import Image

MAX_SIDE, Q = 720, 72
here = os.path.dirname(os.path.abspath(__file__)); game = os.path.dirname(here)
out = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '/workspace/preview/taiwan-life-v1.2-preview.html')
dist = tempfile.mkdtemp(prefix='sf-dist-')
subprocess.run(['npx', 'vite', 'build', '--config', 'scripts/single-file.config.ts', '--outDir', dist, '--emptyOutDir'], cwd=game, check=True)

def data_uri(path):
    ext = path.rsplit('.', 1)[-1].lower()
    raw = open(path, 'rb').read()
    if ext in ('jpg', 'jpeg', 'png', 'webp'):
        im = Image.open(io.BytesIO(raw)); im.load()
        if max(im.size) > MAX_SIDE: im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        if im.mode not in ('RGB', 'RGBA'): im = im.convert('RGBA' if 'A' in im.getbands() or im.mode == 'P' else 'RGB')
        buf = io.BytesIO(); im.save(buf, 'WEBP', quality=Q, method=6)
        if buf.tell() < len(raw) or ext != 'webp': raw, mime = buf.getvalue(), 'image/webp'
        else: mime = 'image/webp'
    else:
        mime = {'woff2': 'font/woff2', 'svg': 'image/svg+xml'}.get(ext) or mimetypes.guess_type(path)[0] or 'application/octet-stream'
    return f'data:{mime};base64,' + base64.b64encode(raw).decode()

files = {}
for d in ('assets', 'fonts'):
    p = os.path.join(dist, d)
    if os.path.isdir(p):
        for f in os.listdir(p):
            if not f.endswith(('.js', '.css', '.txt', '.map')): files[f] = os.path.join(p, f)
cache = {}
def sub_assets(text):
    def rep(m):
        f = m.group(2)
        if f not in cache: cache[f] = data_uri(files[f])
        return cache[f]
    names = '|'.join(re.escape(f) for f in sorted(files, key=len, reverse=True))
    return re.sub(r'((?:\.\.?/)?(?:assets/|fonts/)?)(' + names + r')', rep, text)

html = open(os.path.join(dist, 'index.html'), encoding='utf-8').read()
# 建置來源：HEAD 短 hash；遊戲會用到的資料夾裡「追蹤中的檔案」有沒 commit 的改動就加 -dirty（沒追蹤的檔案如 node_modules symlink 不算，QA O2）
git = lambda *a: subprocess.run(['git', *a], cwd=game, capture_output=True, text=True).stdout.strip()
commit = git('rev-parse', '--short', 'HEAD')
if git('status', '--porcelain', '--untracked-files=no', '--', '../game', '../data', '../writing', '../art'): commit += '-dirty'
built = subprocess.run(['date', '+%Y-%m-%d %H:%M %Z'], capture_output=True, text=True).stdout.strip()
stamp = f'v1.2 預覽 · build {commit} · {built}'
html = re.sub(r'<title>(.*?)</title>', lambda m: f'<title>{m.group(1)}（{stamp}）</title>', html, count=1)
html = html.replace('<head>', f'<head>\n<!-- {stamp} -->\n<meta name="build-commit" content="{commit}">', 1)
js_m = re.search(r'<script type="module" crossorigin src="\./assets/([^"]+\.js)"></script>', html)
css_m = re.search(r'<link rel="stylesheet" crossorigin href="\./assets/([^"]+\.css)">', html)
js = sub_assets(open(os.path.join(dist, 'assets', js_m.group(1)), encoding='utf-8').read())
css = sub_assets(open(os.path.join(dist, 'assets', css_m.group(1)), encoding='utf-8').read())
# 離線開也不要有錯誤：拿掉外部字型的 @import（Google Fonts），改用 font-family 裡的後備字型；內嵌的粉圓照舊（QA r8d B1）
css, nimp = re.subn(r'@import\s*(?:url\(\s*)?(?:"https?://[^"]*"|\'https?://[^\']*\'|https?://[^)\s;]*)\s*\)?[^;]*;', '', css)
if re.search(r'@import[^;]*https?://', css): sys.exit('外部 @import 沒拿乾淨')
left = re.findall(r'["(]\.{0,2}/?(?:assets|fonts)/[^")]+', js + css)
if left: sys.exit('還有沒內嵌的檔案：' + ', '.join(sorted(set(left))[:10]))
# 沒帶 mode 參數就直接進 v1.2（雙擊打開的情況）
boot = f"<script>console.info({stamp!r});if(!/[?&]mode=/.test(location.search))history.replaceState(null,'',location.pathname+'?mode=deck&v12=1'+location.hash)</script>"
js = js.replace('</script', '<\\/script')
html = html.replace(css_m.group(0), '<style>' + css + '</style>')
html = html.replace(js_m.group(0), boot + '\n<script type="module">' + js + '</script>')
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, 'w', encoding='utf-8').write(html)
print(f'{out}  {os.path.getsize(out)/1e6:.1f} MB  （內嵌 {len(cache)} 個檔案）  {stamp}')
