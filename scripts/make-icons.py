"""Home-screen / PWA icons: Carbon's masked bust from art/source/character-sheet.png.

Outputs public/icons/apple-touch-icon.png (180), icon-192.png, icon-512.png.
iOS rounds the corners itself, so the icons are full-bleed squares.
"""
import os
from collections import deque
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art/source/character-sheet.png')
OUT = os.path.join(ROOT, 'public/icons')

sheet = Image.open(SRC).convert('RGBA')
bust = sheet.crop((14, 122, 162, 252))  # large masked portrait in the カーボン panel

# remove the light panel background by flood fill from the edges
px = bust.load()
w, h = bust.size
def bg(p):
    r, g, b, a = p
    return r > 225 and g > 220 and b > 210 and max(r, g, b) - min(r, g, b) < 28
seen = set()
q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
while q:
    x, y = q.popleft()
    if (x, y) in seen or not (0 <= x < w and 0 <= y < h):
        continue
    seen.add((x, y))
    if not bg(px[x, y]):
        continue
    px[x, y] = (0, 0, 0, 0)
    q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
bust = bust.crop(bust.getbbox())


def icon(size):
    img = Image.new('RGBA', (size, size), (20, 24, 42, 255))  # theme #14182a
    # soft glow behind the head (carbon = warm amber)
    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    r = int(size * 0.40)
    d.ellipse((size // 2 - r, int(size * 0.47) - r, size // 2 + r, int(size * 0.47) + r), fill=(240, 170, 80, 110))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(size * 0.08)))
    # character, bottom-anchored so the scarf runs off the bottom edge
    target_w = int(size * 0.92)
    s = target_w / bust.width
    ch = bust.resize((target_w, int(bust.height * s)), Image.LANCZOS)
    img.alpha_composite(ch, ((size - ch.width) // 2, size - ch.height + int(size * 0.02)))
    return img.convert('RGB')


os.makedirs(OUT, exist_ok=True)
icon(180).save(os.path.join(OUT, 'apple-touch-icon.png'))
icon(192).save(os.path.join(OUT, 'icon-192.png'))
icon(512).save(os.path.join(OUT, 'icon-512.png'))
print('icons written')
