param (
    [int]$id,
    [string]$srcPath
)

Add-Type -AssemblyName System.Drawing

$backPath = "c:\Users\admin\Downloads\files (7)\stylehub\stylehub-backend\public\images\garments\product_$id.png"
$frontPath = "c:\Users\admin\Downloads\files (7)\stylehub\stylehub-frontend\public\images\garments\product_$id.png"

if (-not (Test-Path $srcPath)) {
    Write-Error "Source file not found: $srcPath"
    exit 1
}

$src = [System.Drawing.Image]::FromFile($srcPath)
$targetW = 600
$targetH = 750
$padding = 25
$availW = $targetW - (2 * $padding)
$availH = $targetH - (2 * $padding)

$scaleW = $availW / $src.Width
$scaleH = $availH / $src.Height
$scale = [Math]::Min($scaleW, $scaleH)

$drawW = [int]($src.Width * $scale)
$drawH = [int]($src.Height * $scale)
$drawX = [int](($targetW - $drawW) / 2)
$drawY = [int](($targetH - $drawH) / 2)

$dest = New-Object System.Drawing.Bitmap($targetW, $targetH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($dest)
$g.Clear([System.Drawing.Color]::White)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

$srcRect = New-Object System.Drawing.Rectangle(0, 0, $src.Width, $src.Height)
$destRect = New-Object System.Drawing.Rectangle($drawX, $drawY, $drawW, $drawH)
$g.DrawImage($src, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

$dest.Save($backPath, [System.Drawing.Imaging.ImageFormat]::Png)
$dest.Save($frontPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$dest.Dispose()
$src.Dispose()

Write-Host "Successfully standardized and deployed product_$id.png to backend and frontend!" -ForegroundColor Green
