"""Android launcher icons + splash screens for the Capacitor app, drawn from the Spend ring logo (icons/make_icons.py).
Run after `npx cap add android`:  python scripts/android_assets.py"""
import importlib.util, os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
spec = importlib.util.spec_from_file_location('mk', os.path.join(ROOT, 'icons', 'make_icons.py'))
mk = importlib.util.module_from_spec(spec); spec.loader.exec_module(mk)

DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}


def ring_mark(S, k):
    """Just the ring + ₹ on a transparent canvas (for the adaptive-icon foreground and the splash)."""
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    cx = cy = S / 2; R, w = S * 0.30 * k, S * 0.085 * k
    for (a, b), col in mk.SEGMENTS:
        d.arc([cx - R, cy - R, cx + R, cy + R], a, b, fill=col, width=int(w))
    f = ImageFont.truetype(mk.FONT, int(S * 0.30 * k))
    bb = d.textbbox((0, 0), '\u20b9', font=f)
    d.text((cx - (bb[0] + bb[2]) / 2, cy + S * 0.01 * k - (bb[1] + bb[3]) / 2), '\u20b9', font=f, fill=(255, 255, 255))
    return im


for name, k in DENS.items():
    folder = os.path.join(RES, f'mipmap-{name}'); os.makedirs(folder, exist_ok=True)
    size = int(48 * k)
    mk.icon(size).save(os.path.join(folder, 'ic_launcher.png'))                       # rounded-square icon (old Androids)
    full = mk.icon(size, maskable=True); m = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(m).ellipse([0, 0, size * 4 - 1, size * 4 - 1], fill=255)
    full.putalpha(m.resize((size, size), Image.LANCZOS)); full.save(os.path.join(folder, 'ic_launcher_round.png'))
    fg = int(108 * k)                                                                # adaptive icon: 108 dp, mark inside the 66 dp safe zone
    ring_mark(fg * 4, 0.62).resize((fg, fg), Image.LANCZOS).save(os.path.join(folder, 'ic_launcher_foreground.png'))

# adaptive icon background: the same green gradient as the logo
with open(os.path.join(RES, 'drawable', 'ic_launcher_background.xml'), 'w', encoding='utf-8') as f:
    f.write('''<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <gradient android:angle="315" android:startColor="#00A878" android:endColor="#005C4B" android:type="linear" />
</shape>
''')
for xml in ('ic_launcher.xml', 'ic_launcher_round.xml'):
    with open(os.path.join(RES, 'mipmap-anydpi-v26', xml), 'w', encoding='utf-8') as f:
        f.write('''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
''')

# splash screens (same sizes as Capacitor's): green gradient, the logo and the name
for dirpath, _, files in os.walk(RES):
    if 'splash.png' not in files: continue
    p = os.path.join(dirpath, 'splash.png'); w, h = Image.open(p).size
    bg = mk.gradient(max(w, h)).crop((0, 0, w, h))
    s = int(min(w, h) * 0.42); bg.alpha_composite(ring_mark(s * 2, 1.0).resize((s, s), Image.LANCZOS), ((w - s) // 2, int(h * 0.5 - s * 0.62)))
    d = ImageDraw.Draw(bg); f = ImageFont.truetype(r'C:\Windows\Fonts\seguibl.ttf', max(18, int(min(w, h) * 0.11)))
    tw = d.textlength('Exsy', font=f); d.text(((w - tw) / 2, h * 0.5 + s * 0.45), 'Exsy', font=f, fill=(255, 255, 255))
    bg.convert('RGB').save(p)
print('android icons + splash written')
