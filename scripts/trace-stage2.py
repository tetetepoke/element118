"""Stage 2 sprites traced from art/reference/stage2-design-reference.png (opened read-only).

Same method as trace-carbon.py: one shared scale per character, fixed palette, clean 1 px outline,
despeckle, feet on the foot line. Outputs into public/assets/sprites/ and updates the manifest.
  silica.png  (14 cols x 4 rows, Carbon's layout)   sic.png (SiC FORM, same layout)
  pt_silica.png (192 = 32 x 6)
  cslime.png golem.png beetle.png drill.png (32x32 x 4: move, move, hit, stun)
  boss_cb.png (96x96 x 4: shell, shell step, core exposed, stopped)
Usage: python3 scripts/trace-stage2.py           (writes files)
       python3 scripts/trace-stage2.py --boxes   (prints detected boxes for tuning)
"""
import importlib.util
import json
import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(ROOT, 'art/reference/stage2-design-reference.png')
OUT = os.path.join(ROOT, 'public/assets/sprites')
PREV = os.path.join(ROOT, 'art/sprites-src')
FW = FH = 32

spec = importlib.util.spec_from_file_location('tc', os.path.join(ROOT, 'scripts/trace-carbon.py'))
tc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tc)   # helpers only (regrid, palette, outline, despeckle, place)

with open(REF, 'rb') as fh:
    SRC = np.array(Image.open(fh).convert('RGB')).astype(int)


def isolate(box, dark=False, keep_largest=True):
    x0, y0, x1, y1 = box
    c = SRC[y0:y1, x0:x1]
    h, w, _ = c.shape
    if dark:
        ref = c[0, 0]
        is_bg = lambda p: np.abs(p - ref).sum() < 70 and p.max() < 90
    else:
        is_bg = lambda p: p.min() > 200 and p.max() - p.min() < 40
    bg = np.zeros((h, w), bool)
    q = deque([(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)])
    while q:
        x, y = q.popleft()
        if not (0 <= x < w and 0 <= y < h) or bg[y, x]:
            continue
        if is_bg(c[y, x]):
            bg[y, x] = True
            q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    fg = ~bg
    shadow = (c[..., 2] > c[..., 1] + 15) & (c.min(axis=2) > 150)
    fg &= ~shadow
    if keep_largest:
        lab = np.zeros((h, w), int)
        sizes, cur = {}, 0
        for sy in range(h):
            for sx in range(w):
                if fg[sy, sx] and not lab[sy, sx]:
                    cur += 1
                    n, qq = 0, deque([(sx, sy)])
                    lab[sy, sx] = cur
                    while qq:
                        x, y = qq.popleft()
                        n += 1
                        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                            if 0 <= nx < w and 0 <= ny < h and fg[ny, nx] and not lab[ny, nx]:
                                lab[ny, nx] = cur
                                qq.append((nx, ny))
                    sizes[cur] = n
        if sizes:
            fg = lab == max(sizes, key=sizes.get)
    im = Image.fromarray(np.dstack([c, np.where(fg, 255, 0)]).astype('uint8'), 'RGBA')
    bb = im.getbbox()
    return tc.vivid(im.crop(bb)) if bb else im


def boxes(region, dark=False, min_px=150):
    x0, y0, x1, y1 = region
    c = SRC[y0:y1, x0:x1]
    if dark:
        ref = c[0, 0]
        fg = (np.abs(c - ref).sum(axis=2) >= 70) | (c.max(axis=2) >= 90)
    else:
        fg = ~((c.min(axis=2) > 200) & (c.max(axis=2) - c.min(axis=2) < 40))
    from scipy import ndimage
    lab, n = ndimage.label(fg)
    out = []
    for i, s in enumerate(ndimage.find_objects(lab)):
        if (lab[s] == i + 1).sum() >= min_px:
            out.append((s[1].start + x0, s[0].start + y0, s[1].stop + x0, s[0].stop + y0))
    return sorted(out, key=lambda b: (round(b[1] / 12), b[0]))


def clean(arrs, ncol):
    pal = tc.build_palette(arrs, ncol)
    outline = pal[np.argmin(pal.sum(1))]
    return [tc.despeckle(tc.apply_palette(a, pal, outline)) for a in arrs]


def sheet14(rows):
    s = Image.new('RGBA', (FW * 14, FH * len(rows)), (0, 0, 0, 0))
    for r, seq in enumerate(rows):
        for c, fr in enumerate(seq):
            s.alpha_composite(fr, (c * FW, r * FH))
    return s


def sparkle(fr, pts):
    fr = fr.copy()
    for x, y, big in pts:
        for dx, dy in [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)] + ([(2, 0), (-2, 0), (0, 2), (0, -2)] if big else []):
            if 0 <= x + dx < FW and 0 <= y + dy < FH:
                fr.putpixel((x + dx, y + dy), (220, 248, 255, 255) if (dx, dy) == (0, 0) else (120, 214, 255, 255))
    return fr


def flip(fr):
    return fr.transpose(Image.FLIP_LEFT_RIGHT)


# ───────────────────────── Silica ─────────────────────────
SIL_ROWS = {   # (y0, y1) of each row in the Silica panel; columns at these x ranges
    'top': (96, 147), 'idle': (151, 191), 'walk': (191, 232), 'atk': (236, 271), 'dmg': (272, 306), 'face': (307, 343),
}
SIL_COLS = [(1013, 1052), (1051, 1089), (1088, 1126), (1125, 1163), (1162, 1202)]


def silica():
    scale = 27 / 40
    grid = {r: [isolate((x0, y0, x1, y1)) for (x0, x1) in SIL_COLS] for r, (y0, y1) in SIL_ROWS.items()}
    flat = [im for row in grid.values() for im in row]
    arrs = clean([tc.regrid(im, scale) for im in flat], 24)
    k = 0
    g = {}
    for r in SIL_ROWS:
        g[r] = [tc.place(arrs[k + i]) for i in range(5)]
        k += 5
    i, w, a, d = g['idle'], g['walk'], g['atk'], g['dmg']
    down = [i[0], i[1], w[0], w[1], w[2], w[1], a[0], a[1], a[2], a[3], i[3], d[0], i[0], i[1]]
    up = [i[4], i[4], w[4], i[4], flip(w[4]), i[4], w[4], w[4], w[4], w[4], i[4], i[4], i[4], i[4]]
    right = [i[2], i[2], w[2], w[1], w[2], w[1], a[1], a[2], a[3], a[4], i[3], d[1], i[2], i[2]]
    left = [flip(f) for f in right]
    for seq in (down, up, right, left):
        seq[12] = sparkle(seq[12], [(3, 10, False), (28, 9, False)])
        seq[13] = sparkle(seq[13], [(2, 6, True), (29, 5, True), (16, 1, False)])
    s = sheet14([down, up, right, left])
    s.save(os.path.join(OUT, 'silica.png'))
    # face: the first expression icon (32 px, shown x6)
    fa = clean([tc.regrid(isolate((1013, 307, 1052, 343)), 31 / 40)], 16)[0]
    face = Image.new('RGBA', (FW, FH), (42, 47, 74, 255))
    im = Image.fromarray(fa, 'RGBA')
    im = im.crop(im.getbbox())
    face.alpha_composite(im, ((FW - im.width) // 2, FH - im.height))
    face.resize((192, 192), Image.NEAREST).save(os.path.join(OUT, 'pt_silica.png'))
    return s


# ───────────────────────── SiC FORM (dark panel) ─────────────────────────
def sic():
    # small frames: 2 columns (front, back) x 4 rows in the SiC column of the フォーム panel
    found = [b for b in boxes((1302, 192, 1380, 345), dark=True) if 20 < (b[3] - b[1]) < 60 and (b[2] - b[0]) > 15]
    found = sorted(found, key=lambda b: (b[1] // 20, b[0]))
    if '--boxes' in sys.argv:
        print('SiC', found)
    fronts = [b for b in found if b[0] < 1340]
    backs = [b for b in found if b[0] >= 1340]
    ims = [isolate(b, dark=True) for b in fronts + backs]
    scale = 28 / max(im.height for im in ims)
    arrs = clean([tc.regrid(im, scale) for im in ims], 24)
    fr = [tc.place(a) for a in arrs]
    F, B = fr[:len(fronts)], fr[len(fronts):]
    F = (F * 4)[:4]
    B = (B * 4)[:4]
    down = [F[0], F[0], F[1], F[0], F[2], F[0], F[3], F[1], F[0], F[2], F[0], F[3], F[0], F[0]]
    up = [B[0], B[0], B[1], B[0], B[2], B[0], B[3], B[1], B[0], B[2], B[0], B[3], B[0], B[0]]
    # the C / 6 mask must stay readable: stamp the dot-drawn mask on the forehead (front views)
    MINI = [".K.....K.", "KRK...KRK", "KWWKKKWWK", "KWWCCCWWK", "KWCWWWWCK", "KWWCCCWCK", ".KWWWWWK.", "..KKKKK.."]   # mask pushed up, C and a tiny 6
    mini = Image.new('RGBA', (9, 8), (0, 0, 0, 0))
    for yy, row in enumerate(MINI):
        for xx, ch in enumerate(row):
            if ch != '.':
                mini.putpixel((xx, yy), tc.MASK_PAL[ch] + (255,))
    def masked(f):
        f = f.copy()
        bb = f.getbbox()
        cx = (bb[0] + bb[2]) // 2
        f.alpha_composite(mini, (cx - 4, max(0, bb[1])))
        return f
    down = [masked(f) for f in down]
    right = list(down)
    left = [flip(f) for f in right]
    # flipping would mirror the C: redraw the mask on the flipped frames
    left = [masked(flip(f)) for f in [x for x in [F[0], F[0], F[1], F[0], F[2], F[0], F[3], F[1], F[0], F[2], F[0], F[3], F[0], F[0]]]]
    for seq in (down, up, right, left):
        seq[12] = sparkle(seq[12], [(3, 10, False), (28, 9, False)])
        seq[13] = sparkle(seq[13], [(2, 6, True), (29, 5, True), (16, 1, False)])
    s = sheet14([down, up, right, left])
    s.save(os.path.join(OUT, 'sic.png'))
    return s


# ───────────────────────── enemies ─────────────────────────
ENEMIES = {   # key: (big-art box, small-frame region)
    'cslime': ((620, 660, 720, 735), (610, 740, 720, 805)),
    'golem': ((730, 650, 850, 735), (730, 740, 850, 805)),
    'beetle': ((860, 650, 970, 735), (860, 740, 970, 805)),
    'drill': ((975, 655, 1085, 735), (975, 740, 1085, 805)),
}


def enemy(key):
    big, small = ENEMIES[key]
    fr = [b for b in boxes(small) if (b[3] - b[1]) > 10]
    if '--boxes' in sys.argv:
        print(key, fr)
    ims = [isolate(b) for b in fr[:2]] or [isolate(big)]
    if len(ims) < 2:
        ims = ims * 2
    target = 24 if key in ('golem', 'drill') else 20
    sc = min(target / max(im.height for im in ims), 28 / max(im.width for im in ims))
    arrs = clean([tc.regrid(im, sc) for im in ims], 16)
    frames = [tc.place(a) for a in arrs]
    hit = frames[0].copy()
    px = hit.load()
    for y in range(FH):
        for x in range(FW):
            if px[x, y][3]:
                px[x, y] = (255, 255, 255, 255)
    stun = frames[0].rotate(0).copy()
    out = Image.new('RGBA', (FW * 4, FH), (0, 0, 0, 0))
    for i, f in enumerate([frames[0], frames[1], hit, stun]):
        out.alpha_composite(f, (i * FW, 0))
    out.save(os.path.join(OUT, f'{key}.png'))
    return out


def boss():
    b = [x for x in boxes((1090, 640, 1272, 750)) if (x[3] - x[1]) > 40]
    if '--boxes' in sys.argv:
        print('boss', b)
    im = isolate(max(b, key=lambda x: (x[2] - x[0]) * (x[3] - x[1])))
    sc = min(90 / im.width, 88 / im.height)
    a = clean([tc.regrid(im, sc)], 28)[0]
    base = Image.fromarray(a, 'RGBA')
    base = base.crop(base.getbbox())
    def frame(img, dy=0):
        f = Image.new('RGBA', (96, 96), (0, 0, 0, 0))
        f.alpha_composite(img, ((96 - img.width) // 2, 96 - img.height - 2 + dy))
        return f
    f0 = frame(base)
    f1 = frame(base, -1)
    # core exposed: darken the shell, glowing core in the chest
    core = np.array(f0).astype(int)
    m = core[..., 3] > 0
    bright = core[..., :3].mean(axis=2) > 150
    core[..., :3][m & bright] = (core[..., :3][m & bright] * 0.45).astype(int)
    f2 = Image.fromarray(core.astype('uint8'), 'RGBA')
    from PIL import ImageDraw
    d = ImageDraw.Draw(f2)
    bb = f0.getbbox()
    cx, cy = (bb[0] + bb[2]) // 2, bb[1] + int((bb[3] - bb[1]) * 0.45)
    d.rectangle((cx - 11, cy - 9, cx + 11, cy + 9), fill=(46, 42, 40, 255))
    d.rectangle((cx - 9, cy - 7, cx + 9, cy + 7), fill=(255, 122, 42, 255))
    d.rectangle((cx - 4, cy - 3, cx + 4, cy + 3), fill=(255, 211, 106, 255))
    f3 = ImageEnhance.Color(f0).enhance(0.2)
    f3 = ImageEnhance.Brightness(f3).enhance(0.7)
    out = Image.new('RGBA', (96 * 4, 96), (0, 0, 0, 0))
    for i, f in enumerate([f0, f1, f2, f3]):
        out.alpha_composite(f, (i * 96, 0))
    out.save(os.path.join(OUT, 'boss_cb.png'))
    return out


def main():
    src = 'scripts/trace-stage2.py (traced from the stage 2 design reference onto the grid)'
    made = {}
    made['silica'] = silica()
    made['sic'] = sic()
    for k in ENEMIES:
        made[k] = enemy(k)
    made['boss_cb'] = boss()
    if '--boxes' in sys.argv:
        return
    mp = os.path.join(ROOT, 'public/assets/manifest.json')
    m = json.load(open(mp, encoding='utf-8'))
    for k in ('silica', 'sic'):
        m[k] = {'file': f'sprites/{k}.png', 'frameWidth': 32, 'frameHeight': 32, 'directions': 4, 'source': src}
    m['pt_silica'] = {'file': 'sprites/pt_silica.png', 'frameWidth': 192, 'frameHeight': 192, 'source': src}
    for k in ENEMIES:
        m[k] = {'file': f'sprites/{k}.png', 'frameWidth': 32, 'frameHeight': 32, 'source': src}
    m['boss_cb'] = {'file': 'sprites/boss_cb.png', 'frameWidth': 96, 'frameHeight': 96, 'source': src}
    json.dump(m, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    os.makedirs(PREV, exist_ok=True)
    for k, s in made.items():
        p = Image.new('RGBA', s.size, (70, 90, 80, 255))
        p.alpha_composite(s)
        p.resize((s.width * 6, s.height * 6), Image.NEAREST).save(os.path.join(PREV, f'{k}_preview_x6.png'))
    print('stage 2 sprites traced:', ', '.join(made))


if __name__ == '__main__':
    main()
