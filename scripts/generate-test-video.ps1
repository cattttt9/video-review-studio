param(
    [string]$OutDir = (Join-Path $PSScriptRoot 'generated')
)

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$ffmpeg = (Get-Command ffmpeg -ErrorAction Stop).Source

# 横版 H.264/AAC MP4
& $ffmpeg -y -hide_banner -loglevel error -f lavfi -i "testsrc2=size=1280x720:rate=30:duration=10" `
    -f lavfi -i "sine=frequency=440:duration=10" `
    -c:v libx264 -preset veryfast -crf 26 -pix_fmt yuv420p -c:a aac -shortest `
    (Join-Path $OutDir 'landscape.mp4')

# 竖版 MP4
& $ffmpeg -y -hide_banner -loglevel error -f lavfi -i "testsrc2=size=720x1280:rate=30:duration=10" `
    -f lavfi -i "sine=frequency=660:duration=10" `
    -c:v libx264 -preset veryfast -crf 26 -pix_fmt yuv420p -c:a aac -shortest `
    (Join-Path $OutDir 'portrait.mp4')

# MKV（需代理生成的格式示例）
& $ffmpeg -y -hide_banner -loglevel error -f lavfi -i "testsrc2=size=640x360:rate=25:duration=10" `
    -f lavfi -i "sine=frequency=330:duration=10" `
    -c:v libx264 -preset veryfast -crf 28 -c:a aac -shortest `
    (Join-Path $OutDir 'sample.mkv')

Write-Host "测试视频已生成到 $OutDir"
Get-ChildItem $OutDir | Where-Object { $_.Extension -in '.mp4','.mkv' } |
    Select-Object Name,@{n='MB';e={[math]::Round($_.Length/1MB,2)}} | Format-Table -AutoSize

