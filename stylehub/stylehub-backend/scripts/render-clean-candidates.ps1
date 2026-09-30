Add-Type -AssemblyName System.Drawing

$candDir = "C:\Users\admin\.gemini\antigravity-ide\brain\0b0c4162-44d6-403d-b5af-22e656f25bd1\clean_candidates"
$outputPath = "C:\Users\admin\.gemini\antigravity-ide\brain\0b0c4162-44d6-403d-b5af-22e656f25bd1\clean_candidates_sheet.png"

$files = Get-ChildItem -Path $candDir -Filter "*.jpg" | Sort-Object Name
$cols = 4
$rows = [Math]::Ceiling($files.Length / $cols)

$cellW = 250
$cellH = 320
$sheetW = $cols * $cellW
$sheetH = $rows * $cellH

$sheetBmp = New-Object System.Drawing.Bitmap($sheetW, $sheetH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($sheetBmp)
$g.Clear([System.Drawing.Color]::White)
$font = New-Object System.Drawing.Font("Arial", 11, [System.Drawing.FontStyle]::Bold)
$brush = [System.Drawing.Brushes]::Black

for ($i = 0; $i -lt $files.Length; $i++) {
    $file = $files[$i]
    $r = [Math]::Floor($i / $cols)
    $c = $i % $cols
    $x = $c * $cellW
    $y = $r * $cellH

    try {
        $img = [System.Drawing.Image]::FromFile($file.FullName)
        $scale = [Math]::Min(($cellW - 16) / $img.Width, ($cellH - 35) / $img.Height)
        $drawW = [int]($img.Width * $scale)
        $drawH = [int]($img.Height * $scale)
        $drawX = $x + [int](($cellW - $drawW) / 2)
        $drawY = $y + 25 + [int](($cellH - 35 - $drawH) / 2)

        $srcRect = New-Object System.Drawing.Rectangle(0, 0, $img.Width, $img.Height)
        $dstRect = New-Object System.Drawing.Rectangle($drawX, $drawY, $drawW, $drawH)
        $g.DrawImage($img, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
        $img.Dispose()
    } catch {}

    $label = $file.BaseName
    $g.DrawString($label, $font, $brush, ($x + 8), ($y + 5))
}

$sheetBmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$sheetBmp.Dispose()
Write-Host "Saved sheet to $outputPath"
