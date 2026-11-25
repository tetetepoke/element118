"""Carbon (主人公) — grid-exact 32x32 pixel art, drawn pixel by pixel in code.

Not cut from any sheet. Follows docs/CHARACTER_DESIGN.md (reference image is only looked at).
Output: public/assets/sprites/carbon.png  (14 cols x 3 rows of 32x32)
        rows: 0 down, 1 up, 2 right (left = mirrored in game)
        cols: 0-1 idle, 2-5 walk, 6-8 attack, 9 dodge, 10 guard, 11 hurt, 12-13 bond
        art/sprites-src/carbon_preview_x8.png  (enlarged check sheet)
Feet: sole on y=30 in every frame (outline on y=31).
"""
import json
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FW = FH = 32
COLS = 14

PAL = {
    'K': (43, 29, 34),     # outline
    'H': (92, 60, 58),     # hair
    'h': (128, 88, 76),    # hair light
    'd': (62, 40, 44),     # hair shade
    'O': (232, 150, 62),   # orange lock / strap
    'W': (246, 241, 232),  # mask
    'w': (214, 204, 194),  # mask shade
    'C': (46, 40, 52),     # C / 6 ink
    'R': (222, 92, 62),    # red-orange marks, scarf
    'E': (70, 44, 46),     # eye holes
    'S': (244, 204, 164),  # skin
    's': (214, 160, 120),  # skin shade
    'M': (240, 222, 172),  # cape
    'm': (204, 176, 120),  # cape shade
    't': (226, 206, 150),  # shirt
    'B': (184, 124, 60),   # bag
    'b': (132, 84, 40),    # bag shade
    'L': (96, 62, 40),     # belt / strap
    'P': (108, 96, 124),   # shorts
    'p': (78, 68, 96),     # shorts shade
    'F': (156, 98, 54),    # boots
    'f': (108, 66, 38),    # boot shade / sole
    'G': (120, 214, 255),  # crystal / sparkle
    'g': (220, 248, 255),  # sparkle light
    'N': (160, 166, 174),  # pot-lid
    'n': (110, 114, 122),  # pot-lid shade
    'I': (220, 224, 230),  # pot-lid highlight
    'k': (72, 76, 84),     # pot-lid knob
    'Y': (240, 168, 64),   # mask clip
}


class Canvas:
    def __init__(self):
        self.c = [[None] * FW for _ in range(FH)]
        self.g = [[None] * FW for _ in range(FH)]

    def px(self, x, y, col, grp=None):
        if 0 <= x < FW and 0 <= y < FH:
            self.c[y][x] = col
            self.g[y][x] = grp

    def span(self, y, l, r, col, grp=None):
        for x in range(l, r + 1):
            self.px(x, y, col, grp)

    def pts(self, pts, col, grp=None):
        for x, y in pts:
            self.px(x, y, col, grp)

    def separate(self, a, b):
        """Dark line between part groups a (kept) and b (edge turned to outline)."""
        hits = []
        for y in range(FH):
            for x in range(FW):
                if self.g[y][x] != b:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < FW and 0 <= ny < FH and self.g[ny][nx] == a:
                        hits.append((x, y))
                        break
        for x, y in hits:
            self.c[y][x] = 'K'

    def outline(self):
        add = []
        for y in range(FH):
            for x in range(FW):
                if self.c[y][x] is not None:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < FW and 0 <= ny < FH and self.c[ny][nx] not in (None, 'G', 'g'):
                        add.append((x, y))
                        break
        for x, y in add:
            self.c[y][x] = 'K'

    def image(self):
        im = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
        for y in range(FH):
            for x in range(FW):
                if self.c[y][x]:
                    im.putpixel((x, y), PAL[self.c[y][x]] + (255,))
        return im


# ───────────────────────── heads ─────────────────────────
def head_down(cv, dx=0, dy=0):
    X = lambda x: x + dx
    Y = lambda y: y + dy
    hair = {4: (13, 18), 5: (10, 21), 6: (9, 22), 7: (8, 23), 8: (7, 24), 9: (7, 24), 10: (7, 24),
            11: (7, 24), 12: (7, 24), 13: (7, 24), 14: (8, 23), 15: (8, 23), 16: (9, 22)}
    for y, (l, r) in hair.items():
        cv.span(Y(y), X(l), X(r), 'H', 'hair')
    # spikes and strands
    cv.pts([(X(x), Y(y)) for x, y in [(15, 3), (16, 3), (16, 2), (17, 1), (9, 4), (22, 4), (6, 8), (25, 8), (5, 10),
                                       (6, 10), (25, 10), (26, 10), (6, 13), (25, 13), (7, 16), (24, 16),
                                       (8, 17), (23, 17)]], 'H', 'hair')
    cv.pts([(X(x), Y(y)) for x, y in [(8, 8), (9, 7), (8, 10), (23, 8), (22, 6), (23, 10), (16, 2)]], 'h', 'hair')
    cv.pts([(X(x), Y(y)) for x, y in [(12, 4), (13, 4), (10, 5), (11, 5), (9, 6)]], 'O', 'hair')  # orange lock
    cv.pts([(X(x), Y(y)) for x, y in [(7, 13), (8, 14), (8, 15), (9, 16), (23, 14), (23, 15), (22, 16),
                                       (24, 12), (26, 10), (8, 17), (23, 17)]], 'd', 'hair')
    # mask (rounded top, tapered snout, cat ears)
    mask = {6: (12, 19), 7: (11, 20), 8: (11, 20), 9: (11, 20), 10: (11, 20), 11: (11, 20), 12: (11, 20),
            13: (11, 20), 14: (11, 20), 15: (12, 19), 16: (13, 18)}
    for y, (l, r) in mask.items():
        cv.span(Y(y), X(l), X(r), 'W', 'mask')
    cv.pts([(X(x), Y(y)) for x, y in [(11, 3), (20, 3), (11, 4), (12, 4), (19, 4), (20, 4), (11, 5), (12, 5),
                                       (13, 5), (18, 5), (19, 5), (20, 5)]], 'W', 'mask')  # ears
    cv.pts([(X(12), Y(5)), (X(19), Y(5)), (X(12), Y(4)), (X(19), Y(4))], 'R', 'mask')
    cv.pts([(X(20), Y(y)) for y in range(8, 15)] + [(X(19), Y(15)), (X(18), Y(16)), (X(17), Y(16))], 'w', 'mask')
    # big C (opening right) and small 6 = atomic number
    cv.pts([(X(x), Y(y)) for x, y in [(14, 7), (15, 7), (16, 7), (17, 7), (13, 8), (14, 8), (13, 9), (13, 10),
                                       (14, 10), (14, 11), (15, 11), (16, 11), (17, 11)]], 'C', 'mask')
    cv.pts([(X(x), Y(y)) for x, y in [(19, 10), (19, 11), (19, 12), (20, 12), (19, 13), (20, 13)]], 'C', 'mask')
    # eye holes, marks
    cv.pts([(X(x), Y(y)) for x, y in [(13, 13), (14, 13), (17, 13), (18, 13)]], 'E', 'mask')
    cv.pts([(X(x), Y(y)) for x, y in [(12, 7), (12, 8), (12, 10), (12, 14), (19, 15), (15, 15), (16, 15)]], 'R', 'mask')
    # clip
    cv.pts([(X(9), Y(11)), (X(10), Y(11)), (X(10), Y(12))], 'Y', 'clip')
    # chin
    cv.span(Y(17), X(13), X(18), 'S', 'skin')
    cv.px(X(18), Y(17), 's', 'skin')


def head_up(cv, dx=0, dy=0):
    X = lambda x: x + dx
    Y = lambda y: y + dy
    hair = {4: (12, 19), 5: (10, 21), 6: (9, 22), 7: (8, 23), 8: (7, 24), 9: (7, 24), 10: (7, 24),
            11: (7, 24), 12: (7, 24), 13: (7, 24), 14: (8, 23), 15: (8, 23), 16: (9, 22), 17: (10, 21)}
    for y, (l, r) in hair.items():
        cv.span(Y(y), X(l), X(r), 'H', 'hair')
    cv.pts([(X(x), Y(y)) for x, y in [(15, 3), (14, 3), (14, 2), (10, 4), (21, 4), (5, 9), (26, 9), (4, 11),
                                       (5, 11), (26, 11), (27, 11), (6, 14), (25, 14), (8, 17), (23, 17),
                                       (12, 18), (15, 18), (19, 18)]], 'H', 'hair')
    cv.pts([(X(x), Y(y)) for x, y in [(11, 6), (13, 5), (16, 5), (10, 8), (20, 6), (22, 8), (14, 2)]], 'h', 'hair')
    cv.pts([(X(x), Y(y)) for x, y in [(18, 4), (19, 4), (20, 5), (21, 5), (22, 6)]], 'O', 'hair')
    cv.pts([(X(x), Y(y)) for x, y in [(9, 14), (12, 15), (14, 16), (17, 15), (20, 16), (22, 14), (11, 17),
                                       (16, 17), (20, 17), (12, 18), (15, 18), (19, 18)]], 'd', 'hair')
    # mask strap across the back of the head
    cv.pts([(X(x), Y(11)) for x in range(8, 24, 2)], 'O', 'strap')
    cv.pts([(X(x), Y(11)) for x in range(9, 24, 2)], 'R', 'strap')
    # mask ear tips peeking over the hair
    cv.pts([(X(11), Y(3)), (X(20), Y(3))], 'W', 'mask')


def head_right(cv, dx=0, dy=0):
    X = lambda x: x + dx
    Y = lambda y: y + dy
    hair = {4: (11, 17), 5: (9, 18), 6: (8, 19), 7: (7, 19), 8: (7, 19), 9: (6, 19), 10: (6, 19), 11: (6, 18),
            12: (7, 18), 13: (7, 17), 14: (8, 17), 15: (8, 16), 16: (9, 15), 17: (10, 14)}
    for y, (l, r) in hair.items():
        cv.span(Y(y), X(l), X(r), 'H', 'hair')
    cv.pts([(X(x), Y(y)) for x, y in [(13, 3), (14, 3), (14, 2), (15, 2), (9, 4), (5, 8), (4, 10), (5, 10),
                                       (4, 13), (5, 13), (6, 13), (6, 15), (7, 15), (7, 17), (8, 18), (11, 18)]],
           'H', 'hair')
    cv.pts([(X(x), Y(y)) for x, y in [(10, 5), (12, 4), (8, 7), (14, 5), (7, 9), (15, 2)]], 'h', 'hair')
    cv.pts([(X(x), Y(y)) for x, y in [(15, 4), (16, 4), (17, 5)]], 'O', 'hair')
    cv.pts([(X(x), Y(y)) for x, y in [(8, 13), (9, 15), (10, 16), (12, 17), (7, 12), (5, 13), (7, 15), (8, 18)]],
           'd', 'hair')
    mask = {6: (15, 20), 7: (15, 21), 8: (15, 21), 9: (15, 21), 10: (15, 21), 11: (15, 21), 12: (15, 21),
            13: (15, 22), 14: (15, 22), 15: (16, 21), 16: (17, 20)}
    for y, (l, r) in mask.items():
        cv.span(Y(y), X(l), X(r), 'W', 'mask')
    cv.pts([(X(17), Y(4)), (X(16), Y(5)), (X(17), Y(5)), (X(18), Y(5))], 'W', 'mask')
    cv.px(X(17), Y(5), 'R', 'mask')
    cv.pts([(X(15), Y(y)) for y in range(7, 15)] + [(X(16), Y(15)), (X(17), Y(16))], 'w', 'mask')
    cv.pts([(X(x), Y(y)) for x, y in [(18, 8), (19, 8), (17, 9), (17, 10), (18, 11), (19, 11), (20, 9)]], 'C', 'mask')
    cv.pts([(X(20), Y(12)), (X(21), Y(12)), (X(20), Y(13))], 'C', 'mask')
    cv.pts([(X(19), Y(14)), (X(20), Y(14))], 'E', 'mask')
    cv.pts([(X(16), Y(13)), (X(21), Y(15)), (X(16), Y(8))], 'R', 'mask')
    cv.pts([(X(13), Y(11)), (X(14), Y(12)), (X(14), Y(11))], 'Y', 'clip')
    cv.span(Y(17), X(16), X(19), 'S', 'skin')
    cv.px(X(16), Y(17), 's', 'skin')


# ───────────────────────── bodies ─────────────────────────
def legs_front(cv, lb=(0, 0), rb=(0, 0), crouch=0):
    """lb/rb = (dx, dy) of left/right foot (viewer side). crouch spreads feet and shortens legs."""
    for (bx, by), x0 in ((lb, 11), (rb, 17)):
        x0 += bx + (-crouch if x0 == 11 else crouch)
        top = 25 + crouch
        for y in range(top, 28):
            cv.span(y + by, x0 + 1, x0 + 2, 'S', 'leg')
        cv.span(28 + by, x0, x0 + 3, 'F', 'boot')
        cv.span(29 + by, x0, x0 + 3, 'F', 'boot')
        cv.px(x0 + 3, 29 + by, 'f', 'boot')
        cv.span(30, x0, x0 + 3, 'f', 'boot') if by == 0 else cv.span(30 + by, x0, x0 + 3, 'f', 'boot')


def torso_front(cv, dx=0, dy=0, back=False):
    X = lambda x: x + dx
    Y = lambda y: y + dy
    # shorts
    cv.span(Y(25), X(11), X(20), 'P', 'shorts')
    cv.span(Y(26), X(11), X(14), 'P', 'shorts')
    cv.span(Y(26), X(17), X(20), 'P', 'shorts')
    cv.pts([(X(14), Y(26)), (X(20), Y(26)), (X(20), Y(25))], 'p', 'shorts')
    # shirt + belt
    cv.span(Y(23), X(11), X(20), 't', 'body')
    cv.span(Y(24), X(11), X(20), 'L', 'belt')
    if not back:
        cv.pts([(X(15), Y(24)), (X(16), Y(24))], 'Y', 'belt')
    # cape
    cape = {17: (12, 19), 18: (10, 21), 19: (9, 22), 20: (9, 22), 21: (8, 23), 22: (8, 23)}
    if back:
        cape.update({23: (8, 23), 24: (9, 22)})
    for y, (l, r) in cape.items():
        cv.span(Y(y), X(l), X(r), 'M', 'cape')
    cv.pts([(X(x), Y(y)) for x, y in [(22, 19), (22, 20), (23, 21), (22, 21), (23, 22), (22, 22), (21, 22), (21, 18)]], 'm', 'cape')
    # tattered hem
    if back:
        for x in (10, 13, 17, 20):
            cv.px(X(x), Y(24), None)
        cv.pts([(X(x), Y(25)) for x in (9, 12, 15, 19, 22)], 'm', 'cape')
        cv.pts([(X(x), Y(y)) for x, y in [(11, 20), (14, 21), (18, 19), (16, 23), (20, 22)]], 'm', 'cape')
    else:
        for x in (10, 14, 19, 22):
            cv.px(X(x), Y(22), 't' if 11 <= x <= 20 else None, 'body')
        cv.pts([(X(8), Y(23)), (X(9), Y(23)), (X(23), Y(23))], 'm', 'cape')
        # scarf / collar and strap across the chest
        cv.span(Y(17), X(13), X(18), 'R', 'scarf')
        cv.pts([(X(x), Y(y)) for x, y in [(19, 18), (18, 19), (17, 20), (16, 21), (15, 22), (14, 23)]], 'L', 'strap')
        cv.pts([(X(11), Y(19)), (X(12), Y(20)), (X(10), Y(21))], 'm', 'cape')  # patch
        # crystal charm
        cv.pts([(X(18), Y(25)), (X(18), Y(26))], 'G', 'charm')
        # bag on the left hip
        cv.span(Y(24), X(7), X(10), 'b', 'bag')
        for y in (25, 26):
            cv.span(Y(y), X(7), X(10), 'B', 'bag')
        cv.span(Y(27), X(7), X(10), 'b', 'bag')
        cv.px(X(9), Y(25), 'Y', 'bag')


def hands_front(cv, l=(9, 23), r=(22, 23), dx=0, dy=0):
    for (x, y) in (l, r):
        if x is None:
            continue
        cv.pts([(x + dx, y + dy), (x + 1 + dx, y + dy)], 'S', 'hand')


def arm_up(cv, sx, sy, hx, hy):
    """Sleeve from shoulder (sx,sy) to hand (hx,hy), hand on top."""
    steps = max(abs(hx - sx), abs(hy - sy))
    for i in range(steps + 1):
        x = round(sx + (hx - sx) * i / max(steps, 1))
        y = round(sy + (hy - sy) * i / max(steps, 1))
        cv.pts([(x, y), (x + 1, y)], 'M', 'sleeve')
    cv.pts([(hx, hy), (hx + 1, hy), (hx, hy - 1), (hx + 1, hy - 1)], 'S', 'hand')


def legs_side(cv, front=0, back=0, lift=0, crouch=0):
    """front/back: x offset of near (front) and far (back) leg. Facing right."""
    for off, col_s, col_b, lft in ((back, 's', 'f', 0), (front, 'S', 'F', lift)):
        x0 = 13 + off
        for y in range(25 + crouch, 28):
            cv.span(y - lft, x0 + 1, x0 + 2, col_s, 'leg')
        cv.span(28 - lft, x0, x0 + 3, col_b, 'boot')
        cv.span(29 - lft, x0, x0 + 4, col_b, 'boot')
        cv.span(30 - lft, x0, x0 + 4, 'f', 'boot')


def torso_side(cv, dx=0, dy=0, arm=None):
    X = lambda x: x + dx
    Y = lambda y: y + dy
    cv.span(Y(25), X(12), X(18), 'P', 'shorts')
    cv.span(Y(26), X(12), X(18), 'P', 'shorts')
    cv.pts([(X(12), Y(26)), (X(13), Y(26))], 'p', 'shorts')
    cv.span(Y(23), X(12), X(18), 't', 'body')
    cv.span(Y(24), X(12), X(18), 'L', 'belt')
    cape = {17: (12, 18), 18: (11, 19), 19: (10, 19), 20: (9, 19), 21: (9, 19), 22: (8, 19)}
    for y, (l, r) in cape.items():
        cv.span(Y(y), X(l), X(r), 'M', 'cape')
    cv.pts([(X(x), Y(y)) for x, y in [(7, 23), (9, 23), (11, 23), (8, 24)]], 'M', 'cape')
    cv.pts([(X(x), Y(y)) for x, y in [(9, 21), (10, 22), (8, 22), (11, 20), (7, 23), (8, 24)]], 'm', 'cape')
    for x in (13, 16):
        cv.px(X(x), Y(22), 't', 'body')
    cv.span(Y(17), X(16), X(18), 'R', 'scarf')
    cv.pts([(X(x), Y(y)) for x, y in [(17, 18), (16, 19), (15, 20), (15, 21)]], 'L', 'strap')
    # bag on near hip
    cv.span(Y(22), X(13), X(16), 'b', 'bag')
    for y in (23, 24):
        cv.span(Y(y), X(13), X(16), 'B', 'bag')
    cv.span(Y(25), X(13), X(16), 'b', 'bag')
    cv.px(X(15), Y(23), 'Y', 'bag')
    if arm is None:
        arm = (18, 22)
    hx, hy = arm
    cv.pts([(hx, hy), (hx + 1, hy), (hx, hy + 1), (hx + 1, hy + 1)], 'S', 'hand')
    cv.px(hx + 1, hy + 1, 's', 'hand')


def lid_front(cv, dy=0):
    rows = {18: (13, 18), 19: (12, 19), 20: (11, 20), 21: (11, 20), 22: (11, 20), 23: (11, 20), 24: (12, 19), 25: (13, 18)}
    for y, (l, r) in rows.items():
        cv.span(y + dy, l, r, 'N', 'lid')
    cv.pts([(13, 18 + dy), (12, 19 + dy), (11, 20 + dy), (11, 21 + dy)], 'I', 'lid')
    cv.pts([(20, 22 + dy), (20, 23 + dy), (19, 24 + dy), (18, 25 + dy), (17, 25 + dy)], 'n', 'lid')
    cv.pts([(15, 21 + dy), (16, 21 + dy), (15, 22 + dy), (16, 22 + dy)], 'k', 'lid')
    cv.pts([(10, 22 + dy), (21, 22 + dy)], 'S', 'hand')


def lid_side(cv, x=20):
    for y in range(19, 25):
        cv.px(x, y, 'n', 'lid')
    for y in range(17, 27):
        cv.px(x + 1, y, 'N', 'lid')
    for y in range(18, 26):
        cv.px(x + 2, y, 'n', 'lid')
    cv.pts([(x + 1, 17), (x + 1, 18)], 'I', 'lid')
    cv.pts([(x + 3, 21), (x + 3, 22)], 'k', 'lid')


def sparkle(cv, x, y, big=False):
    cv.px(x, y, 'g')
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        cv.px(x + dx, y + dy, 'G')
    if big:
        for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)):
            cv.px(x + dx, y + dy, 'G')


def finish(cv):
    cv.separate('mask', 'hair')
    cv.separate('mask', 'strap')
    cv.separate('lid', 'cape')
    cv.separate('bag', 'cape')
    cv.outline()
    return cv.image()


# ───────────────────────── frames ─────────────────────────
def frame_down(kind, i):
    cv = Canvas()
    bob, lb, rb, crouch, hx = 0, (0, 0), (0, 0), 0, 0
    hands = dict(l=(9, 23), r=(21, 23))
    if kind == 'idle':
        bob = i  # breathe
    elif kind == 'walk':
        lb, rb = [((0, -1), (0, 0)), ((0, 0), (0, 0)), ((0, 0), (0, -1)), ((0, 0), (0, 0))][i]
        bob = [0, -1, 0, -1][i]
        hands = [dict(l=(9, 22), r=(21, 24)), dict(l=(9, 23), r=(21, 23)),
                 dict(l=(9, 24), r=(21, 22)), dict(l=(9, 23), r=(21, 23))][i]
    elif kind == 'attack':
        bob = [-1, 1, 0][i]
        rb = [(0, 0), (0, 0), (0, 0)][i]
    elif kind == 'dodge':
        bob, crouch = 3, 1
    elif kind == 'hurt':
        bob, hx = 1, -1
    legs_front(cv, lb, rb, crouch)
    torso_front(cv, hx, bob)
    if kind == 'attack':
        if i == 0:
            arm_up(cv, 21, 19 + bob, 24, 15 + bob)
            hands_front(cv, l=(9, 23), r=(None, 0), dy=bob)
        elif i == 1:
            arm_up(cv, 20, 20 + bob, 18, 27)
            hands_front(cv, l=(9, 22), r=(None, 0), dy=bob)
        else:
            hands_front(cv, l=(9, 23), r=(21, 23), dy=bob)
    elif kind == 'guard':
        pass
    elif kind == 'hurt':
        hands_front(cv, l=(6, 19), r=(24, 19), dy=bob)
    elif kind == 'bond':
        if i == 0:
            arm_up(cv, 9, 19, 6, 15)
            arm_up(cv, 21, 19, 24, 15)
        else:
            arm_up(cv, 9, 19, 5, 12)
            arm_up(cv, 21, 19, 25, 12)
    elif kind == 'dodge':
        hands_front(cv, l=(8, 25), r=(22, 25), dy=0)
    else:
        hands_front(cv, dy=bob, **hands)
    head_down(cv, hx, bob + (1 if kind == 'dodge' else 0))
    if kind == 'guard':
        lid_front(cv)
    if kind == 'bond':
        if i == 0:
            sparkle(cv, 4, 11)
            sparkle(cv, 27, 11)
        else:
            sparkle(cv, 3, 8, True)
            sparkle(cv, 28, 8, True)
            sparkle(cv, 16, 0)
    return finish(cv)


def frame_up(kind, i):
    cv = Canvas()
    bob, lb, rb, crouch, hx = 0, (0, 0), (0, 0), 0, 0
    if kind == 'idle':
        bob = i
    elif kind == 'walk':
        lb, rb = [((0, -1), (0, 0)), ((0, 0), (0, 0)), ((0, 0), (0, -1)), ((0, 0), (0, 0))][i]
        bob = [0, -1, 0, -1][i]
    elif kind == 'attack':
        bob = [-1, 0, 0][i]
    elif kind == 'dodge':
        bob, crouch = 3, 1
    elif kind == 'hurt':
        bob, hx = 1, 1
    legs_front(cv, lb, rb, crouch)
    torso_front(cv, hx, bob, back=True)
    if kind == 'attack':
        if i == 0:
            arm_up(cv, 21, 19 + bob, 23, 15 + bob)
        elif i == 1:
            arm_up(cv, 20, 18, 18, 8)
        hands_front(cv, l=(8, 22), r=(None, 0), dy=bob) if i < 2 else hands_front(cv, l=(8, 22), r=(22, 22), dy=bob)
    elif kind == 'bond':
        a = 15 if i == 0 else 12
        arm_up(cv, 9, 19, 6 if i == 0 else 5, a)
        arm_up(cv, 21, 19, 24 if i == 0 else 25, a)
    elif kind == 'hurt':
        hands_front(cv, l=(6, 19), r=(24, 19), dy=bob)
    elif kind == 'guard':
        hands_front(cv, l=(7, 20), r=(23, 20))
    elif kind == 'dodge':
        hands_front(cv, l=(8, 25), r=(22, 25))
    else:
        sw = [(-1, 1), (0, 0), (1, -1), (0, 0)][i] if kind == 'walk' else (0, 0)
        hands_front(cv, l=(8, 22 + sw[0]), r=(22, 22 + sw[1]), dy=bob)
    head_up(cv, hx, bob + (1 if kind == 'dodge' else 0))
    # raised arms are in front of the hair when seen from behind
    if kind == 'attack' and i == 0:
        arm_up(cv, 21, 19 + bob, 23, 15 + bob)
    elif kind == 'attack' and i == 1:
        arm_up(cv, 21, 15, 22, 7)
    elif kind == 'bond':
        a = 15 if i == 0 else 12
        arm_up(cv, 8, 17, 6 if i == 0 else 5, a)
        arm_up(cv, 22, 17, 24 if i == 0 else 25, a)
    if kind == 'guard':  # lid rim showing on both sides
        cv.pts([(6, y) for y in range(19, 23)] + [(25, y) for y in range(19, 23)], 'N', 'lid')
    if kind == 'bond':
        if i == 0:
            sparkle(cv, 4, 11)
            sparkle(cv, 27, 11)
        else:
            sparkle(cv, 3, 8, True)
            sparkle(cv, 28, 8, True)
            sparkle(cv, 16, 0)
    return finish(cv)


def frame_right(kind, i):
    cv = Canvas()
    bob, hx, legs, arm = 0, 0, dict(front=0, back=0), None
    if kind == 'idle':
        bob = i
    elif kind == 'walk':
        legs = [dict(front=3, back=-3), dict(front=1, back=-1, lift=1), dict(front=-3, back=3), dict(front=-1, back=1, lift=1)][i]
        bob = [0, -1, 0, -1][i]
        arm = [(16, 22), (18, 22), (19, 21), (18, 22)][i]
    elif kind == 'attack':
        bob, hx = [(-1, -1), (0, 2), (0, 1)][i]
        legs = [dict(front=1, back=-2), dict(front=4, back=-3), dict(front=2, back=-2)][i]
        arm = [(10, 18), (23, 19), (20, 21)][i]
    elif kind == 'dodge':
        bob, hx = 3, 2
        legs = dict(front=3, back=-3, crouch=1)
        arm = (21, 24)
    elif kind == 'guard':
        legs = dict(front=1, back=-2)
    elif kind == 'hurt':
        bob, hx = 1, -2
        legs = dict(front=1, back=-2)
        arm = (8, 19)
    elif kind == 'bond':
        arm = (19, 15) if i == 0 else (20, 11)
    legs_side(cv, **legs)
    torso_side(cv, hx // 2, bob, arm=None if kind in ('bond', 'guard') else (arm[0], arm[1] + bob) if arm else (18 + hx // 2, 22 + bob))
    if kind == 'bond':
        arm_up(cv, 17, 19, arm[0], arm[1])
    if kind == 'attack' and i == 1:  # extended arm sleeve
        cv.span(19 + bob, 18 + hx // 2, 22, 'M', 'sleeve')
    head_right(cv, hx, bob + (1 if kind == 'dodge' else 0))
    if kind == 'guard':
        lid_side(cv)
    if kind == 'bond':
        sparkle(cv, arm[0] + 3, arm[1] - 3, i == 1)
        if i == 1:
            sparkle(cv, 26, 18)
            sparkle(cv, 9, 2)
    return finish(cv)


# ───────────────────────── dialogue faces (32x32 bust, shown x6) ─────────────────────────
EXPRESSIONS = ['normal', 'smile', 'laugh', 'surprised', 'think', 'troubled', 'shy', 'cry', 'idea']
FACE_BG = (38, 48, 77)


def bust(cv):
    hair = {2: (13, 18), 3: (10, 21), 4: (7, 24), 5: (5, 26), 6: (4, 27), 7: (4, 27), 8: (4, 27)}
    hair.update({y: (3, 28) for y in range(9, 22)})
    hair.update({22: (4, 27), 23: (5, 26), 24: (6, 25)})
    for y, (l, r) in hair.items():
        cv.span(y, l, r, 'H', 'hair')
    cv.pts([(15, 1), (16, 1), (16, 0), (17, 0), (8, 3), (23, 3), (2, 9), (1, 10), (2, 10), (1, 14), (2, 14),
            (2, 15), (29, 9), (29, 10), (30, 10), (29, 14), (30, 14), (29, 15), (2, 19), (29, 19), (3, 22),
            (28, 22), (4, 24), (27, 24), (5, 25), (26, 25)], 'H', 'hair')
    cv.pts([(11, 3), (12, 3), (13, 2), (7, 5), (8, 4), (6, 6)], 'O', 'hair')  # orange lock
    cv.pts([(5, 8), (6, 7), (4, 11), (25, 6), (26, 8), (27, 11), (16, 0)], 'h', 'hair')
    cv.pts([(4, 18), (4, 19), (5, 21), (6, 23), (27, 18), (27, 19), (26, 21), (25, 23), (3, 21), (28, 21),
            (5, 25), (26, 25), (29, 14), (2, 14)], 'd', 'hair')
    # cape + scarf
    cape = {25: (11, 20), 26: (7, 24), 27: (5, 26), 28: (3, 28), 29: (3, 28), 30: (2, 29), 31: (2, 29)}
    for y, (l, r) in cape.items():
        cv.span(y, l, r, 'M', 'cape')
    cv.span(25, 12, 19, 'R', 'scarf')
    cv.span(26, 13, 18, 'R', 'scarf')
    cv.pts([(22, 27), (21, 28), (20, 29), (19, 30), (18, 31)], 'L', 'strap')
    cv.pts([(25, 28), (26, 29), (27, 30), (24, 30), (28, 31), (25, 31), (5, 29), (8, 30), (4, 31)], 'm', 'cape')
    # chin
    cv.span(23, 12, 19, 'S', 'skin')
    cv.span(24, 13, 18, 'S', 'skin')
    cv.pts([(19, 23), (18, 24)], 's', 'skin')
    # mask
    mask = {7: (10, 21), 8: (9, 22)}
    mask.update({y: (8, 23) for y in range(9, 20)})
    mask.update({20: (9, 22), 21: (10, 21), 22: (12, 19)})
    for y, (l, r) in mask.items():
        cv.span(y, l, r, 'W', 'mask')
    cv.pts([(8, 3), (23, 3), (8, 4), (9, 4), (22, 4), (23, 4), (8, 5), (9, 5), (10, 5), (21, 5), (22, 5), (23, 5),
            (8, 6), (9, 6), (10, 6), (11, 6), (20, 6), (21, 6), (22, 6), (23, 6)], 'W', 'mask')
    cv.pts([(9, 4), (22, 4), (9, 5), (22, 5), (10, 6), (21, 6)], 'R', 'mask')
    cv.pts([(23, y) for y in range(9, 20)] + [(22, 20), (21, 21), (19, 22), (18, 22)], 'w', 'mask')
    # C (thick, opening right) and 6
    cv.pts([(x, 9) for x in range(13, 18)] + [(x, 10) for x in range(12, 18)] + [(11, 11), (12, 11), (13, 11),
            (11, 12), (12, 12), (11, 13), (12, 13), (13, 13)] + [(x, 14) for x in range(12, 18)] +
           [(x, 15) for x in range(13, 18)], 'C', 'mask')
    cv.pts([(21, 13), (22, 13), (20, 14), (20, 15), (21, 15), (22, 15), (20, 16), (22, 16), (21, 17)], 'C', 'mask')
    # marks + mouth slit
    cv.pts([(9, 9), (9, 10), (10, 8), (21, 10), (15, 21), (16, 21)], 'R', 'mask')
    # clip
    cv.pts([(5, 14), (6, 14), (6, 15), (7, 15)], 'Y', 'clip')
    # eye holes
    for x0 in (10, 17):
        cv.span(18, x0, x0 + 2, 'E', 'mask')
        cv.span(19, x0, x0 + 2, 'E', 'mask')


def express(cv, e):
    L, R_ = 10, 17   # eye-hole left x
    def eyes(pts, col='K'):
        for x0 in (L, R_):
            cv.pts([(x0 + dx, y) for dx, y in pts], col, 'mask')
    if e in ('normal', 'smile', 'troubled', 'cry'):
        eyes([(1, 18)], 'g'); eyes([(1, 19)])
    if e == 'smile':
        cv.pts([(14, 23), (15, 24), (16, 24), (17, 23)], 'E', 'skin')
    if e == 'laugh':
        eyes([(0, 19), (1, 18), (2, 19)])
        cv.pts([(15, 23), (16, 23)], 'E', 'skin'); cv.pts([(15, 24), (16, 24)], 'R', 'skin')
    if e == 'surprised':
        eyes([(1, 19)], 'g')
        cv.pts([(15, 23), (16, 23), (15, 24), (16, 24)], 'E', 'skin')
        cv.pts([(27, 2), (28, 1), (29, 4), (30, 3), (30, 6)], 'g')
    if e == 'think':
        eyes([(2, 18)], 'K')
        cv.pts([(15, 23), (16, 23)], 'E', 'skin')
        cv.pts([(26, 4), (28, 2), (30, 0)], 'g')
    if e == 'troubled':
        cv.pts([(10, 17), (11, 16), (12, 16), (19, 17), (18, 16), (17, 16)], 'C', 'mask')
        cv.pts([(14, 24), (15, 23), (16, 24), (17, 23)], 'E', 'skin')
        cv.pts([(26, 9), (26, 10), (25, 11), (26, 11)], 'G')
    if e == 'shy':
        eyes([(0, 19)])
        cv.pts([(9, 20), (11, 20), (10, 21), (20, 20), (22, 20), (21, 21)], 'R', 'mask')
        cv.pts([(12, 23), (19, 23)], 'R', 'skin')
        cv.pts([(15, 24), (16, 24)], 'E', 'skin')
        cv.pts([(27, 3), (28, 4), (29, 2), (30, 3)], 'R')
    if e == 'cry':
        cv.pts([(11, 20), (11, 21), (12, 22), (18, 20), (18, 21), (17, 22)], 'G', 'mask')
        cv.pts([(14, 24), (15, 23), (16, 24), (17, 23)], 'E', 'skin')
    if e == 'idea':
        eyes([(1, 18), (1, 19)], 'g')
        cv.pts([(14, 23), (15, 24), (16, 24), (17, 23)], 'E', 'skin')
        cv.pts([(27, 1), (28, 1), (26, 2), (27, 2), (28, 2), (29, 2), (27, 3), (28, 3)], 'Y')
        cv.pts([(27, 4), (28, 4)], 'n')
        cv.pts([(25, 0), (30, 0), (24, 3), (31, 3)], 'g')


def faces():
    out = Image.new('RGBA', (FW * len(EXPRESSIONS), FH), (0, 0, 0, 0))
    for i, e in enumerate(EXPRESSIONS):
        cv = Canvas()
        bust(cv)
        express(cv, e)
        cv.separate('mask', 'hair')
        cv.separate('scarf', 'cape')
        cv.outline()
        out.alpha_composite(cv.image(), (i * FW, 0))
    return out


def save_faces(manifest):
    sheet = faces()
    sheet.save(os.path.join(ROOT, 'public/assets/sprites/carbon_faces.png'))
    manifest['carbon_faces'] = {'file': 'sprites/carbon_faces.png', 'frameWidth': 32, 'frameHeight': 32,
                                'source': 'scripts/draw-carbon.py', 'order': EXPRESSIONS}
    for key, e in (('pt_carbon', 'normal'), ('pt_carbon_shy', 'shy')):
        i = EXPRESSIONS.index(e)
        face = Image.new('RGBA', (FW, FH), FACE_BG + (255,))
        face.alpha_composite(sheet.crop((i * FW, 0, (i + 1) * FW, FH)))
        face.resize((192, 192), Image.NEAREST).save(os.path.join(ROOT, f'public/assets/sprites/{key}.png'))
        manifest[key] = {'file': f'sprites/{key}.png', 'frameWidth': 192, 'frameHeight': 192,
                         'source': 'scripts/draw-carbon.py (carbon_faces x6)'}
    prev = Image.new('RGBA', sheet.size, FACE_BG + (255,))
    prev.alpha_composite(sheet)
    prev.resize((sheet.width * 8, sheet.height * 8), Image.NEAREST).save(
        os.path.join(ROOT, 'art/sprites-src/carbon_faces_preview_x8.png'))


SEQ = [('idle', 0), ('idle', 1), ('walk', 0), ('walk', 1), ('walk', 2), ('walk', 3), ('attack', 0), ('attack', 1),
       ('attack', 2), ('dodge', 0), ('guard', 0), ('hurt', 0), ('bond', 0), ('bond', 1)]


def main():
    sheet = Image.new('RGBA', (FW * COLS, FH * 3), (0, 0, 0, 0))
    for r, fn in enumerate((frame_down, frame_up, frame_right)):
        for c, (kind, i) in enumerate(SEQ):
            fr = fn(kind, i)
            # grid check: sole on y=30, nothing outside 32x32
            assert any(fr.getpixel((x, 30))[3] for x in range(FW)), (r, c, 'no sole on y=30')
            sheet.alpha_composite(fr, (c * FW, r * FH))
    out = os.path.join(ROOT, 'public/assets/sprites/carbon.png')
    sheet.save(out)
    prev = Image.new('RGBA', sheet.size, (70, 110, 70, 255))
    prev.alpha_composite(sheet)
    prev = prev.resize((sheet.width * 8, sheet.height * 8), Image.NEAREST)
    os.makedirs(os.path.join(ROOT, 'art/sprites-src'), exist_ok=True)
    prev.save(os.path.join(ROOT, 'art/sprites-src/carbon_preview_x8.png'))
    mp = os.path.join(ROOT, 'public/assets/manifest.json')
    m = json.load(open(mp))
    m['carbon'] = {'file': 'sprites/carbon.png', 'frameWidth': 32, 'frameHeight': 32, 'directions': 4,
                   'source': 'scripts/draw-carbon.py (redrawn, grid-exact)'}
    save_faces(m)
    json.dump(m, open(mp, 'w'), ensure_ascii=False, indent=2)
    print('carbon.png written')


if __name__ == '__main__':
    main()
