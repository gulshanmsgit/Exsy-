"""Records every line of narration.txt with a Microsoft neural voice (edge-tts) into voice/line_NN.wav.
Run:  python marketing/neural_voice.py [voice] [rate]     e.g.  en-US-AndrewNeural +6%
Needs `pip install edge-tts` and an internet connection (the text is sent to Microsoft's speech service)."""
import asyncio, os, subprocess, sys
import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
VOICE = sys.argv[1] if len(sys.argv) > 1 else 'en-US-AndrewNeural'
RATE = sys.argv[2] if len(sys.argv) > 2 else '+6%'
SAY = {'Exsy': 'Ex-see'}                      # spoken spelling of the brand name


async def main():
    lines = [l.strip() for l in open(os.path.join(HERE, 'narration.txt'), encoding='utf-8') if l.strip()]
    os.makedirs(os.path.join(HERE, 'voice'), exist_ok=True)
    for i, line in enumerate(lines):
        text = line
        for k, v in SAY.items(): text = text.replace(k, v)
        mp3 = os.path.join(HERE, 'voice', f'line_{i:02d}.mp3')
        await edge_tts.Communicate(text, VOICE, rate=RATE).save(mp3)
        subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', os.path.join(HERE, 'convert_audio.ps1'),
                        mp3, os.path.join(HERE, 'voice', f'line_{i:02d}.wav')], check=True, capture_output=True)
        print(f'{i:02d} {line}')


asyncio.run(main())
