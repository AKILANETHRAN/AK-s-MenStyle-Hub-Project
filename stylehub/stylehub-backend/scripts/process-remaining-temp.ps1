Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendRoot = Split-Path -Parent $scriptDir
$projectRoot = Split-Path -Parent $backendRoot
$frontendRoot = Join-Path $projectRoot "stylehub-frontend"

$frontProdDir = Join-Path $frontendRoot "public\images\products"
$backProdDir = Join-Path $backendRoot "public\images\products"
$frontGarmDir = Join-Path $frontendRoot "public\images\garments"
$backGarmDir = Join-Path $backendRoot "public\images\garments"

$targetDisplays = @(15, 16, 28, 55, 58, 60, 74, 99)
$targetGarments = @(1, 33)

foreach ($id in $targetDisplays) {
    $tmpPath = Join-Path $backendRoot "temp_${id}_disp.jpg"
    if (Test-Path $tmpPath) {
        $srcBmp = [System.Drawing.Image]::FromFile($tmpPath)
        $targetW = 600
        $targetH = 750
        $targetRatio = $targetW / $targetH
        $srcRatio = $srcBmp.Width / $srcBmp.Height

        $cropX = 0
        $cropY = 0
        $cropW = $srcBmp.Width
        $cropH = $srcBmp.Height

        if ($srcRatio -gt $targetRatio) {
            $cropW = [int]($srcBmp.Height * $targetRatio)
            $cropX = [int](($srcBmp.Width - $cropW) / 2)
        } else {
            $cropH = [int]($srcBmp.Width / $targetRatio)
            $cropY = [int](($srcBmp.Height - $cropH) / 4)
            if ($cropY + $cropH -gt $srcBmp.Height) {
                $cropY = [int](($srcBmp.Height - $cropH) / 2)
            }
        }

        $destBmp = New-Object System.Drawing.Bitmap($targetW, $targetH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($destBmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

        $srcRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)
        $destRect = New-Object System.Drawing.Rectangle(0, 0, $targetW, $targetH)
        $g.DrawImage($srcBmp, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

        $tFront = Join-Path $frontProdDir "product_$id.png"
        $tBack = Join-Path $backProdDir "product_$id.png"
        $destBmp.Save($tFront, [System.Drawing.Imaging.ImageFormat]::Png)
        $destBmp.Save($tBack, [System.Drawing.Imaging.ImageFormat]::Png)

        $g.Dispose()
        $destBmp.Dispose()
        $srcBmp.Dispose()
        Remove-Item $tmpPath -Force
        Write-Host "Processed fixed display #$id" -ForegroundColor Green
    }
}

foreach ($id in $targetGarments) {
    $tmpPath = Join-Path $backendRoot "temp_${id}_garm.jpg"
    if (Test-Path $tmpPath) {
        $srcBmp = [System.Drawing.Image]::FromFile($tmpPath)
        $targetW = 600
        $targetH = 750
        $padding = 30
        $availW = $targetW - (2 * $padding)
        $availH = $targetH - (2 * $padding)

        $scaleW = $availW / $srcBmp.Width
        $scaleH = $availH / $srcBmp.Height
        $scale = [Math]::Min($scaleW, $scaleH)

        $drawW = [int]($srcBmp.Width * $scale)
        $drawH = [int]($srcBmp.Height * $scale)
        $drawX = [int](($targetW - $drawW) / 2)
        $drawY = [int](($targetH - $drawH) / 2)

        $destBmp = New-Object System.Drawing.Bitmap($targetW, $targetH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($destBmp)
        $g.Clear([System.Drawing.Color]::White)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

        $srcRect = New-Object System.Drawing.Rectangle(0, 0, $srcBmp.Width, $srcBmp.Height)
        $destRect = New-Object System.Drawing.Rectangle($drawX, $drawY, $drawW, $drawH)
        $g.DrawImage($srcBmp, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

        $tFront = Join-Path $frontGarmDir "product_$id.png"
        $tBack = Join-Path $backGarmDir "product_$id.png"
        $destBmp.Save($tFront, [System.Drawing.Imaging.ImageFormat]::Png)
        $destBmp.Save($tBack, [System.Drawing.Imaging.ImageFormat]::Png)

        $g.Dispose()
        $destBmp.Dispose()
        $srcBmp.Dispose()
        Remove-Item $tmpPath -Force
        Write-Host "Processed fixed garment #$id" -ForegroundColor Cyan
    }
}
