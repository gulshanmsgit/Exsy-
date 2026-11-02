"""Exsy logo: white 'E' with arms that grow longer downwards (stacked notes / rising bars) and a mint rupee coin,
on a deep-green squircle. `python icons/make_icons.py` rewrites the PWA icons next to this file;
set PREVIEW=1 to also save logo_preview.png. Needs Pillow and the Segoe UI Semibold font (Windows)."""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = os.path.dirname(os.path.abspath(__file__))
G1, G2 = (16, 143, 99), (3, 78, 55)          # gradient: top-left → bottom-right
MINT, WHITE, INK = (137, 248, 199), (255, 255, 255), (0, 56, 38)
FONT = r'C:\Windows\Fonts\seguisb.ttf'


def gradient(S):
    g = Image.new('RGB', (S, S))
    px = g.load()
    for y in range(S):
        for x in range(S):
            t = (x + y) / (2 * S - 2)
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(G1, G2))
    return g


def mark(S, scale):
    """The E + coin, drawn on a transparent layer, centred, occupying `scale` of the canvas."""
    L = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(L)
    u = S * scale / 10                      # design grid: the mark is 10 units wide
    ox, oy = (S - 10 * u) / 2 + 0.35 * u, (S - 9 * u) / 2
    r = 0.62 * u                            # corner radius of the strokes
    stem_w, bar_h, gap = 1.7 * u, 1.7 * u, 1.95 * u
    d.rounded_rectangle([ox, oy, ox + stem_w, oy + 3 * bar_h + 2 * gap - 0.6 * u], r, fill=WHITE)   # stem
    for i, w in enumerate((4.4, 5.6, 7.4)):                                                         # arms grow downwards
        y = oy + i * (bar_h + gap)
        if i == 2: y -= 0.6 * u
        d.rounded_rectangle([ox, y, ox + w * u, y + bar_h], r, fill=WHITE)
    # rupee coin, top-right
    cx, cy, cr = ox + 8.0 * u, oy + 1.6 * u, 1.9 * u
    d.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=MINT)
    f = ImageFont.truetype(FONT, int(cr * 1.45))
    bb = d.textbbox((0, 0), '\u20b9', font=f)
    d.text((cx - (bb[0] + bb[2]) / 2, cy - (bb[1] + bb[3]) / 2), '\u20b9', font=f, fill=INK)
    return L


def icon(size, maskable=False, scale=0.56):
    S = size * 4
    bg = gradient(S).convert('RGBA')
    if not maskable:
        m = Image.new('L', (S, S), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, S - 1, S - 1], int(S * 0.235), fill=255)
        bg.putalpha(m)
    # soft light in the top-left corner
    glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([-S * 0.5, -S * 0.6, S * 0.6, S * 0.35], fill=(255, 255, 255, 26))
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.16))
    if not maskable: glow.putalpha(Image.composite(glow.getchannel('A'), Image.new('L', (S, S), 0), bg.getchannel('A')))
    bg = Image.alpha_composite(bg, glow)
    # gentle shadow under the mark
    mk = mark(S, scale * (0.82 if maskable else 1))
    sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    sh.putalpha(mk.getchannel('A').point(lambda a: a * 0.28))
    sh = sh.filter(ImageFilter.GaussianBlur(S * 0.012))
    bg = Image.alpha_composite(bg, sh.transform((S, S), Image.AFFINE, (1, 0, 0, 0, 1, -S * 0.012)))
    bg = Image.alpha_composite(bg, mk)
    return bg.resize((size, size), Image.LANCZOS)


if __name__ == '__main__':
    icon(192).save(os.path.join(OUT, 'icon-192.png'))
    icon(512).save(os.path.join(OUT, 'icon-512.png'))
    icon(512, maskable=True).save(os.path.join(OUT, 'maskable-512.png'))
    icon(180, maskable=True).convert('RGB').save(os.path.join(OUT, 'apple-touch-icon.png'))
    if os.environ.get('PREVIEW'):
        previews = [icon(512), icon(512, maskable=True), icon(192), icon(48)]
        sheet = Image.new('RGBA', (512 * 2 + 192 + 48 + 80, 540), (245, 251, 245, 255))
        x = 10
        for im in previews:
            sheet.alpha_composite(im, (x, (540 - im.height) // 2)); x += im.width + 20
        sheet.save(os.path.join(OUT, 'logo_preview.png'))
    print('icons written')
