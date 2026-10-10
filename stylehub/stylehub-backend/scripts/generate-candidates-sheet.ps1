Add-Type -AssemblyName System.Drawing

$tempDir = "C:\Users\admin\.gemini\antigravity-ide\brain\0b0c4162-44d6-403d-b5af-22e656f25bd1\test_candidates"
$outputPath = "C:\Users\admin\.gemini\antigravity-ide\brain\0b0c4162-44d6-403d-b5af-22e656f25bd1\candidates_sheet.png"

$ids = @(9, 10, 14, 20, 21, 22, 23, 24, 32, 36, 38, 40, 50)
$cols = 4
$rows = 4

$cellW = 300
$cellH = 375
$sheetW = $cols * $cellW
$sheetH = $rows * $cellH

$sheetBmp = New-Object System.Drawing.Bitmap($sheetW, $sheetH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($sheetBmp)
$g.Clear([System.Drawing.Color]::White)
$font = New-Object System.Drawing.Font("Arial", 16, [System.Drawing.FontStyle]::Bold)
$brush = [System.Drawing.Brushes]::Black

for ($i = 0; $i -lt $ids.Length; $i++) {
    $id = $ids[$i]
    $r = [Math]::Floor($i / $cols)
    $c = $i % $cols
    $x = $c * $cellW
    $y = $r * $cellH

    $files = Get-ChildItem -Path $tempDir -Filter "candidate_$id.*"
    if ($files.Length -gt 0) {
        $img = [System.Drawing.Image]::FromFile($files[0].FullName)
        
        $scale = [Math]::Min(($cellW - 20) / $img.Width, ($cellH - 40) / $img.Height)
        $drawW = [int]($img.Width * $scale)
        $drawH = [int]($img.Height * $scale)
        $drawX = $x + [int](($cellW - $drawW) / 2)
        $drawY = $y + 30 + [int](($cellH - 40 - $drawH) / 2)

        $srcRect = New-Object System.Drawing.Rectangle(0, 0, $img.Width, $img.Height)
        $dstRect = New-Object System.Drawing.Rectangle($drawX, $drawY, $drawW, $drawH)
        $g.DrawImage($img, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

        $img.Dispose()
    }
    
    $g.DrawString("#$id", $font, $brush, ($x + 10), ($y + 5))
}

$sheetBmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$sheetBmp.Dispose()
Write-Host "Saved candidate sheet to $outputPath"
