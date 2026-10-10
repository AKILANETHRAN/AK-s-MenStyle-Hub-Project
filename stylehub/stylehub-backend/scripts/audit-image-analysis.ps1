Add-Type -AssemblyName System.Drawing

$backendDir = "c:\Users\admin\Downloads\files (7)\stylehub\stylehub-backend\public\images\garments"
$output = @()

for ($i = 1; $i -le 50; $i++) {
    $file = Join-Path $backendDir "product_$i.png"
    if (-not (Test-Path $file)) {
        $output += [PSCustomObject]@{ ID = $i; Status = "MISSING" }
        continue
    }

    $bmp = [System.Drawing.Bitmap]::FromFile($file)
    $w = $bmp.Width
    $h = $bmp.Height

    # Find bounding box of non-white pixels (threshold < 245 in R, G, or B)
    $minX = $w; $maxX = 0; $minY = $h; $maxY = 0;
    $nonWhiteCount = 0

    # Also sample a vertical centerline through the middle (X = w/2)
    # If the centerline has a huge gap of pure white in the middle, it's two garments side-by-side!
    $centerVerticalWhite = 0
    $centerTotal = 0

    # Sample horizontal strip at Y = h/2 across X
    # If X near center has white while left and right have clothing, it is a dual-view image (front & back)!
    $midY = [int]($h / 2)
    $leftHasContent = $false
    $centerHasContent = $false
    $rightHasContent = $false

    for ($y = 0; $y -lt $h; $y += 5) {
        for ($x = 0; $x -lt $w; $x += 5) {
            $px = $bmp.GetPixel($x, $y)
            $isNotWhite = ($px.R -lt 245 -or $px.G -lt 245 -or $px.B -lt 245) -and ($px.A -gt 10)
            if ($isNotWhite) {
                $nonWhiteCount++
                if ($x -lt $minX) { $minX = $x }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($y -gt $maxY) { $maxY = $y }

                if ($y -gt [int]($h * 0.3) -and $y -lt [int]($h * 0.7)) {
                    if ($x -lt [int]($w * 0.35)) { $leftHasContent = $true }
                    if ($x -gt [int]($w * 0.45) -and $x -lt [int]($w * 0.55)) { $centerHasContent = $true }
                    if ($x -gt [int]($w * 0.65)) { $rightHasContent = $true }
                }
            }
        }
    }

    # Detect if dual view: content on left, content on right, but hollow in the middle!
    $isDualView = $leftHasContent -and $rightHasContent -and (-not $centerHasContent)

    $boxW = $maxX - $minX
    $boxH = $maxY - $minY
    $fillRatio = [math]::Round($nonWhiteCount / (($w/5) * ($h/5)), 3)

    $bmp.Dispose()

    $output += [PSCustomObject]@{
        ID = $i
        Width = $w
        Height = $h
        BBox = "$minX,$minY to $maxX,$maxY"
        BBoxW = $boxW
        BBoxH = $boxH
        FillRatio = $fillRatio
        IsDualView = $isDualView
    }
}

$output | Format-Table -AutoSize
