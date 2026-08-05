param(
    [string]$FfmpegPath = '',
    [string]$FfprobePath = '',
    [string]$TargetTriple = ''
)

$ErrorActionPreference = 'Stop'

if (-not $TargetTriple) {
    $TargetTriple = (rustc -vV | Select-String '^host:' | ForEach-Object { $_.Line.Split(' ')[1] }).Trim()
}
if (-not $TargetTriple) {
    throw '无法确定 target triple，请用 -TargetTriple 指定'
}

if (-not $FfmpegPath) { $FfmpegPath = (Get-Command ffmpeg -ErrorAction Stop).Source }
if (-not $FfprobePath) { $FfprobePath = (Get-Command ffprobe -ErrorAction Stop).Source }

$binDir = Join-Path $PSScriptRoot '..\src-tauri\binaries'
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

$dst1 = Join-Path $binDir "ffmpeg-$TargetTriple.exe"
$dst2 = Join-Path $binDir "ffprobe-$TargetTriple.exe"
Copy-Item -LiteralPath $FfmpegPath -Destination $dst1 -Force
Copy-Item -LiteralPath $FfprobePath -Destination $dst2 -Force

Write-Host 'FFmpeg sidecar 已准备：'
Get-Item $dst1, $dst2 | Select-Object Name,@{n='MB';e={[math]::Round($_.Length/1MB,1)}} | Format-Table -AutoSize

