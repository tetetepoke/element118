"""Build dist-single/element118.html: the whole game in one file (sprites embedded as data: URLs)."""
import base64, glob, json, os, re, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tmp = os.path.join(ROOT, 'dist-single', '_build')
subprocess.run(['npx', 'vite', 'build', '--base=./', '--outDir', tmp, '--emptyOutDir'], cwd=ROOT, check=True, capture_output=True)
html = open(os.path.join(tmp, 'index.html'), encoding='utf-8').read()
js = open(glob.glob(os.path.join(tmp, 'assets', 'index-*.js'))[0], encoding='utf-8').read()
manifest = json.load(open(os.path.join(ROOT, 'public/assets/manifest.json'), encoding='utf-8'))
for k, v in manifest.items():
    if isinstance(v, dict) and 'file' in v:
        data = open(os.path.join(ROOT, 'public/assets', v['file']), 'rb').read()
        v['file'] = 'data:image/png;base64,' + base64.b64encode(data).decode()
html = re.sub(r'<script type="module" crossorigin src="[^"]+"></script>', '', html)
html = re.sub(r'\s*<link rel="(manifest|apple-touch-icon|icon)"[^>]*>', '', html)
js = js.replace('</script', '<\\/script')
inject = '<script>window.__E118_MANIFEST=' + json.dumps(manifest) + ';</script>\n<script type="module">' + js + '</script>\n</body>'
html = html.replace('</body>', inject)
out = os.path.join(ROOT, 'dist-single', 'element118.html')
open(out, 'w', encoding='utf-8').write(html)
print(out, len(html) // 1024, 'KB')
