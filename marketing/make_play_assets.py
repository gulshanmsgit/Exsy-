"""Google Play store graphics for Exsy.
- marketing/play/feature-graphic.png  1024x500 banner (required)
- marketing/play/screen-NN.png        1080x2160 phone screenshots (Play allows at most 2:1), made from marketing/screens/*.jpg
Run:  python marketing/make_play_assets.py
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'marketing', 'play')
os.makedirs(OUT, exist_ok=True)
GREEN, DARK = (0, 138, 98), (0, 82, 58)
FONTS = 'C:/Windows/Fonts/'
def font(name, size):
    for n in (name, 'segoeui.ttf', 'arial.ttf'):
        try: return ImageFont.truetype(FONTS + n, size)
        except OSError: pass
    return ImageFont.load_default()

def gradient(w, h):
    g = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(g)
    for y in range(h):
        t = y / h
        d.line([(0, y), (w, y)], fill=tuple(int(GREEN[i] * (1 - t) + DARK[i] * t) for i in range(3)))
    return g

# ---------- feature graphic ----------
fg = gradient(1024, 500)
icon = Image.open(os.path.join(ROOT, 'icons', 'icon-512.png')).convert('RGBA').resize((230, 230), Image.LANCZOS)
shadow = Image.new('RGBA', (270, 270), (0, 0, 0, 0)); ImageDraw.Draw(shadow).rounded_rectangle([20, 26, 250, 256], 52, fill=(0, 0, 0, 90))
fg.paste(shadow.filter(ImageFilter.GaussianBlur(10)), (60, 115), shadow.filter(ImageFilter.GaussianBlur(10)))
fg.paste(icon, (80, 135), icon)
d = ImageDraw.Draw(fg)
d.text((360, 140), 'Exsy', font=font('seguisb.ttf', 92), fill='white')
d.text((364, 256), 'Your family money book', font=font('segoeui.ttf', 40), fill=(225, 245, 236))
d.text((364, 318), 'Cash & bank · lending · EMIs · chits', font=font('segoeui.ttf', 30), fill=(190, 230, 212))
fg.save(os.path.join(OUT, 'feature-graphic.png'))

# ---------- screenshots: phone screen centred on a 1080x2160 green canvas with a caption ----------
CAPTIONS = {
    '01': 'All your money at a glance', '02': 'Paste a bank SMS – it fills itself', '03': 'Every entry explained simply',
    '04': 'Fair chit draws in one tap', '05': 'Who paid, who hasn’t – every month', '06': 'Statements straight to WhatsApp',
    '07': 'EMIs with interest & GST worked out', '08': 'Budgets that warn you in time', '09': 'See where your spending is heading',
    '10': 'Family money, kept apart', '11': 'Collection day made easy',
}
src = os.path.join(ROOT, 'marketing', 'screens')
for name in sorted(os.listdir(src)):
    if not name.lower().endswith(('.jpg', '.png')): continue
    num = name[:2]
    shot = Image.open(os.path.join(src, name)).convert('RGB')
    canvas = gradient(1080, 2160)
    h = 1800; w = round(shot.width * h / shot.height)
    if w > 960: w = 960; h = round(shot.height * w / shot.width)
    shot = shot.resize((w, h), Image.LANCZOS)
    mask = Image.new('L', (w, h), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], 44, fill=255)
    x, y = (1080 - w) // 2, 2160 - h - 60
    canvas.paste(shot, (x, y), mask)
    cap = CAPTIONS.get(num, '')
    d = ImageDraw.Draw(canvas); f = font('seguisb.ttf', 58)
    tw = d.textlength(cap, font=f)
    if tw > 1000: f = font('seguisb.ttf', 48); tw = d.textlength(cap, font=f)
    d.text(((1080 - tw) / 2, (y - 70) / 2), cap, font=f, fill='white')
    canvas.save(os.path.join(OUT, f'screen-{num}.png'))
print('done:', sorted(os.listdir(OUT)))
