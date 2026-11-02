"""Splits one long voice-over recording (e.g. the ElevenLabs MP3 of elevenlabs_script.txt) into voice/line_NN.wav,
one file per narration line, by finding the pauses between lines.
Run:  python marketing/split_voice.py voice/elevenlabs.mp3"""
import os, subprocess, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
N_LINES = sum(1 for l in open(os.path.join(HERE, 'narration.txt'), encoding='utf-8') if l.strip())


def to_wav(path):
    if path.lower().endswith('.wav'): return path
    out = os.path.join(HERE, 'voice', 'full_take.wav')
    subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', os.path.join(HERE, 'convert_audio.ps1'), path, out], check=True)
    return out


def read(p):
    with wave.open(p) as w:
        sr, ch, n, sw = w.getframerate(), w.getnchannels(), w.getnframes(), w.getsampwidth()
        raw = w.readframes(n)
    x = np.frombuffer(raw, '<i2').astype(np.float32) / 32768 if sw == 2 else np.frombuffer(raw, '<i4').astype(np.float32) / 2 ** 31
    if sw == 4 and np.max(np.abs(x)) < 1e-6:                     # 32-bit float WAV
        x = np.frombuffer(raw, '<f4').astype(np.float32)
    return x.reshape(-1, ch).mean(1), sr


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'voice', 'elevenlabs.mp3')
    x, sr = read(to_wav(src if os.path.isabs(src) else os.path.join(HERE, src)))
    win = int(0.02 * sr); e = np.sqrt(np.convolve(x ** 2, np.ones(win) / win, mode='same'))
    loud = e > max(0.01, 0.06 * np.percentile(e, 95))
    # gaps of silence; keep the N_LINES-1 longest ones as the cut points between lines
    gaps, i, n = [], 0, len(loud)
    while i < n:
        if not loud[i]:
            j = i
            while j < n and not loud[j]: j += 1
            if i > 0 and j < n: gaps.append((j - i, i, j))
            i = j
        else: i += 1
    cuts = sorted(sorted(gaps, reverse=True)[:N_LINES - 1], key=lambda g: g[1])
    if len(cuts) < N_LINES - 1: sys.exit(f'Found only {len(cuts) + 1} parts but narration.txt has {N_LINES} lines')
    bounds = [0] + [(a + b) // 2 for _, a, b in cuts] + [n]
    os.makedirs(os.path.join(HERE, 'voice'), exist_ok=True)
    for k in range(N_LINES):
        seg = x[bounds[k]:bounds[k + 1]]
        pcm = (np.clip(seg, -1, 1) * 32767).astype('<i2')
        with wave.open(os.path.join(HERE, 'voice', f'line_{k:02d}.wav'), 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(pcm.tobytes())
        print(f'line_{k:02d}.wav  {len(seg) / sr:.1f}s')
    print('shortest pause used as a cut:', f'{min(g[0] for g in cuts) / sr:.2f}s')


if __name__ == '__main__':
    main()
