"""Cut game sprites out of the concept sprite sheet (art/source/concept-sheet.png).

The concept sheet is an illustration, not a grid-aligned sprite sheet, so each sprite is
cut from a rough box, its cream background is removed by flood fill from the box edges,
and it is scaled into the frame size the game expects (see ASSETS.md).
Output: public/assets/sprites/*.png and public/assets/manifest.json.

usage: python3 scripts/extract-sprites.py
"""
import json
import os
from collections import deque

from PIL import Image, ImageEnhance, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art/source/concept-sheet.png')
BASE_TILES = os.path.join(ROOT, 'art/source/placeholder-tiles.png')
OUT = os.path.join(ROOT, 'public/assets/sprites')
os.makedirs(OUT, exist_ok=True)

sheet = Image.open(SRC).convert('RGBA')


def is_bg(px, tol=34):
    r, g, b = px[:3]
    return min(r, g, b) > 255 - tol - 22 and max(r, g, b) - min(r, g, b) < 26


def cut(box, tol=34):
    """Crop a box and make its background transparent (flood fill from the edges)."""
    im = sheet.crop(box).copy()
    w, h = im.size
    px = im.load()
    seen = [[False] * h for _ in range(w)]
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[x][y]:
            continue
        seen[x][y] = True
        if not is_bg(px[x, y], tol):
            continue
        px[x, y] = (0, 0, 0, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def despeckle(im, min_size=14):
    """Remove isolated opaque specks smaller than min_size pixels."""
    w, h = im.size
    px = im.load()
    seen = set()
    for sx in range(w):
        for sy in range(h):
            if (sx, sy) in seen or px[sx, sy][3] == 0:
                continue
            comp, q = [], [(sx, sy)]
            seen.add((sx, sy))
            while q:
                x, y = q.pop()
                comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and px[nx, ny][3] > 0:
                        seen.add((nx, ny))
                        q.append((nx, ny))
            if len(comp) < min_size:
                for x, y in comp:
                    px[x, y] = (0, 0, 0, 0)
    return im


def fit(im, fw, fh, pad=1, align='bottom', max_h=None):
    """Scale a sprite into an fw x fh frame, bottom-centred, with hard alpha edges."""
    w, h = im.size
    mh = (max_h or fh) - pad
    s = min((fw - 2 * pad) / w, mh / h)
    nw, nh = max(1, round(w * s)), max(1, round(h * s))
    small = im.resize((nw, nh), Image.LANCZOS)
    a = small.split()[3].point(lambda v: 255 if v > 110 else 0)
    small.putalpha(a)
    small = despeckle(small)
    small = ImageEnhance.Contrast(small).enhance(1.08)
    frame = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
    x = (fw - nw) // 2
    y = fh - nh - (1 if align == 'bottom' else 0) if align == 'bottom' else (fh - nh) // 2
    frame.alpha_composite(small, (x, max(0, y)))
    return frame


def shift(fr, dx=0, dy=0):
    out = Image.new('RGBA', fr.size, (0, 0, 0, 0))
    out.alpha_composite(fr, (dx, dy)) if dx >= 0 and dy >= 0 else out.paste(fr, (dx, dy), fr)
    return out


def tint(fr, color, amount):
    over = Image.new('RGBA', fr.size, color + (0,))
    a = fr.split()[3].point(lambda v: int(v * amount))
    over.putalpha(a)
    out = fr.copy()
    out.alpha_composite(over)
    return out


def squash(fr, fy=0.8):
    w, h = fr.size
    bb = fr.getbbox()
    if not bb:
        return fr
    body = fr.crop(bb)
    nh = max(1, int(body.height * fy))
    body = body.resize((body.width, nh), Image.NEAREST)
    out = Image.new('RGBA', fr.size, (0, 0, 0, 0))
    out.alpha_composite(body, (bb[0], h - 1 - nh))
    return out


manifest = {}

# ───────────── Carbon (player): 14 cols x 3 rows of 32x32 ─────────────
front = cut((285, 405, 390, 575))
side = cut((395, 405, 495, 575))
back = cut((500, 405, 615, 575))
walk_boxes = [(318 + i * 63, 735, 318 + (i + 1) * 63, 825) for i in range(6)]
walks = [cut(b) for b in walk_boxes]

FW = FH = 32
f_front, f_back = fit(front, FW, FH), fit(back, FW, FH)
f_side = ImageOps.mirror(fit(side, FW, FH))  # concept pose faces left; the sheet row is right-facing


def facing_right(fr):
    """The concept walk frames 1-3 face left, 4-6 face right. Normalise to right-facing."""
    return fr


walk_right = [fit(w, FW, FH) for w in walks[3:6]]
walk_left_as_right = [ImageOps.mirror(fit(w, FW, FH)) for w in walks[0:3]]
side_walk = [walk_right[0], walk_left_as_right[1], walk_right[2], walk_left_as_right[0]]


def row_frames(base, walk=None):
    idle = [base, shift(base, 0, 1)]
    wk = walk or [base, shift(base, 0, -1), base, shift(base, 0, -1)]
    attack = [shift(base, 0, -1), shift(base, 1, 0), shift(base, 1, 1)]
    dodge = [squash(base, 0.72)]
    guard = [shift(base, 0, 1)]
    hurt = [tint(base, (255, 80, 80), 0.45)]
    bond = [tint(base, (127, 224, 255), 0.25), shift(tint(base, (127, 224, 255), 0.4), 0, -1)]
    return idle + wk + attack + dodge + guard + hurt + bond


rows = [row_frames(f_front), row_frames(f_back), row_frames(f_side, side_walk)]
carbon = Image.new('RGBA', (FW * 14, FH * 3), (0, 0, 0, 0))
for r, frames in enumerate(rows):
    for c, fr in enumerate(frames):
        carbon.alpha_composite(fr, (c * FW, r * FH))
carbon.save(os.path.join(OUT, 'carbon.png'))
manifest['carbon'] = {'file': 'sprites/carbon.png', 'frameWidth': 32, 'frameHeight': 32, 'directions': 4}

# ───────────── element characters (NPC sheets: idle0, idle1, walk0, walk1) ─────────────
chars = {
    'oxy': (1022, 398, 1110, 508),
    'hyde': (1125, 398, 1210, 508),
}
for key, box in chars.items():
    base = fit(cut(box), 32, 32)
    sheet_img = Image.new('RGBA', (128, 32), (0, 0, 0, 0))
    for i, fr in enumerate([base, shift(base, 0, 1), shift(base, 0, -1), base]):
        sheet_img.alpha_composite(fr, (i * 32, 0))
    sheet_img.save(os.path.join(OUT, f'{key}.png'))
    manifest[key] = {'file': f'sprites/{key}.png', 'frameWidth': 32, 'frameHeight': 32}

# ───────────── portraits (192x192) ─────────────
def portrait(box, bg, name, extra_bottom=True):
    im = cut(box)
    canvas = Image.new('RGBA', (192, 192), bg + (255,))
    w, h = im.size
    s = max(176 / w, 176 / h) if w < h * 0.9 else 184 / w
    s = min(s, 192 * 1.15 / h if extra_bottom else 184 / h)
    nw, nh = int(w * s), int(h * s)
    img = im.resize((nw, nh), Image.LANCZOS)
    canvas.alpha_composite(img, ((192 - nw) // 2, 192 - nh if extra_bottom else (192 - nh) // 2))
    canvas.save(os.path.join(OUT, f'{name}.png'))
    manifest[name] = {'file': f'sprites/{name}.png', 'frameWidth': 192, 'frameHeight': 192}


portrait((18, 400, 285, 690), (38, 48, 77), 'pt_carbon_shy')
portrait((60, 400, 285, 640), (38, 48, 77), 'pt_carbon')
portrait((1125, 398, 1210, 470), (31, 58, 90), 'pt_hyde')
portrait((1022, 398, 1110, 470), (74, 31, 46), 'pt_oxy')

# ───────────── crystals (16x16: shine, shine+, empty socket) ─────────────
for key, box in (('crystal_H', (92, 875, 148, 952)), ('crystal_O', (148, 875, 204, 952))):
    c = cut(box)
    base = fit(c, 16, 16, pad=0)
    bright = ImageEnhance.Brightness(base).enhance(1.35)
    empty = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    ped = fit(c.crop((0, int(c.height * 0.72), c.width, c.height)), 16, 16, pad=1)
    empty.alpha_composite(ped)
    out = Image.new('RGBA', (48, 16), (0, 0, 0, 0))
    for i, fr in enumerate((base, bright, empty)):
        out.alpha_composite(fr, (i * 16, 0))
    out.save(os.path.join(OUT, f'{key}.png'))
    manifest[key] = {'file': f'sprites/{key}.png', 'frameWidth': 16, 'frameHeight': 16}

# ───────────── tiles: patch real art into the placeholder tileset (same ids) ─────────────
tiles = Image.open(BASE_TILES).convert('RGBA')
# The ground grid spans x 735-991, y 628-749: four 49px columns plus a 60px water column, rows ~40.7px.
GX, GY, CW, CH = 735, 628, 49, 40.7


def cell(col, row, inset=8):
    if col < 4:
        x0, x1 = GX + col * CW, GX + (col + 1) * CW
    else:
        x0, x1 = 931, 991
    y0, y1 = GY + row * CH, GY + (row + 1) * CH
    return sheet.crop((int(x0 + inset), int(y0 + inset), int(x1 - inset), int(y1 - inset))).resize((16, 16), Image.LANCZOS)


def put(tile_id, img):
    tiles.paste(img, ((tile_id % 16) * 16, (tile_id // 16) * 16))


grass, grass_b, grass2 = cell(0, 0), cell(1, 0), cell(2, 0)
dirt, purple, cobble, gravel = cell(0, 1), cell(1, 1), cell(2, 1), cell(3, 1)
sand, sand2, shallow, stone = cell(0, 2), cell(1, 2), cell(2, 2), cell(3, 2)
rock_cell, water = cell(3, 0), cell(4, 0)
darker = lambda im, k: ImageEnhance.Brightness(im).enhance(k)

T = dict(GRASS=0, GRASS2=1, FLOWERS=2, PATH=3, SAND=4, WATER_EDGE=5, BRIDGE=6, STONE=7, TALL=8, PLATEAU=9, PLATEAU2=10, RUIN_FLOOR=11,
         TREE=16, ROCK=17, CLIFF=18, CLIFF_TOP=19, FENCE=23, BUSH=26, CHASM=28, WATER=30, PINE=31)
put(T['GRASS'], grass)
put(T['GRASS2'], grass2)
put(T['PATH'], dirt)
put(T['SAND'], sand)
put(T['STONE'], cobble)
put(T['PLATEAU'], darker(grass, 0.92))
put(T['PLATEAU2'], darker(grass2, 0.9))
put(T['RUIN_FLOOR'], sand2)
put(T['WATER'], water)
put(T['CLIFF'], rock_cell)
top = rock_cell.copy()
top.paste(grass.crop((0, 0, 16, 6)), (0, 0))
put(T['CLIFF_TOP'], top)
edge = sand.copy()
edge.paste(shallow.crop((0, 0, 16, 7)), (0, 9))
put(T['WATER_EDGE'], edge)
# bridge: planks over water, rotated so the player walks north-south
bridge_src = sheet.crop((935, 670, 995, 715)).resize((16, 16), Image.LANCZOS).rotate(90)
put(T['BRIDGE'], bridge_src)
dark_chasm = darker(purple, 0.25)
put(T['CHASM'], dark_chasm)


def on_ground(sprite_box, ground, fill=1.0):
    g = ground.copy()
    spr = fit(cut(sprite_box), 16, 16, pad=0, max_h=int(16 * fill))
    g.alpha_composite(spr)
    return g


put(T['TREE'], on_ground((1205, 625, 1278, 700), grass))
put(T['PINE'], on_ground((1360, 622, 1412, 702), darker(grass, 0.92)))
put(T['ROCK'], on_ground((1192, 700, 1240, 745), grass, 0.8))
put(T['BUSH'], on_ground((1388, 772, 1455, 828), grass, 0.8))
put(T['FENCE'], on_ground((1405, 708, 1462, 745), grass, 0.85))
put(T['FLOWERS'], on_ground((1415, 640, 1462, 702), grass, 0.75))
tiles.save(os.path.join(OUT, 'tiles.png'))
manifest['tiles'] = {'file': 'sprites/tiles.png', 'frameWidth': 16, 'frameHeight': 16}

# ───────────── buildings drawn over the house footprints (decor images) ─────────────
for key, box in (('house_a', (730, 752, 820, 828)), ('house_b', (935, 752, 1028, 828)), ('house_c', (828, 752, 918, 828)), ('windmill', (1112, 748, 1185, 830))):
    b = cut(box)
    b.save(os.path.join(OUT, f'{key}.png'))
    manifest[key] = {'file': f'sprites/{key}.png', 'type': 'image'}

# ───────────── title key art ─────────────
key_art = sheet.crop((0, 0, 600, 352)).convert('RGB')
key_art.save(os.path.join(OUT, 'keyart.png'))
manifest['keyart'] = {'file': 'sprites/keyart.png', 'type': 'image'}

manifest['_note'] = 'Generated by scripts/extract-sprites.py from art/source/concept-sheet.png. Replace any entry with final pixel art.'
with open(os.path.join(ROOT, 'public/assets/manifest.json'), 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
print('wrote', len([k for k in manifest if not k.startswith('_')]), 'assets')
