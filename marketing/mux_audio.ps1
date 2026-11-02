# Joins a silent MP4 with a WAV soundtrack using Windows' built-in video editing engine (no ffmpeg needed)
# and re-encodes to H.264 + AAC at a sensible bitrate.
# Usage: powershell -ExecutionPolicy Bypass -File mux_audio.ps1 <video.mp4> <audio.wav> <out.mp4> [videoBitrate]
param([string]$Video, [string]$Audio, [string]$Out, [int]$Bitrate = 6000000)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFolder, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Editing.MediaComposition, Windows.Media.Editing, ContentType = WindowsRuntime]
$null = [Windows.Media.Editing.MediaClip, Windows.Media.Editing, ContentType = WindowsRuntime]
$null = [Windows.Media.Editing.BackgroundAudioTrack, Windows.Media.Editing, ContentType = WindowsRuntime]
$null = [Windows.Media.MediaProperties.MediaEncodingProfile, Windows.Media.MediaProperties, ContentType = WindowsRuntime]

# WinRT async → .NET Task
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
$asTaskProgress = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperationWithProgress`2' })[0]
function Await($op, [Type]$result) { $t = $asTaskGeneric.MakeGenericMethod($result).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
function AwaitP($op, [Type]$result, [Type]$progress) { $t = $asTaskProgress.MakeGenericMethod($result, $progress).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }

$vf = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync((Resolve-Path $Video).Path)) ([Windows.Storage.StorageFile])
$af = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync((Resolve-Path $Audio).Path)) ([Windows.Storage.StorageFile])
$comp = New-Object Windows.Media.Editing.MediaComposition
$clip = Await ([Windows.Media.Editing.MediaClip]::CreateFromFileAsync($vf)) ([Windows.Media.Editing.MediaClip])
# PowerShell can't call Add on projected WinRT lists directly – call the interface method by reflection
function AddTo($list, [Type]$itemType, $item) { [System.Collections.Generic.ICollection`1].MakeGenericType($itemType).GetMethod('Add').Invoke($list, @($item)) | Out-Null }
AddTo $comp.Clips ([Windows.Media.Editing.MediaClip]) $clip
$bg = Await ([Windows.Media.Editing.BackgroundAudioTrack]::CreateFromFileAsync($af)) ([Windows.Media.Editing.BackgroundAudioTrack])
AddTo $comp.BackgroundAudioTracks ([Windows.Media.Editing.BackgroundAudioTrack]) $bg

$outDir = Split-Path -Parent ([IO.Path]::GetFullPath($Out)); $outName = Split-Path -Leaf $Out
$folder = Await ([Windows.Storage.StorageFolder]::GetFolderFromPathAsync($outDir)) ([Windows.Storage.StorageFolder])
$of = Await ($folder.CreateFileAsync($outName, [Windows.Storage.CreationCollisionOption]::ReplaceExisting)) ([Windows.Storage.StorageFile])

$prof = [Windows.Media.MediaProperties.MediaEncodingProfile]::CreateMp4([Windows.Media.MediaProperties.VideoEncodingQuality]::HD1080p)
$prof.Video.Width = 1080; $prof.Video.Height = 1920; $prof.Video.Bitrate = $Bitrate
$prof.Video.FrameRate.Numerator = 30; $prof.Video.FrameRate.Denominator = 1
$prof.Audio.SampleRate = 44100; $prof.Audio.ChannelCount = 2; $prof.Audio.Bitrate = 160000

$res = AwaitP ($comp.RenderToFileAsync($of, [Windows.Media.Editing.MediaTrimmingPreference]::Precise, $prof)) ([Windows.Media.Transcoding.TranscodeFailureReason]) ([double])
"render result: $res"
"size MB: {0:N1}" -f ((Get-Item $Out).Length / 1MB)
