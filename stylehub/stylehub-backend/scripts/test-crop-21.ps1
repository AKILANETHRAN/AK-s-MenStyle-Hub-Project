Add-Type -AssemblyName System.Drawing

$file = "c:\Users\admin\Downloads\files (7)\stylehub\stylehub-backend\public\images\garments\product_21.png"
$bmp = [System.Drawing.Bitmap]::FromFile($file)

# Inspect dimensions
$w = $bmp.Width
$h = $bmp.Height

# The model's shirt is at the very top (Y=0 to Y=0.10)
# The shoes are at the very bottom (Y=0.88 to Y=1.0)
$cropY = [int]($h * 0.08)
$cropH = [int]($h * 0.82)
$cropX = [int]($w * 0.10)
$cropW = [int]($w * 0.80)

$cropRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)
$croppedBmp = $bmp.Clone($cropRect, $bmp.PixelFormat)

$targetPath = "C:\Users\admin\.gemini\antigravity-ide\brain\0b0c4162-44d6-403d-b5af-22e656f25bd1\crop_test_21.png"
$croppedBmp.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)

$bmp.Dispose()
$croppedBmp.Dispose()

Write-Host "Saved crop test 21 to $targetPath"
