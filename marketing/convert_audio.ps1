# Converts an audio file (MP3, M4A, WAV…) to another format with Windows' built-in transcoder – no ffmpeg needed.
# Usage: powershell -ExecutionPolicy Bypass -File convert_audio.ps1 <in> <out.wav|out.mp3>
param([string]$In, [string]$Out)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFolder, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Transcoding.MediaTranscoder, Windows.Media.Transcoding, ContentType = WindowsRuntime]
$null = [Windows.Media.MediaProperties.MediaEncodingProfile, Windows.Media.MediaProperties, ContentType = WindowsRuntime]
$m = [System.WindowsRuntimeSystemExtensions].GetMethods()
$asOp = ($m | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
$asAct = ($m | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncActionWithProgress`1' })[0]
function Await($op, [Type]$t) { $k = $asOp.MakeGenericMethod($t).Invoke($null, @($op)); $k.Wait(-1) | Out-Null; $k.Result }
function AwaitA($op, [Type]$p) { $k = $asAct.MakeGenericMethod($p).Invoke($null, @($op)); $k.Wait(-1) | Out-Null }

$src = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync((Resolve-Path $In).Path)) ([Windows.Storage.StorageFile])
$full = [IO.Path]::GetFullPath($Out)
$folder = Await ([Windows.Storage.StorageFolder]::GetFolderFromPathAsync((Split-Path -Parent $full))) ([Windows.Storage.StorageFolder])
$dst = Await ($folder.CreateFileAsync((Split-Path -Leaf $full), [Windows.Storage.CreationCollisionOption]::ReplaceExisting)) ([Windows.Storage.StorageFile])
$q = [Windows.Media.MediaProperties.AudioEncodingQuality]::High
$prof = if ($Out -match '\.mp3$') { [Windows.Media.MediaProperties.MediaEncodingProfile]::CreateMp3($q) } else { [Windows.Media.MediaProperties.MediaEncodingProfile]::CreateWav($q) }
$tc = New-Object Windows.Media.Transcoding.MediaTranscoder
$prep = Await ($tc.PrepareFileTranscodeAsync($src, $dst, $prof)) ([Windows.Media.Transcoding.PrepareTranscodeResult])
if (-not $prep.CanTranscode) { throw "Cannot convert: $($prep.FailureReason)" }
AwaitA ($prep.TranscodeAsync()) ([double])
"converted -> $full ({0:N1} MB)" -f ((Get-Item $full).Length / 1MB)
