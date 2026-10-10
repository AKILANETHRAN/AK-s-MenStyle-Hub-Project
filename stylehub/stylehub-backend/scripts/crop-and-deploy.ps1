param (
    [int]$id,
    [string]$srcPath,
    [double]$cropX = 0,
    [double]$cropY = 0,
    [double]$cropW = 1.0,
    [double]$cropH = 1.0
)

Add-Type -AssemblyName System.Drawing

$backPath = "c:\Users\admin\Downloads\files (7)\stylehub\stylehub-backend\public\images\garments\product_$id.png"
$frontPath = "c:\Users\admin\Downloads\files (7)\stylehub\stylehub-frontend\public\images\garments\product_$id.png"

if (-not (Test-Path $srcPath)) {
    Write-Error "Source file not found: $srcPath"
    exit 1
}

$srcBmp = [System.Drawing.Bitmap]::FromFile($srcPath)

$realX = [int]($srcBmp.Width * $cropX)
$realY = [int]($srcBmp.Height * $cropY)
$realW = [int]($srcBmp.Width * $cropW)
$realH = [int]($srcBmp.Height * $cropH)

# Ensure within bounds
if ($realX + $realW -gt $srcBmp.Width) { $realW = $srcBmp.Width - $realX }
if ($realY + $realH -gt $srcBmp.Height) { $realH = $srcBmp.Height - $realY }

$cropRect = New-Object System.Drawing.Rectangle($realX, $realY, $realW, $realH)
$cropped = $srcBmp.Clone($cropRect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

$targetW = 600
$targetH = 750
$padding = 25
$availW = $targetW - (2 * $padding)
$availH = $targetH - (2 * $padding)

$scaleW = $availW / $cropped.Width
$scaleH = $availH / $cropped.Height
$scale = [Math]::Min($scaleW, $scaleH)

$drawW = [int]($cropped.Width * $scale)
$drawH = [int]($cropped.Height * $scale)
$drawX = [int](($targetW - $drawW) / 2)
$drawY = [int](($targetH - $drawH) / 2)

$dest = New-Object System.Drawing.Bitmap($targetW, $targetH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($dest)
$g.Clear([System.Drawing.Color]::White)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

$srcR = New-Object System.Drawing.Rectangle(0, 0, $cropped.Width, $cropped.Height)
$dstR = New-Object System.Drawing.Rectangle($drawX, $drawY, $drawW, $drawH)
$g.DrawImage($cropped, $dstR, $srcR, [System.Drawing.GraphicsUnit]::Pixel)

$dest.Save($backPath, [System.Drawing.Imaging.ImageFormat]::Png)
$dest.Save($frontPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$dest.Dispose()
$cropped.Dispose()
$srcBmp.Dispose()

Write-Host "Successfully cropped and deployed product_$id.png!" -ForegroundColor Green
