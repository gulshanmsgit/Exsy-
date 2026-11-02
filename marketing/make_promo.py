"""Exsy promo video (1080×1920, 30 fps, Reels / Shorts) built from the app screenshots in marketing/screens.
Logo intro → 11 feature scenes in a phone frame with kinetic captions and changing transitions → end card.
Run:  python marketing/make_promo.py      (needs Pillow, numpy, opencv-python; Windows Segoe UI fonts)"""
import math, os
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1080, 1920, 30
F_BLACK, F_BOLD, F_SEMI = (r'C:\Windows\Fonts\seguibl.ttf', r'C:\Windows\Fonts\segoeuib.ttf', r'C:\Windows\Fonts\seguisb.ttf')
GREEN_A, GREEN_B = (0, 120, 86), (2, 44, 34)
MINT, GOLD, WHITE = (137, 248, 199), (255, 214, 102), (255, 255, 255)

SCENES = [  # screenshot, caption line 1, line 2 (highlight), transition into this scene
    ('01-home.jpg', 'Know where every', 'rupee is', 'zoom'),
    ('02-paste-sms.jpg', 'Paste a bank SMS…', 'it fills itself', 'whip'),
    ('03-what-this-means.jpg', 'Every entry,', 'explained simply', 'slide'),
    ('04-chit-draw.jpg', 'Run your chit fund.', 'Fair random draw', 'circle'),
    ('05-chit-grid.jpg', "Who paid? Who's late?", 'One glance', 'whip'),
    ('06-whatsapp-statement.jpg', 'Remind on WhatsApp', 'with a PDF statement', 'zoom'),
    ('07-emi.jpg', 'The TRUE cost', 'of your EMI', 'slide'),
    ('08-budget-panic.jpg', 'Overspending?', 'Exsy panics for you', 'circle'),
    ('09-trend.jpg', 'Watch the trend', 'month by month', 'whip'),
    ('10-mothers-money.jpg', 'Family money,', 'finally sorted', 'zoom'),
    ('11-collection-day.jpg', 'Collection day,', 'made easy', 'slide'),
]
INTRO, HOLD, TRANS, OUTRO = 2.4, 2.35, 0.45, 3.4


def font(path, size): return ImageFont.truetype(path, size)
def ease_out(t): return 1 - (1 - t) ** 3
def ease_in_out(t): return 4 * t ** 3 if t < .5 else 1 - (-2 * t + 2) ** 3 / 2
def clamp01(t): return max(0.0, min(1.0, t))


# ---------- background: deep green gradient with slowly drifting glowing blobs ----------
def make_bg():
    y = np.linspace(0, 1, H)[:, None]; x = np.linspace(0, 1, W)[None, :]
    t = np.clip(0.75 * y + 0.25 * x, 0, 1)[..., None]
    arr = (np.array(GREEN_A) * (1 - t) + np.array(GREEN_B) * t).astype(np.uint8)
    return Image.fromarray(arr, 'RGB').convert('RGBA')


def blob(r, color, alpha):
    s = int(r * 2.6); im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(im).ellipse([s / 2 - r, s / 2 - r, s / 2 + r, s / 2 + r], fill=color + (alpha,))
    return im.filter(ImageFilter.GaussianBlur(r * 0.45))


BG = make_bg()
BLOBS = [(blob(330, MINT, 70), 0.10, 0.18, 0.21), (blob(260, GOLD, 46), 0.85, 0.62, 0.17), (blob(380, (40, 200, 160), 60), 0.30, 0.92, 0.13)]


def background(t):
    im = BG.copy()
    for spr, bx, by, sp in BLOBS:
        cx = bx * W + math.sin(t * sp * 2 * math.pi) * 120; cy = by * H + math.cos(t * sp * 1.6 * math.pi) * 140
        im.alpha_composite(spr, (int(cx - spr.width / 2), int(cy - spr.height / 2)))
    return im


# ---------- phone mockup ----------
SCREEN_W = 680


def phone(path):
    shot = Image.open(os.path.join(HERE, 'screens', path)).convert('RGBA')
    sh = round(shot.height * SCREEN_W / shot.width)
    shot = shot.resize((SCREEN_W, sh), Image.LANCZOS)
    bez = 18; pw, ph = SCREEN_W + 2 * bez, sh + 2 * bez
    pad = 60
    im = Image.new('RGBA', (pw + 2 * pad, ph + 2 * pad), (0, 0, 0, 0))
    shadow = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([pad, pad + 24, pad + pw, pad + ph + 24], 78, fill=(0, 0, 0, 120))
    im.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(28)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([pad, pad, pad + pw, pad + ph], 78, fill=(14, 16, 15, 255))
    d.rounded_rectangle([pad + 2, pad + 2, pad + pw - 2, pad + ph - 2], 76, outline=(70, 80, 76, 255), width=3)
    m = Image.new('L', shot.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, SCREEN_W - 1, sh - 1], 60, fill=255)
    im.paste(shot, (pad + bez, pad + bez), m)
    return im


PHONES = [phone(s[0]) for s in SCENES]


# ---------- captions with a staggered slide-up ----------
F1, F2, FTAG = font(F_BLACK, 76), font(F_BLACK, 84), font(F_BOLD, 30)


def caption_layer(line1, line2, t):
    layer = Image.new('RGBA', (W, 420), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    for i, (txt, f, col, y) in enumerate(((line1, F1, WHITE, 92), (line2, F2, MINT, 196))):
        p = ease_out(clamp01((t - 0.10 - i * 0.12) / 0.38))
        if p <= 0: continue
        tw = d.textlength(txt, font=f); x = (W - tw) / 2
        tmp = Image.new('RGBA', layer.size, (0, 0, 0, 0)); td = ImageDraw.Draw(tmp)
        if i == 1:                               # highlight pill behind the key words
            bw = (tw + 56) * p
            td.rounded_rectangle([W / 2 - bw / 2, y + 6, W / 2 + bw / 2, y + 112], 30, fill=(0, 60, 44, int(150 * p)))
        td.text((x, y + 40 * (1 - p)), txt, font=f, fill=col + (int(255 * p),))
        layer.alpha_composite(tmp)
    # little brand tag
    pt = ease_out(clamp01(t / 0.3))
    tag = 'EXSY'; tw = d.textlength(tag, font=FTAG)
    d.rounded_rectangle([W / 2 - tw / 2 - 22, 22, W / 2 + tw / 2 + 22, 70], 24, fill=(255, 255, 255, int(40 * pt)))
    d.text((W / 2 - tw / 2, 25), tag, font=FTAG, fill=(255, 255, 255, int(220 * pt)))
    return layer


def scene_layer(i, t):
    """Scene i at local time t: caption on top, phone floating below with a slow push-in."""
    L = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    L.alpha_composite(caption_layer(SCENES[i][1], SCENES[i][2], t), (0, 40))
    ph = PHONES[i]
    k = 0.86 + 0.03 * clamp01(t / (HOLD + TRANS))           # gentle push-in
    pw, phh = int(ph.width * k), int(ph.height * k)
    img = ph.resize((pw, phh), Image.BILINEAR)
    y = 420 + int(math.sin(t * 2.2) * 8)                     # float
    L.alpha_composite(img, ((W - pw) // 2, y))
    return L


# ---------- transitions ----------
def scaled(layer, k, alpha=1.0):
    if k != 1:
        w, h = int(W * k), int(H * k); s = layer.resize((w, h), Image.BILINEAR)
        out = Image.new('RGBA', (W, H), (0, 0, 0, 0)); out.alpha_composite(s, ((W - w) // 2, (H - h) // 2)) if k <= 1 else out.alpha_composite(s.crop(((w - W) // 2, (h - H) // 2, (w - W) // 2 + W, (h - H) // 2 + H)))
        layer = out
    if alpha < 1:
        a = layer.getchannel('A').point(lambda v: int(v * alpha)); layer = layer.copy(); layer.putalpha(a)
    return layer


def shifted(layer, dx, dy=0):
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0)); out.alpha_composite(layer, (int(dx), int(dy))) if abs(dx) < W and abs(dy) < H else None
    return out


def transition(kind, A, B, p):
    q = ease_in_out(p)
    if kind == 'zoom':
        out = scaled(A, 1 + 0.18 * q, 1 - q); out.alpha_composite(scaled(B, 0.82 + 0.18 * q, q)); return out
    if kind == 'whip':
        out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        for o in (0, 30, 60):                               # cheap motion blur
            out.alpha_composite(scaled(shifted(A, -W * q - o * (1 - abs(2 * q - 1))), 1, 0.4))
            out.alpha_composite(scaled(shifted(B, W * (1 - q) + o * (1 - abs(2 * q - 1))), 1, 0.4))
        return out
    if kind == 'slide':
        out = shifted(A, 0, -H * q * 0.35); out = scaled(out, 1, 1 - q)
        out.alpha_composite(shifted(B, 0, H * (1 - q))); return out
    if kind == 'circle':
        r = int(1250 * q); m = Image.new('L', (W, H), 0)
        ImageDraw.Draw(m).ellipse([W / 2 - r, H * 0.55 - r, W / 2 + r, H * 0.55 + r], fill=255)
        out = A.copy(); bm = Image.composite(B, Image.new('RGBA', (W, H), (0, 0, 0, 0)), m)
        hole = A.copy(); hole.putalpha(Image.composite(Image.new('L', (W, H), 0), A.getchannel('A'), m))
        hole.alpha_composite(bm)
        ring = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        if 0 < q < 1: ImageDraw.Draw(ring).ellipse([W / 2 - r, H * 0.55 - r, W / 2 + r, H * 0.55 + r], outline=MINT + (200,), width=10)
        hole.alpha_composite(ring); return hole
    return B


# ---------- logo (spend ring) drawn progressively ----------
SEGMENTS = (((-90, 140), WHITE), ((152, 222), (163, 255, 214)), ((234, 258), GOLD))


def logo(size, p):
    S = size * 2; im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    m = Image.new('L', (S, S), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, S - 1, S - 1], int(S * 0.235), fill=255)
    tile = Image.new('RGBA', (S, S), (0, 150, 104, 255)); tile.putalpha(m); im.alpha_composite(tile)
    cx = cy = S / 2; R, w = S * 0.30, S * 0.085
    for (a, b), col in SEGMENTS:
        span = (b - a) * clamp01((p - (a + 90) / 360 * 0.6) / 0.4)
        if span > 1: d.arc([cx - R, cy - R, cx + R, cy + R], a, a + span, fill=col, width=int(w))
    q = ease_out(clamp01((p - 0.45) / 0.4))
    if q > 0:
        f = font(F_BOLD, int(S * 0.30 * (0.6 + 0.4 * q)))
        bb = d.textbbox((0, 0), '\u20b9', font=f)
        d.text((cx - (bb[0] + bb[2]) / 2, cy + S * 0.01 - (bb[1] + bb[3]) / 2), '\u20b9', font=f, fill=(255, 255, 255, int(255 * q)))
    return im.resize((size, size), Image.LANCZOS)


def text_center(img, txt, f, y, col, alpha=1.0, dy=0):
    d = ImageDraw.Draw(img); tw = d.textlength(txt, font=f)
    tmp = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(tmp).text(((W - tw) / 2, y + dy), txt, font=f, fill=col + (int(255 * alpha),))
    img.alpha_composite(tmp)


def intro_frame(t):
    im = background(t)
    p = clamp01(t / 1.4); s = 360
    pop = 1 + 0.08 * math.sin(clamp01((t - 1.3) / 0.35) * math.pi)
    lg = logo(int(s * pop), p); im.alpha_composite(lg, ((W - lg.width) // 2, 560 - (lg.height - s) // 2))
    a = ease_out(clamp01((t - 1.0) / 0.5)); text_center(im, 'Exsy', font(F_BLACK, 150), 980, WHITE, a, 40 * (1 - a))
    b = ease_out(clamp01((t - 1.35) / 0.5)); text_center(im, 'Your family money book', font(F_SEMI, 58), 1170, MINT, b, 40 * (1 - b))
    return im


def outro_frame(t):
    im = background(t + 40)
    lg = logo(300, 1.0); im.alpha_composite(lg, ((W - 300) // 2, 420))
    a = ease_out(clamp01(t / 0.5)); text_center(im, 'Exsy', font(F_BLACK, 140), 770, WHITE, a, 30 * (1 - a))
    lines = [('Home money  ·  Chits', 0.25), ('Loans  ·  EMIs  ·  Budgets', 0.4)]
    for k, (txt, d0) in enumerate(lines):
        b = ease_out(clamp01((t - d0) / 0.45)); text_center(im, txt, font(F_SEMI, 56), 960 + k * 80, MINT, b, 30 * (1 - b))
    c = ease_out(clamp01((t - 0.7) / 0.5))
    pill = Image.new('RGBA', (W, H), (0, 0, 0, 0)); pd = ImageDraw.Draw(pill)
    f = font(F_BOLD, 52); txt = 'Coming soon on Google Play'; tw = pd.textlength(txt, font=f)
    y = 1230 + 30 * (1 - c)
    pd.rounded_rectangle([(W - tw) / 2 - 46, y, (W + tw) / 2 + 46, y + 108], 54, fill=WHITE + (int(255 * c),))
    pd.text(((W - tw) / 2, y + 20), txt, font=f, fill=(0, 92, 66, int(255 * c)))
    im.alpha_composite(pill)
    return im


def open_writer(path):
    for code in ('avc1', 'H264', 'mp4v'):
        vw = cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*code), FPS, (W, H))
        if vw.isOpened(): return vw, code
    raise RuntimeError('No video encoder available')


def main():
    out = os.path.join(HERE, 'exsy_promo.mp4')
    vw, code = open_writer(out)
    put = lambda im: vw.write(cv2.cvtColor(np.asarray(im.convert('RGB')), cv2.COLOR_RGB2BGR))
    t_global = 0.0
    for f in range(int(INTRO * FPS)):
        put(intro_frame(f / FPS))
    t_global = INTRO
    n = len(SCENES)
    for i in range(n):
        kind = SCENES[i][3]
        # transition from the previous scene (or the intro) into scene i
        for f in range(int(TRANS * FPS)):
            p = f / (TRANS * FPS); bg = background(t_global + f / FPS)
            A = scene_layer(i - 1, HOLD + TRANS * p) if i > 0 else Image.new('RGBA', (W, H), (0, 0, 0, 0))
            B = scene_layer(i, TRANS * p)
            bg.alpha_composite(transition(kind, A, B, p)); put(bg)
        t_global += TRANS
        for f in range(int(HOLD * FPS)):
            bg = background(t_global + f / FPS); bg.alpha_composite(scene_layer(i, TRANS + f / FPS)); put(bg)
        t_global += HOLD
        print(f'scene {i + 1}/{n}', flush=True)
    # zoom transition into the end card
    last = scene_layer(n - 1, HOLD + TRANS)
    for f in range(int(TRANS * FPS)):
        p = f / (TRANS * FPS); im = outro_frame(0); im.alpha_composite(scaled(last, 1 + 0.25 * ease_in_out(p), 1 - ease_in_out(p))); put(im)
    for f in range(int(OUTRO * FPS)):
        put(outro_frame(f / FPS))
    vw.release()
    print('written', out, 'codec', code, f'{os.path.getsize(out) / 1e6:.1f} MB')


if __name__ == '__main__':
    main()
