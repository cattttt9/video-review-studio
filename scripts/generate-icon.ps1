param(
    [string]$OutFile = (Join-Path $PSScriptRoot '..\app-icon.png')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function New-Point($x, $y) {
    return New-Object System.Drawing.Point([int]$x, [int]$y)
}

function Get-ThickLinePoints($x1, $y1, $x2, $y2, $width) {
    $dx = $x2 - $x1
    $dy = $y2 - $y1
    $len = [math]::Sqrt($dx * $dx + $dy * $dy)
    if ($len -eq 0) { return @(New-Point $x1 $y1) }
    $ux = $dx / $len
    $uy = $dy / $len
    $px = -$uy * $width / 2
    $py = $ux * $width / 2
    return @(
        (New-Point ($x1 + $px) ($y1 + $py)),
        (New-Point ($x1 - $px) ($y1 - $py)),
        (New-Point ($x2 - $px) ($y2 - $py)),
        (New-Point ($x2 + $px) ($y2 + $py))
    )
}

function Get-ArrowHeadPoints($x1, $y1, $x2, $y2, $size) {
    $angle = [math]::Atan2(($y2 - $y1), ($x2 - $x1))
    $a1 = $angle + [math]::PI * 5 / 6
    $a2 = $angle - [math]::PI * 5 / 6
    return @(
        (New-Point $x2 $y2),
        (New-Point ($x2 + $size * [math]::Cos($a1)) ($y2 + $size * [math]::Sin($a1))),
        (New-Point ($x2 + $size * [math]::Cos($a2)) ($y2 + $size * [math]::Sin($a2)))
    )
}

$size = 1024
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

# 背景（圆角深蓝渐变）
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$radius = 200
$rect = New-Object System.Drawing.Rectangle(16, 16, ($size - 32), ($size - 32))
$d = $radius * 2
$path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
$path.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
$path.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
$path.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
$path.CloseFigure()

$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(255, 16, 24, 40),
    [System.Drawing.Color]::FromArgb(255, 30, 58, 104),
    45.0
)
$g.FillPath($bgBrush, $path)

# 播放三角
$white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$play = @(
    (New-Point 300 260),
    (New-Point 300 764),
    (New-Point 790 512)
)
$g.FillPolygon($white, $play)

# 标注箭头（红色粗线 + 三角箭头，全部用填充）
$redColor = [System.Drawing.ColorTranslator]::FromHtml('#ff4d4f')
$red = New-Object System.Drawing.SolidBrush($redColor)
$line = Get-ThickLinePoints 190 850 780 680 52
$g.FillPolygon($red, $line)
$head = Get-ArrowHeadPoints 190 850 780 680 150
$g.FillPolygon($red, $head)

# 矩形标注边框（蓝色四条粗边）
$blueColor = [System.Drawing.ColorTranslator]::FromHtml('#1677ff')
$blue = New-Object System.Drawing.SolidBrush($blueColor)
$rx = 640; $ry = 90; $rw = 310; $rh = 280; $bw = 44
$g.FillRectangle($blue, $rx, $ry, $rw, $bw)
$g.FillRectangle($blue, $rx, ($ry + $rh - $bw), $rw, $bw)
$g.FillRectangle($blue, $rx, ($ry + $bw), $bw, ($rh - 2 * $bw))
$g.FillRectangle($blue, ($rx + $rw - $bw), ($ry + $bw), $bw, ($rh - 2 * $bw))

$g.Dispose()
$bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "图标已生成：$OutFile"
