Add-Type -AssemblyName System.Drawing

$backendDir = "c:\Users\admin\Downloads\files (7)\stylehub\stylehub-backend\public\images\garments"
$artifactDir = "C:\Users\admin\.gemini\antigravity-ide\brain\0b0c4162-44d6-403d-b5af-22e656f25bd1"

$cols = 5
$rows = 5
$thumbW = 240
$thumbH = 300
$sheetW = $cols * $thumbW
$sheetH = $rows * $thumbH

function Create-Sheet([int]$startId, [int]$endId, [string]$outName) {
    $sheet = New-Object System.Drawing.Bitmap($sheetW, $sheetH)
    $g = [System.Drawing.Graphics]::FromImage($sheet)
    $g.Clear([System.Drawing.Color]::FromArgb(22, 25, 32))
    $font = New-Object System.Drawing.Font("Arial", [float]11, [System.Drawing.FontStyle]::Bold)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(212, 163, 89))
    $brushBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(200, 0, 0, 0))

    for ($id = $startId; $id -le $endId; $id++) {
        $idx = $id - $startId
        $col = [int]($idx % $cols)
        $row = [int][Math]::Floor($idx / $cols)
        $posX = [int]($col * $thumbW)
        $posY = [int]($row * $thumbH)

        $file = Join-Path $backendDir "product_$id.png"
        if (Test-Path $file) {
            $src = [System.Drawing.Image]::FromFile($file)
            $destRect = New-Object System.Drawing.Rectangle(($posX + 5), ($posY + 5), ($thumbW - 10), ($thumbH - 10))
            $g.DrawImage($src, $destRect)
            $src.Dispose()

            # Label
            $labelRect = New-Object System.Drawing.Rectangle(($posX + 8), ($posY + 8), 70, 22)
            $g.FillRectangle($brushBg, $labelRect)
            $g.DrawString("#$id", $font, $brush, [float]($posX + 12), [float]($posY + 10))
        }
    }

    $outPath = Join-Path $artifactDir $outName
    $sheet.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $sheet.Dispose()
    Write-Host "Saved contact sheet: $outPath"
}

Create-Sheet -startId 1 -endId 25 -outName "garments_audit_1_25.png"
Create-Sheet -startId 26 -endId 50 -outName "garments_audit_26_50.png"
