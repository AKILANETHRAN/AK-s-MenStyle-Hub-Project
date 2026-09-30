Add-Type -AssemblyName System.Drawing

$backendDir = "c:\Users\admin\Downloads\files (7)\stylehub\stylehub-backend\public\images\garments"

for ($i = 1; $i -le 50; $i++) {
    $file = Join-Path $backendDir "product_$i.png"
    if (-not (Test-Path $file)) {
        Write-Host "Product $i : MISSING" -ForegroundColor Red
        continue
    }
    
    $bmp = [System.Drawing.Bitmap]::FromFile($file)
    $w = $bmp.Width
    $h = $bmp.Height
    
    # Sample corners for background color
    $cTL = $bmp.GetPixel(5, 5)
    $cTR = $bmp.GetPixel($w - 5, 5)
    $cBL = $bmp.GetPixel(5, $h - 5)
    $cBR = $bmp.GetPixel($w - 5, $h - 5)
    
    # Sample center
    $cCenter = $bmp.GetPixel([int]($w/2), [int]($h/2))
    
    $bmp.Dispose()
    
    Write-Host "Product $i : Size=${w}x${h} | BG=($($cTL.R),$($cTL.G),$($cTL.B)) | Center=($($cCenter.R),$($cCenter.G),$($cCenter.B))"
}
