"""One command for the whole promo:  python marketing/build_video.py [voice recording]
  1. split the voice recording into one file per narration line (if a recording is given)
  2. build the soundtrack (voice + ducked background music) and the scene timings
  3. render the video frames to match the timings
  4. join video + soundtrack into exsy_promo_voice.mp4 (H.264 + AAC)"""
import os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
py = sys.executable
run = lambda *a: subprocess.run(list(a), check=True, cwd=HERE)

if len(sys.argv) > 1:
    run(py, 'split_voice.py', os.path.abspath(sys.argv[1]))
run(py, 'build_audio.py')
run(py, 'make_promo.py')
run('powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'mux_audio.ps1',
    os.path.join(HERE, 'exsy_promo_silent.mp4'), os.path.join(HERE, 'soundtrack.wav'), os.path.join(HERE, 'exsy_promo_voice.mp4'), '5000000')
os.remove(os.path.join(HERE, 'exsy_promo_silent.mp4'))       # large temporary file
print('Done: marketing/exsy_promo_voice.mp4')
