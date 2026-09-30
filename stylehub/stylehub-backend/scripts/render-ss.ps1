Add-Type -AssemblyName System.Drawing
$dir = "C:\Users\admin\.gemini\antigravity-ide\brain\0b0c4162-44d6-403d-b5af-22e656f25bd1"
$files = Get-ChildItem -Path $dir -Filter "ss_B*.jpg"
$cols = 4
$rows = [Math]::Ceiling($files.Length / $cols)
$cellW = 250
$cellH = 350
$bmp = New-Object System.Drawing.Bitmap($cols * $cellW, $rows * $cellH)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$font = New-Object System.Drawing.Font("Arial", 11, [System.Drawing.FontStyle]::Bold)
$brush = [System.Drawing.Brushes]::Black

for ($i = 0; $i -lt $files.Length; $i++) {
    $f = $files[$i]
    $r = [Math]::Floor($i / $cols)
    $c = $i % $cols
    $x = $c * $cellW
    $y = $r * $cellH
    $img = [System.Drawing.Image]::FromFile($f.FullName)
    $scale = [Math]::Min(($cellW - 20) / $img.Width, ($cellH - 40) / $img.Height)
    $w = [int]($img.Width * $scale)
    $h = [int]($img.Height * $scale)
    $dx = $x + [int](($cellW - $w) / 2)
    $dy = $y + 30 + [int](($cellH - 40 - $h) / 2)
    $g.DrawImage($img, $dx, $dy, $w, $h)
    $img.Dispose()
    $g.DrawString($f.BaseName, $font, $brush, ($x + 10), ($y + 5))
}
$out = "$dir\ss_sheet.png"
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Host "Saved ss_sheet.png"
