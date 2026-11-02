# Speaks each line of narration.txt with a Windows voice into voice\line_NN.wav (44.1 kHz, 16-bit, mono).
# Usage: powershell -ExecutionPolicy Bypass -File narrate.ps1 [-Voice "Microsoft Zira Desktop"] [-Rate 0]
param([string]$Voice = 'Microsoft Zira Desktop', [int]$Rate = 0)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $here 'voice'; New-Item -ItemType Directory -Force $out | Out-Null
$lines = Get-Content -Encoding UTF8 (Join-Path $here 'narration.txt') | Where-Object { $_.Trim() }
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(44100, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$i = 0
foreach ($line in $lines) {
  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $s.SelectVoice($Voice); $s.Rate = $Rate
  $f = Join-Path $out ('line_{0:D2}.wav' -f $i)
  $s.SetOutputToWaveFile($f, $fmt); $s.Speak($line); $s.Dispose()
  "{0:D2}  {1}" -f $i, $line
  $i++
}
