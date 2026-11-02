"""Soundtrack for the Exsy promo: voice-over lines (voice/line_NN.wav from narrate.ps1) placed on their scenes,
over a light original background track (pad + bass + pluck + soft beat, 96 BPM) that ducks under the voice.
Also writes timing.json so make_promo.py holds every scene long enough for its line.
Run:  python marketing/build_audio.py   →  timing.json + soundtrack.wav"""
import json, math, os, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SR, FPS = 44100, 30
TRANS_F = int(0.45 * FPS)                    # same frame maths as make_promo.py
MIN_INTRO_F, MIN_HOLD_F, MIN_OUTRO_F = int(2.4 * FPS), int(2.35 * FPS), int(3.4 * FPS)
N_SCENES = 11


def read_wav(p):
    with wave.open(p) as w:
        sr, n, ch = w.getframerate(), w.getnframes(), w.getnchannels()
        x = np.frombuffer(w.readframes(n), '<i2').astype(np.float32) / 32768
    if ch == 2: x = x.reshape(-1, 2).mean(1)
    if sr != SR: x = np.interp(np.arange(int(len(x) * SR / sr)) * sr / SR, np.arange(len(x)), x).astype(np.float32)
    return x


def trim(x, thr=0.012, pad=0.04):
    idx = np.where(np.abs(x) > thr)[0]
    if not len(idx): return x
    a, b = max(0, idx[0] - int(pad * SR)), min(len(x), idx[-1] + int(pad * SR))
    y = x[a:b]; return y / (np.max(np.abs(y)) + 1e-9) * 0.89


voices = [trim(read_wav(os.path.join(HERE, 'voice', f'line_{i:02d}.wav'))) for i in range(N_SCENES + 2)]
dur = [len(v) / SR for v in voices]

# ---------- timeline in frames ----------
LEAD = 0.30                                   # voice starts this long after its scene starts
place = []                                    # (voice index, start seconds)
intro_f = max(MIN_INTRO_F, math.ceil((0.35 + dur[0] + 0.45) * FPS)); place.append((0, 0.35))
t_f = intro_f; holds = []
for i in range(N_SCENES):
    hold_f = max(MIN_HOLD_F, math.ceil((LEAD + dur[i + 1] + 0.40) * FPS) - TRANS_F)
    place.append((i + 1, t_f / FPS + LEAD)); holds.append(hold_f)
    t_f += TRANS_F + hold_f
t_f += TRANS_F                                # zoom into the end card
outro_f = max(MIN_OUTRO_F, math.ceil((LEAD + dur[-1] + 1.3) * FPS)); place.append((N_SCENES + 1, t_f / FPS + LEAD))
total_f = t_f + outro_f
json.dump({'intro': (intro_f + 0.01) / FPS, 'holds': [(h + 0.01) / FPS for h in holds], 'outro': (outro_f + 0.01) / FPS},
          open(os.path.join(HERE, 'timing.json'), 'w'), indent=1)
N = int(total_f / FPS * SR)
print(f'video length {total_f / FPS:.1f} s, {total_f} frames')

# ---------- original background music ----------
t = np.arange(N) / SR
BPM = 96; beat = 60 / BPM; bar = 4 * beat
CHORDS = [(48, [60, 64, 67]), (43, [59, 62, 67]), (45, [60, 64, 69]), (41, [60, 65, 69])]   # C  G  Am  F
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
music = np.zeros((N, 2), np.float32)


def env(n, a, d):          # attack / exponential decay envelope
    e = np.exp(-np.arange(n) / (d * SR)); k = int(a * SR); e[:k] *= np.linspace(0, 1, k) if k else 1; return e


n_bars = int(N / SR / bar) + 1
for b in range(n_bars):
    root, notes = CHORDS[b % 4]; s0 = int(b * bar * SR); L = min(int(bar * SR), N - s0)
    if L <= 0: break
    tt = np.arange(L) / SR
    # pad: soft detuned sines, slow swell
    sw = np.minimum(1, tt / 0.6) * np.minimum(1, (bar - tt) / 0.4)
    padL = sum(np.sin(2 * np.pi * hz(m) * 0.998 * tt) for m in notes) * sw * 0.05
    padR = sum(np.sin(2 * np.pi * hz(m) * 1.002 * tt + 0.7) for m in notes) * sw * 0.05
    music[s0:s0 + L, 0] += padL; music[s0:s0 + L, 1] += padR
    # bass on beats 1 and 3
    for k in (0, 2):
        a = s0 + int(k * beat * SR); n = min(int(beat * 1.8 * SR), N - a)
        if n > 0:
            x = np.sin(2 * np.pi * hz(root) * np.arange(n) / SR) * env(n, 0.01, 0.5) * 0.16; music[a:a + n] += x[:, None]
    # pluck arpeggio in eighths
    arp = [notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[1] + 12]
    for k in range(8):
        a = s0 + int(k * beat / 2 * SR); n = min(int(0.45 * SR), N - a)
        if n <= 0: continue
        f = hz(arp[k % 4]); tn = np.arange(n) / SR
        x = (np.sin(2 * np.pi * f * tn) + 0.3 * np.sin(4 * np.pi * f * tn)) * env(n, 0.003, 0.12) * 0.05
        pan = 0.35 if k % 2 else -0.35
        music[a:a + n, 0] += x * (1 - pan); music[a:a + n, 1] += x * (1 + pan)
    # soft kick on 1 and 3, shaker on off-beats
    rng = np.random.default_rng(b)
    for k in range(4):
        a = s0 + int(k * beat * SR)
        if k in (0, 2):
            n = min(int(0.25 * SR), N - a)
            if n > 0:
                tn = np.arange(n) / SR; ph = 2 * np.pi * np.cumsum(90 * np.exp(-tn * 18) + 45) / SR
                music[a:a + n] += (np.sin(ph) * env(n, 0.002, 0.09) * 0.22)[:, None]
        a2 = a + int(beat / 2 * SR); n = min(int(0.06 * SR), N - a2)
        if n > 0:
            sh = np.diff(rng.standard_normal(n + 1)).astype(np.float32) * env(n, 0.001, 0.015) * 0.025
            music[a2:a2 + n] += sh[:, None]

# fade in / out
fi, fo = int(0.8 * SR), int(2.0 * SR)
music[:fi] *= np.linspace(0, 1, fi)[:, None]; music[-fo:] *= np.linspace(1, 0, fo)[:, None]
music /= np.max(np.abs(music)) + 1e-9

# ---------- voice track + ducking ----------
voice = np.zeros(N, np.float32); active = np.zeros(N, np.float32)
for vi, st in place:
    a = int(st * SR); v = voices[vi][:max(0, N - a)]; voice[a:a + len(v)] += v; active[a:a + len(v)] = 1
k = int(0.25 * SR); kern = np.ones(k) / k
duck = np.convolve(active, kern, mode='same')                  # smooth ramps around each line
gain = 0.30 * (1 - 0.62 * np.clip(duck * 1.4, 0, 1))           # music level: 0.30 alone, ~0.11 under the voice
mix = music * gain[:, None] + voice[:, None] * 0.92
mix = np.tanh(mix * 1.1) / np.tanh(1.1)                         # gentle limiter
pcm = (np.clip(mix, -1, 1) * 32000).astype('<i2')
with wave.open(os.path.join(HERE, 'soundtrack.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('soundtrack.wav written,', ', '.join(f'{d:.1f}s' for d in dur))
