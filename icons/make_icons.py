"""Exsy logo – "Spend ring": a bold ₹ inside a donut chart (white, mint and gold segments) on a green squircle.
Stands for tracking where the money goes. `python icons/make_icons.py` rewrites the PWA icons next to this file;
set PREVIEW=1 to also save logo_preview.png. Needs Pillow and the Segoe UI Bold font (Windows)."""
import math, os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.dirname(os.path.abspath(__file__))
FONT = r'C:\Windows\Fonts\segoeuib.ttf'
G1, G2 = (0, 168, 120), (0, 92, 75)                 # gradient, top-left → bottom-right
SEGMENTS = (((-90, 140), (255, 255, 255)), ((152, 222), (163, 255, 214)), ((234, 258), (255, 214, 102)))


def gradient(S):
    g = Image.new('RGB', (S, S)); px = g.load()
    for y in range(S):
        for x in range(S):
            t = (x + y) / (2 * S - 2)
            px[x, y] = tuple(round(p + (q - p) * t) for p, q in zip(G1, G2))
    return g.convert('RGBA')


def icon(size, maskable=False):
    S = size * 4
    im = gradient(S)
    if not maskable:                               # maskable icons stay full-bleed; Android crops them itself
        m = Image.new('L', (S, S), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, S - 1, S - 1], int(S * 0.235), fill=255)
        im.putalpha(m)
    d = ImageDraw.Draw(im)
    k = 0.8 if maskable else 1.0                   # keep the mark inside the maskable safe zone
    cx = cy = S / 2
    R, w = S * 0.30 * k, S * 0.085 * k
    box = [cx - R, cy - R, cx + R, cy + R]
    for (a, b), col in SEGMENTS:
        d.arc(box, a, b, fill=col, width=int(w))
    f = ImageFont.truetype(FONT, int(S * 0.30 * k))
    bb = d.textbbox((0, 0), '\u20b9', font=f)
    d.text((cx - (bb[0] + bb[2]) / 2, cy + S * 0.01 * k - (bb[1] + bb[3]) / 2), '\u20b9', font=f, fill=(255, 255, 255))
    return im.resize((size, size), Image.LANCZOS)


if __name__ == '__main__':
    icon(192).save(os.path.join(OUT, 'icon-192.png'))
    icon(512).save(os.path.join(OUT, 'icon-512.png'))
    icon(512, maskable=True).save(os.path.join(OUT, 'maskable-512.png'))
    icon(180, maskable=True).convert('RGB').save(os.path.join(OUT, 'apple-touch-icon.png'))
    if os.environ.get('PREVIEW'):
        ims = [icon(512), icon(512, maskable=True), icon(192), icon(72), icon(40)]
        sheet = Image.new('RGBA', (sum(i.width for i in ims) + 20 * (len(ims) + 1), 552), (245, 251, 245, 255))
        x = 20
        for i in ims:
            sheet.alpha_composite(i, (x, (552 - i.height) // 2)); x += i.width + 20
        sheet.save(os.path.join(OUT, 'logo_preview.png'))
    print('icons written')
