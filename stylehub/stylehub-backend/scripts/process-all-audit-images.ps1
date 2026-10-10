Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Net.Http

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendRoot = Split-Path -Parent $scriptDir
$projectRoot = Split-Path -Parent $backendRoot
$frontendRoot = Join-Path $projectRoot "stylehub-frontend"

$auditUrlsPath = Join-Path $backendRoot "test\verified-audit-urls.json"
$auditJson = Get-Content $auditUrlsPath -Raw | ConvertFrom-Json

$client = New-Object System.Net.Http.HttpClient
$client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
$client.Timeout = [TimeSpan]::FromSeconds(15)

$frontProdDir = Join-Path $frontendRoot "public\images\products"
$backProdDir = Join-Path $backendRoot "public\images\products"
$frontGarmDir = Join-Path $frontendRoot "public\images\garments"
$backGarmDir = Join-Path $backendRoot "public\images\garments"

[System.IO.Directory]::CreateDirectory($frontProdDir) | Out-Null
[System.IO.Directory]::CreateDirectory($backProdDir) | Out-Null
[System.IO.Directory]::CreateDirectory($frontGarmDir) | Out-Null
[System.IO.Directory]::CreateDirectory($backGarmDir) | Out-Null

function Download-And-Process-Display([int]$id, [string]$url) {
    if ([string]::IsNullOrWhiteSpace($url)) {
        Write-Warning "No display URL for #$id"
        return $false
    }
    $targetFront = Join-Path $frontProdDir "product_$id.png"
    $targetBack = Join-Path $backProdDir "product_$id.png"

    try {
        $resp = $client.GetAsync($url).Result
        if (-not $resp.IsSuccessStatusCode) {
            Write-Warning "HTTP $($resp.StatusCode) downloading display for #$id from $url"
            return $false
        }
        $stream = $resp.Content.ReadAsStreamAsync().Result
        $srcBmp = [System.Drawing.Image]::FromStream($stream)

        # Center crop to 600x750 (aspect ratio 0.8)
        $targetW = 600
        $targetH = 750
        $targetRatio = $targetW / $targetH
        $srcRatio = $srcBmp.Width / $srcBmp.Height

        $cropX = 0
        $cropY = 0
        $cropW = $srcBmp.Width
        $cropH = $srcBmp.Height

        if ($srcRatio -gt $targetRatio) {
            # Source is wider than target: crop left & right
            $cropW = [int]($srcBmp.Height * $targetRatio)
            $cropX = [int](($srcBmp.Width - $cropW) / 2)
        } else {
            # Source is taller than target: crop top & bottom
            $cropH = [int]($srcBmp.Width / $targetRatio)
            $cropY = [int](($srcBmp.Height - $cropH) / 4) # slight top bias for fashion models
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

        $destBmp.Save($targetFront, [System.Drawing.Imaging.ImageFormat]::Png)
        $destBmp.Save($targetBack, [System.Drawing.Imaging.ImageFormat]::Png)

        $g.Dispose()
        $destBmp.Dispose()
        $srcBmp.Dispose()
        $stream.Dispose()
        Write-Host "Processed Display Photo #$id -> $targetFront" -ForegroundColor Green
        return $true
    } catch {
        Write-Error "Error processing display photo for #$id : $_"
        return $false
    }
}

function Download-And-Process-Garment([int]$id, [string]$url) {
    if ([string]::IsNullOrWhiteSpace($url)) {
        Write-Warning "No garment URL for #$id"
        return $false
    }
    $targetFront = Join-Path $frontGarmDir "product_$id.png"
    $targetBack = Join-Path $backGarmDir "product_$id.png"

    try {
        $resp = $client.GetAsync($url).Result
        if (-not $resp.IsSuccessStatusCode) {
            Write-Warning "HTTP $($resp.StatusCode) downloading garment for #$id from $url"
            return $false
        }
        $stream = $resp.Content.ReadAsStreamAsync().Result
        $srcBmp = [System.Drawing.Image]::FromStream($stream)

        $targetW = 600
        $targetH = 750
        $padding = 30
        $availW = $targetW - (2 * $padding)
        $availH = $targetH - (2 * $padding)

        # Scale uniformly to fit inside availW x availH
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

        $destBmp.Save($targetFront, [System.Drawing.Imaging.ImageFormat]::Png)
        $destBmp.Save($targetBack, [System.Drawing.Imaging.ImageFormat]::Png)

        $g.Dispose()
        $destBmp.Dispose()
        $srcBmp.Dispose()
        $stream.Dispose()
        Write-Host "Processed Garment Photo #$id -> $targetFront" -ForegroundColor Cyan
        return $true
    } catch {
        Write-Error "Error processing garment photo for #$id : $_"
        return $false
    }
}

# Clean accessories from garments folder (IDs 51 to 100 must NOT have garments)
for ($i = 51; $i -le 100; $i++) {
    $fGarm = Join-Path $frontGarmDir "product_$i.png"
    $bGarm = Join-Path $backGarmDir "product_$i.png"
    if (Test-Path $fGarm) { Remove-Item $fGarm -Force }
    if (Test-Path $bGarm) { Remove-Item $bGarm -Force }
}

Write-Host "Starting batch image processing..." -ForegroundColor Yellow

$ids = 1..100
foreach ($id in $ids) {
    $idStr = "$id"
    $entry = $auditJson.$idStr
    if ($entry) {
        if ($entry.displayUrl) {
            Download-And-Process-Display -id $id -url $entry.displayUrl
        }
        if ($id -le 50 -and $entry.garmentUrl) {
            Download-And-Process-Garment -id $id -url $entry.garmentUrl
        }
    }
}

Write-Host "Image processing complete!" -ForegroundColor Green
