"""Carbon — traced from the official design reference onto a strict 32x32 grid.

The reference (art/reference/character-design-reference.png) is opened READ-ONLY as an underdrawing.
Each pose is re-gridded at ONE shared scale, reduced to a fixed palette, re-outlined (1 px),
despeckled and aligned on the foot line — not pasted in as-is.

Outputs (public/assets/sprites/):
  carbon.png         face showing (normal walking)        14 cols x 4 rows
  carbonm.png        mask on (people / enemies nearby)    14 cols x 4 rows
      rows: 0 down, 1 up, 2 right, 3 left (left is its own row so the C on the mask is never mirrored)
      cols: 0-1 idle, 2-5 walk, 6-8 attack, 9 dodge, 10 guard, 11 hurt, 12-13 bond
  carbon_faces.png   9 expressions, 32x32 each (traced from the 表情アイコン row)
  pt_carbon.png / pt_carbon_shy.png   通常 / てれる at x6 (192x192)
Previews: art/sprites-src/carbon_*_preview_x8.png
"""
import json
import os
from collections import deque

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(ROOT, 'art/reference/character-design-reference.png')
OUT = os.path.join(ROOT, 'public/assets/sprites')
PREV = os.path.join(ROOT, 'art/sprites-src')
FW = FH = 32
SCALE = 28 / 53          # one scale for every body frame (待機 row = 53 px tall -> 28 px)
FACE_BG = (38, 48, 77)

with open(REF, 'rb') as fh:
    SRC = Image.open(fh).convert('RGB')  # read-only use

# source boxes (x0, y0, x1, y1) measured on the reference
ROW_IDLE = [(230, 223, 279, 276), (310, 223, 358, 276), (390, 223, 438, 276), (468, 223, 516, 276)]
ROW_WALK = [(226, 280, 270, 329), (280, 280, 323, 329), (332, 280, 375, 329), (386, 280, 429, 329),
            (436, 280, 479, 329), (488, 280, 530, 329)]
ROW_ATK = [(230, 336, 274, 381), (287, 336, 328, 381), (334, 336, 380, 380), (397, 336, 435, 381),
           (442, 337, 484, 381), (492, 336, 535, 380)]
ROW_DODGE = [(229, 390, 271, 431), (280, 390, 327, 431), (333, 390, 381, 431), (391, 390, 432, 431),
             (439, 390, 483, 431), (492, 390, 533, 431)]
ROW_GUARD = [(230, 442, 272, 486), (287, 442, 327, 486), (343, 442, 383, 486), (396, 442, 433, 486),
             (444, 442, 481, 486), (493, 442, 531, 486)]
BACK_FULL = (460, 123, 522, 211)
FACES = [(20, 871, 107, 959), (111, 877, 187, 958), (187, 877, 262, 958), (263, 878, 337, 958),
         (337, 878, 412, 958), (413, 878, 486, 958), (491, 877, 566, 958), (567, 878, 641, 958),
         (643, 860, 721, 958)]
EXPRESSIONS = ['normal', 'smile', 'laugh', 'surprised', 'think', 'troubled', 'shy', 'cry', 'idea']


# ───────────────────────── tracing helpers ─────────────────────────
def isolate(box, keep_largest=True, drop_fx=False):
    c = np.array(SRC.crop(box)).astype(int)
    h, w, _ = c.shape
    bg = np.zeros((h, w), bool)
    q = deque([(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] +
              [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)])
    while q:
        x, y = q.popleft()
        if not (0 <= x < w and 0 <= y < h) or bg[y, x]:
            continue
        p = c[y, x]
        if p.min() > 200 and p.max() - p.min() < 40:
            bg[y, x] = True
            q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    fg = ~bg
    # drop light purple ground shadow
    shadow = (c[..., 2] > c[..., 1] + 15) & (c.min(axis=2) > 150)
    fg &= ~shadow
    if drop_fx:  # orange/red swipe trails and dust next to the body
        r, g, b = c[..., 0], c[..., 1], c[..., 2]
        fg &= ~((r > 190) & (g < 150) & (r - g > 70))
        fg &= ~((abs(r - g) < 25) & (abs(g - b) < 25) & (r < 110) & (r > 40))  # grey dust puffs
    if keep_largest:
        lab = np.zeros((h, w), int)
        best, cur = 0, 0
        sizes = {}
        for sy in range(h):
            for sx in range(w):
                if fg[sy, sx] and not lab[sy, sx]:
                    cur += 1
                    n = 0
                    q = deque([(sx, sy)])
                    lab[sy, sx] = cur
                    while q:
                        x, y = q.popleft()
                        n += 1
                        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                            if 0 <= nx < w and 0 <= ny < h and fg[ny, nx] and not lab[ny, nx]:
                                lab[ny, nx] = cur
                                q.append((nx, ny))
                    sizes[cur] = n
        best = max(sizes, key=sizes.get)
        fg = lab == best
    rgba = np.dstack([c, np.where(fg, 255, 0)]).astype('uint8')
    im = Image.fromarray(rgba, 'RGBA')
    return im.crop(im.getbbox())


def vivid(im):
    from PIL import ImageEnhance
    rgb = ImageEnhance.Color(im.convert('RGB')).enhance(1.2)
    rgb = ImageEnhance.Brightness(rgb).enhance(1.06)
    out = rgb.convert('RGBA')
    out.putalpha(im.getchannel('A'))
    return out


def regrid(im, scale=None, size=None):
    if size is None:
        size = (max(1, round(im.width * scale)), max(1, round(im.height * scale)))
    a = np.array(im).astype(float)
    a[..., :3] *= a[..., 3:] / 255
    pm = np.array(Image.fromarray(a.round().astype('uint8'), 'RGBA').resize(size, Image.BOX)).astype(float)
    al = pm[..., 3]
    rgb = np.where(al[..., None] > 0, pm[..., :3] * 255 / np.maximum(al[..., None], 1), 0)
    return np.dstack([np.clip(rgb, 0, 255), np.where(al > 120, 255, 0)]).astype('uint8')


def build_palette(arrays, n):
    px = np.concatenate([a[a[..., 3] > 0][:, :3] for a in arrays])
    strip = Image.fromarray(px.reshape(1, -1, 3).astype('uint8'), 'RGB')
    q = strip.quantize(colors=n, method=Image.Quantize.MEDIANCUT)
    pal = np.array(q.getpalette()[:n * 3]).reshape(-1, 3)
    return pal


def apply_palette(a, pal, outline):
    out = a.copy()
    m = a[..., 3] > 0
    rgb = a[..., :3].astype(int)[m]
    d = ((rgb[:, None, :] - pal[None, :, :]) ** 2).sum(-1)
    out[..., :3][m] = pal[d.argmin(1)]
    # clean 1 px outline on the silhouette edge
    h, w = m.shape
    edge = np.zeros_like(m)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        sh = np.zeros_like(m)
        ys, yd = slice(max(dy, 0), h + min(dy, 0)), slice(max(-dy, 0), h + min(-dy, 0))
        xs, xd = slice(max(dx, 0), w + min(dx, 0)), slice(max(-dx, 0), w + min(-dx, 0))
        sh[yd, xd] = m[ys, xs]
        edge |= m & ~sh
    out[..., :3][edge] = outline
    return out


def despeckle(a):
    m = a[..., 3] > 0
    h, w = m.shape
    out = a.copy()
    for y in range(h):
        for x in range(w):
            n = sum(1 for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))
                    if 0 <= y + dy < h and 0 <= x + dx < w and m[y + dy, x + dx])
            if m[y, x] and n <= 1:
                out[y, x, 3] = 0
    return out


def place(a, foot_cx=None):
    """Put a traced figure in a 32x32 frame: lowest row on y=31 (sole y=30 + outline), centred on the feet."""
    im = Image.fromarray(a, 'RGBA')
    bb = im.getbbox()
    im = im.crop(bb)
    arr = np.array(im)
    if foot_cx is None:
        rows = arr[-6:, :, 3] > 0
        xs = np.where(rows.any(0))[0]
        foot_cx = (xs.min() + xs.max() + 1) / 2
    fr = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    fr.alpha_composite(im, (int(round(FW / 2 - foot_cx)), FH - im.height))
    return fr


# ───────────────────────── the mask (drawn dot by dot, never mirrored) ─────────────────────────
MASK_PAL = {'K': (43, 29, 34), 'W': (246, 241, 232), 'w': (214, 204, 194), 'C': (46, 40, 52),
            'R': (222, 92, 62), 'E': (70, 44, 46), 'Y': (240, 168, 64)}
C_GLYPH = [".CCC", "C...", "C...", "C...", ".CCC"]          # opening right — always readable
SIX_GLYPH = ["C.", "CC", "CC"]


def mask_image(w, h, facing_left=True):
    """White fox mask, w x h inside the outline, ears on top, C centred, small 6 lower right."""
    W, H = w + 2, h + 2 + 3                       # +outline, +ears
    g = [['.'] * W for _ in range(H)]
    top = 3
    for y in range(top, H):
        for x in range(W):
            inside = 0 < x < W - 1 and top < y < H - 1
            # rounded lower corners / snout
            cut = (y >= H - 3 and (x < 1 + (y - (H - 3)) or x > W - 2 - (y - (H - 3))))
            if inside and not cut:
                g[y][x] = 'W'
    # ears
    for ex in (1, W - 2):
        g[1][ex] = 'W'
        g[2][ex] = 'R'
        g[2][ex + (1 if ex == 1 else -1)] = 'W'
        g[3][ex] = 'W'
        g[3][ex + (1 if ex == 1 else -1)] = 'W'
    # shade on the side away from the light
    for y in range(top + 1, H - 2):
        if g[y][W - 2] == 'W':
            g[y][W - 2] = 'w'
    # C glyph
    cx0 = (W - 4) // 2 - (0 if w >= 9 else 0)
    cy0 = top + 1 + max(0, (h - 9) // 2)
    for yy, row in enumerate(C_GLYPH):
        for xx, ch in enumerate(row):
            if ch == 'C' and g[cy0 + yy][cx0 + xx] in 'Ww':
                g[cy0 + yy][cx0 + xx] = 'C'
    # 6
    sx, sy = cx0 + 5, cy0 + 2
    for yy, row in enumerate(SIX_GLYPH):
        for xx, ch in enumerate(row):
            if ch == 'C' and sx + xx < W - 1 and g[sy + yy][sx + xx] in 'Ww':
                g[sy + yy][sx + xx] = 'C'
    # eye holes and red marks
    ey = min(H - 3, cy0 + 6)
    for ex in (2, W - 4):
        for dx in (0, 1):
            if g[ey][ex + dx] in 'Ww':
                g[ey][ex + dx] = 'E'
    for x, y in ((1, top + 2), (1, top + 3), (W // 2 - 1, H - 2), (W // 2, H - 2)):
        if g[y][x] in 'Ww':
            g[y][x] = 'R'
    # outline around everything
    out = [row[:] for row in g]
    for y in range(H):
        for x in range(W):
            if g[y][x] == '.':
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < W and 0 <= ny < H and g[ny][nx] != '.':
                        out[y][x] = 'K'
                        break
    im = Image.new('RGBA', (W + 2, H + 1), (0, 0, 0, 0))
    for y in range(H):
        for x in range(W):
            if out[y][x] != '.':
                im.putpixel((x + 1, y), MASK_PAL[out[y][x]] + (255,))
    return im


def face_box(fr):
    """Largest skin-coloured blob in the head area."""
    a = np.array(fr).astype(int)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    ys, xs = np.where(al > 0)
    if not len(ys):
        return None
    head_bottom = ys.min() + int((ys.max() - ys.min()) * 0.72)
    skin = (al > 0) & (r > 205) & (g > 140) & (b > 100) & (r - g > 22) & (r - b > 40)
    skin[head_bottom:] = False
    seen = np.zeros_like(skin)
    best = []
    for y0, x0 in zip(*np.where(skin)):
        if seen[y0, x0]:
            continue
        comp, q = [], deque([(x0, y0)])
        seen[y0, x0] = True
        while q:
            x, y = q.popleft()
            comp.append((x, y))
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < FW and 0 <= ny < FH and skin[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((nx, ny))
        if len(comp) > len(best):
            best = comp
    if len(best) < 6:
        return None
    bx = [p[0] for p in best]
    by = [p[1] for p in best]
    return min(bx), min(by), max(bx), max(by)


def put_mask(fr, facing_left, fallback=None, force=False):
    fb = fallback if force else (face_box(fr) or fallback)
    if fb is None:
        return fr, None
    x0, y0, x1, y1 = fb
    w = max(9, min(13, x1 - x0 + 2))
    h = max(9, min(11, y1 - y0 + 1))
    m = mask_image(w, h, facing_left)
    out = fr.copy()
    mx = int(round((x0 + x1 + 1) / 2 - m.width / 2))
    my = y1 + 3 - m.height
    out.alpha_composite(m, (mx, my))
    clip = [(mx + m.width - 1, my + 8), (mx + m.width, my + 9)] if facing_left else [(mx, my + 8), (mx - 1, my + 9)]
    for x, y in clip:
        if 0 <= x < FW and 0 <= y < FH and out.getpixel((x, y))[3]:
            out.putpixel((x, y), MASK_PAL['Y'] + (255,))
    return out, fb


def crisp_mask_glyph(fr, tears=False):
    """Re-draw the C (and 6) on the mask dot by dot so they stay readable at 32 px."""
    a = np.array(fr).astype(int)
    white = (a[..., 3] > 0) & (a[..., :3].min(axis=2) > 200)
    ys, xs = np.where(white)
    if len(xs) < 20:
        return fr
    cx, cy = int(round(xs.mean())), int(round(np.percentile(ys, 35)))
    out = fr.copy()
    ink = MASK_PAL['C'] + (255,)
    # clear old smudged ink inside the glyph box, then draw
    for yy in range(-3, 4):
        for xx in range(-3, 5):
            x, y = cx + xx, cy + yy
            if 0 <= x < FW and 0 <= y < FH and a[y, x, 3] and a[y, x, :3].max() < 150 and white[max(0, y - 2):y + 3, max(0, x - 2):x + 3].sum() > 6:
                out.putpixel((x, y), MASK_PAL['W'] + (255,))
    for yy, row in enumerate(C_GLYPH):
        for xx, ch in enumerate(row):
            if ch == 'C':
                out.putpixel((cx - 2 + xx, cy - 2 + yy), ink)
    for yy, row in enumerate(SIX_GLYPH):
        for xx, ch in enumerate(row):
            x, y = cx + 3 + xx, cy + 1 + yy
            if ch == 'C' and 0 <= x < FW and white[y, x]:
                out.putpixel((x, y), ink)
    if tears:
        for x, y in ((cx - 3, cy + 5), (cx - 3, cy + 6), (cx - 4, cy + 7), (cx + 3, cy + 5), (cx + 3, cy + 6), (cx + 4, cy + 7)):
            if 0 <= x < FW and 0 <= y < FH:
                out.putpixel((x, y), (120, 214, 255, 255))
    return out


# ───────────────────────── back view (sheet has none for the chibi) ─────────────────────────
def back_chibi():
    full = vivid(isolate(BACK_FULL))
    a = np.array(full)
    # split head (hair) and body at the neck
    neck = int(full.height * 0.50)
    head = full.crop((0, 0, full.width, neck))
    body = full.crop((0, neck, full.width, full.height))
    head_g = regrid(head, size=(22, 17))
    body_g = regrid(body, size=(15, 12))
    h = Image.new('RGBA', (24, 29), (0, 0, 0, 0))
    h.alpha_composite(Image.fromarray(body_g, 'RGBA'), ((24 - 15) // 2, 29 - 12))
    h.alpha_composite(Image.fromarray(head_g, 'RGBA'), ((24 - 22) // 2, 0))
    return np.array(h)


def shift_rows(a, y_from, dx=0, dy=0):
    """Move everything from row y_from down by (dx, dy) — used for steps."""
    out = a.copy()
    out[y_from:] = 0
    part = a[y_from:]
    h, w = part.shape[:2]
    for y in range(h):
        for x in range(w):
            if part[y, x, 3]:
                ny, nx = y_from + y + dy, x + dx
                if 0 <= ny < a.shape[0] and 0 <= nx < w:
                    out[ny, nx] = part[y, x]
    return out


# ───────────────────────── build ─────────────────────────
def main():
    # 1. trace all body poses at the shared scale
    rows = {'idle': ROW_IDLE, 'walk': ROW_WALK, 'atk': ROW_ATK, 'dodge': ROW_DODGE, 'guard': ROW_GUARD}
    traced = {k: [regrid(vivid(isolate(b, drop_fx=(k == 'atk'))), SCALE) for b in v] for k, v in rows.items()}
    back = back_chibi()  # (vivid applied inside)
    allarr = [a for v in traced.values() for a in v] + [back]
    pal = build_palette(allarr, 28)
    outline = pal[np.argmin(pal.sum(1))]
    clean = lambda a: despeckle(apply_palette(a, pal, outline))
    traced = {k: [clean(a) for a in v] for k, v in traced.items()}
    back = clean(back)

    # 2. pick frames for each animation (source faces left)
    idle = traced['idle']
    walk = traced['walk']
    atk = traced['atk']
    dodge = traced['dodge']
    guard = traced['guard']
    left_seq = [idle[0], idle[1], walk[0], walk[1], walk[3], walk[4], atk[0], atk[1], atk[2],
                dodge[2], guard[0], dodge[0], idle[2], idle[3]]
    down_seq = [idle[0], idle[1], walk[0], walk[2], walk[3], walk[5], atk[0], atk[1], atk[2],
                dodge[2], guard[0], dodge[0], idle[2], idle[3]]
    left_frames = [place(a) for a in left_seq]
    down_frames = [place(a) for a in down_seq]
    right_frames = [f.transpose(Image.FLIP_LEFT_RIGHT) for f in left_frames]
    bf = place(back)
    ba = np.array(bf)
    def lift(a, left):
        """Raise one foot by 1 px (rows 27+, one half) for the walk cycle seen from behind."""
        out = a.copy()
        half = slice(0, FW // 2) if left else slice(FW // 2, FW)
        seg = a[27:, half].copy()
        out[27:, half] = 0
        out[26:FH - 1, half] = np.where(seg[..., 3:] > 0, seg, out[26:FH - 1, half])
        return out
    bob = lambda d: np.roll(ba, d, axis=0)
    up_frames = [bf, Image.fromarray(np.vstack([np.zeros((1, FW, 4), 'uint8'), ba[:-1]]) if False else ba),
                 lift(ba, True), ba, lift(ba, False), ba,
                 ba, ba, ba, ba, ba, ba, ba, ba]
    up_frames = [f if isinstance(f, Image.Image) else Image.fromarray(f) for f in up_frames]

    # hurt = recoil frame tinted lighter is done in game (tint); bond = sparkle frames
    def sparkle(fr, pts):
        fr = fr.copy()
        for x, y, big in pts:
            for dx, dy in [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)] + ([(2, 0), (-2, 0), (0, 2), (0, -2)] if big else []):
                if 0 <= x + dx < FW and 0 <= y + dy < FH:
                    fr.putpixel((x + dx, y + dy), (220, 248, 255, 255) if (dx, dy) == (0, 0) else (120, 214, 255, 255))
        return fr
    for seq in (down_frames, up_frames, right_frames, left_frames):
        seq[12] = sparkle(seq[12], [(3, 10, False), (28, 9, False)])
        seq[13] = sparkle(seq[13], [(2, 6, True), (29, 5, True), (16, 1, False)])

    def sheet(seqs):
        s = Image.new('RGBA', (FW * 14, FH * 4), (0, 0, 0, 0))
        for r, seq in enumerate(seqs):
            for c, fr in enumerate(seq):
                s.alpha_composite(fr, (c * FW, r * FH))
        return s

    plain = sheet([down_frames, up_frames, right_frames, left_frames])
    # face boxes (x0, y0, x1, y1) on the traced left-facing frames, set by eye on the 32x32 grid
    FACE_LEFT = [(11, 12, 22, 22), (10, 13, 22, 23), (9, 13, 20, 23), (10, 14, 21, 24), (10, 14, 21, 24),
                 (11, 13, 22, 23), (11, 14, 20, 22), (9, 14, 19, 23), (12, 14, 22, 24), (12, 16, 21, 24),
                 (9, 15, 19, 23), (7, 16, 17, 24), (11, 12, 23, 22), (11, 12, 22, 22)]
    FACE_DOWN = list(FACE_LEFT)
    FACE_DOWN[3], FACE_DOWN[5] = (10, 14, 21, 24), (11, 13, 22, 23)   # walk[2], walk[5]
    mirror = lambda b: (FW - 1 - b[2], b[1], FW - 1 - b[0], b[3])

    def mask_row(frames, boxes, left):
        return [put_mask(f, left, b, force=True)[0] for f, b in zip(frames, boxes)]
    masked_down = mask_row(down_frames, FACE_DOWN, True)
    masked_left = mask_row(left_frames, FACE_LEFT, True)
    masked_right = mask_row(right_frames, [mirror(b) for b in FACE_LEFT], False)
    masked_up = []
    for f in up_frames:  # mask strap across the back of the head
        g = f.copy()
        a = np.array(g)
        ys, xs = np.where(a[..., 3] > 0)
        y = ys.min() + 8
        for x in range(xs.min() + 1, xs.max()):
            if a[y, x, 3] and tuple(a[y, x, :3]) != tuple(outline):
                g.putpixel((x, y), (240, 168, 64, 255) if x % 2 else (222, 92, 62, 255))
        masked_up.append(g)
    masked = sheet([masked_down, masked_up, masked_right, masked_left])

    plain.save(os.path.join(OUT, 'carbon.png'))
    masked.save(os.path.join(OUT, 'carbonm.png'))
    for s in (plain, masked):
        for r in range(4):
            for c in range(14):
                fr = s.crop((c * FW, r * FH, (c + 1) * FW, (r + 1) * FH))
                assert fr.getbbox() and fr.getbbox()[3] == FH, ('foot line', r, c)

    # 3. faces
    def face_src(b):
        im = vivid(isolate(b, keep_largest=False))
        if b[1] < 870:                      # ひらめき: keep the bulb, it sits above the head
            pass
        sc = min(31 / im.width, 31 / im.height)
        return regrid(im, sc)
    fsrc = [face_src(b) for b in FACES]
    faces = Image.new('RGBA', (FW * 9, FH), (0, 0, 0, 0))
    for i, a in enumerate(fsrc):
        fpal = build_palette([a], 16)          # own palette per face (the 泣く icon has its own colours)
        fout = fpal[np.argmin(fpal.sum(1))]
        a = despeckle(apply_palette(a, fpal, fout))
        if EXPRESSIONS[i] == 'cry':
            # the sheet's 泣く icon shows Hyde (blue hair) — Carbon's cry = his 困る face + tears
            t = fsrc[EXPRESSIONS.index('troubled')]
            tp = build_palette([t], 16)
            a = despeckle(apply_palette(t, tp, tp[np.argmin(tp.sum(1))]))
        im = Image.fromarray(a, 'RGBA')
        im = im.crop(im.getbbox())
        fr = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
        fr.alpha_composite(im, ((FW - im.width) // 2, FH - im.height))
        fr = crisp_mask_glyph(fr, tears=EXPRESSIONS[i] == 'cry')
        faces.alpha_composite(fr, (i * FW, 0))
    faces.save(os.path.join(OUT, 'carbon_faces.png'))
    for key, e in (('pt_carbon', 'normal'), ('pt_carbon_shy', 'shy')):
        i = EXPRESSIONS.index(e)
        f = Image.new('RGBA', (FW, FH), FACE_BG + (255,))
        f.alpha_composite(faces.crop((i * FW, 0, (i + 1) * FW, FH)))
        f.resize((192, 192), Image.NEAREST).save(os.path.join(OUT, f'{key}.png'))

    # 4. manifest + previews
    mp = os.path.join(ROOT, 'public/assets/manifest.json')
    m = json.load(open(mp, encoding='utf-8'))
    src = 'scripts/trace-carbon.py (traced from the design reference onto a 32x32 grid)'
    m['carbon'] = {'file': 'sprites/carbon.png', 'frameWidth': 32, 'frameHeight': 32, 'directions': 4, 'source': src}
    m['carbonm'] = {'file': 'sprites/carbonm.png', 'frameWidth': 32, 'frameHeight': 32, 'directions': 4, 'source': src}
    m['carbon_faces'] = {'file': 'sprites/carbon_faces.png', 'frameWidth': 32, 'frameHeight': 32,
                         'order': EXPRESSIONS, 'source': src}
    for k in ('pt_carbon', 'pt_carbon_shy'):
        m[k] = {'file': f'sprites/{k}.png', 'frameWidth': 192, 'frameHeight': 192, 'source': src}
    json.dump(m, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    os.makedirs(PREV, exist_ok=True)
    for name, s, bg in (('carbon', plain, (70, 110, 70)), ('carbonm', masked, (70, 110, 70)), ('carbon_faces', faces, FACE_BG)):
        p = Image.new('RGBA', s.size, bg + (255,))
        p.alpha_composite(s)
        p.resize((s.width * 8, s.height * 8), Image.NEAREST).save(os.path.join(PREV, f'{name}_preview_x8.png'))
    print('carbon traced: carbon.png, carbonm.png, carbon_faces.png, pt_carbon*.png')


if __name__ == '__main__':
    main()
