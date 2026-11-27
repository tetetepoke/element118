"""Build a light Carbon GLB for the 3D prototype.

Usage: python3 -I scripts/make-carbon-lite.py <in.glb> <out.glb> [maxTex]
- keeps only the clips the game uses (KEEP)
- resizes textures to maxTex px (default 1024) and re-encodes them (JPEG / WebP)
- copies only the buffer data that is still referenced
"""
import io, json, struct, sys
from PIL import Image

KEEP = ['Idle', 'Walk', 'Jog', 'Sprint', 'Jump', 'HitReact', 'Death', 'Hook', 'Cheer']

src, dst = sys.argv[1], sys.argv[2]
maxtex = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
b = open(src, 'rb').read()
jl = struct.unpack('<I', b[12:16])[0]
j = json.loads(b[20:20 + jl])
binoff = 20 + jl + 8
blob = b[binoff:binoff + struct.unpack('<I', b[20 + jl:24 + jl])[0]]

j['animations'] = [a for a in j['animations'] if a['name'] in KEEP]

def view_bytes(i):
    v = j['bufferViews'][i]
    o = v.get('byteOffset', 0)
    return blob[o:o + v['byteLength']]

# re-encode images
for img in j['images']:
    data = view_bytes(img['bufferView'])
    im = Image.open(io.BytesIO(data))
    print('image', img.get('mimeType'), im.size, len(data))
    if max(im.size) > maxtex:
        im = im.resize((maxtex, round(im.size[1] * maxtex / im.size[0])), Image.LANCZOS)
    out = io.BytesIO()
    if img.get('mimeType') == 'image/webp':
        im.save(out, 'WEBP', quality=90)
    else:
        im.convert('RGB').save(out, 'JPEG', quality=88, optimize=True)
        img['mimeType'] = 'image/jpeg'
    img['_data'] = out.getvalue()

# collect referenced accessors
used_acc = set()
for m in j['meshes']:
    for p in m['primitives']:
        used_acc.update(p['attributes'].values())
        if 'indices' in p: used_acc.add(p['indices'])
        for t in p.get('targets', []): used_acc.update(t.values())
for s in j.get('skins', []):
    if 'inverseBindMatrices' in s: used_acc.add(s['inverseBindMatrices'])
for a in j['animations']:
    for sm in a['samplers']:
        used_acc.update([sm['input'], sm['output']])

acc_map, new_acc = {}, []
for i, a in enumerate(j['accessors']):
    if i in used_acc:
        acc_map[i] = len(new_acc); new_acc.append(a)

new_views, out_bin = [], bytearray()
def add_view(data, extra):
    while len(out_bin) % 4: out_bin.append(0)
    v = dict(extra); v['buffer'] = 0; v['byteOffset'] = len(out_bin); v['byteLength'] = len(data)
    out_bin.extend(data); new_views.append(v)
    return len(new_views) - 1

view_map = {}
for a in new_acc:
    if 'bufferView' in a:
        old = a['bufferView']
        if old not in view_map:
            ov = j['bufferViews'][old]
            view_map[old] = add_view(view_bytes(old), {k: ov[k] for k in ('byteStride', 'target') if k in ov})
        a['bufferView'] = view_map[old]
for img in j['images']:
    img['bufferView'] = add_view(img.pop('_data'), {})

def remap(d, key):
    if key in d: d[key] = acc_map[d[key]]
for m in j['meshes']:
    for p in m['primitives']:
        p['attributes'] = {k: acc_map[v] for k, v in p['attributes'].items()}
        remap(p, 'indices')
        if 'targets' in p: p['targets'] = [{k: acc_map[v] for k, v in t.items()} for t in p['targets']]
for s in j.get('skins', []): remap(s, 'inverseBindMatrices')
for a in j['animations']:
    for sm in a['samplers']: sm['input'] = acc_map[sm['input']]; sm['output'] = acc_map[sm['output']]

j['accessors'], j['bufferViews'] = new_acc, new_views
while len(out_bin) % 4: out_bin.append(0)
j['buffers'] = [{'byteLength': len(out_bin)}]
js = json.dumps(j, separators=(',', ':')).encode()
js += b' ' * ((4 - len(js) % 4) % 4)
total = 12 + 8 + len(js) + 8 + len(out_bin)
with open(dst, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, total))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(out_bin), 0x004E4942)); f.write(out_bin)
print('clips', [a['name'] for a in j['animations']], 'size', total)
