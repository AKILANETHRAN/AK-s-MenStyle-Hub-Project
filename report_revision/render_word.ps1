param(
    [Parameter(Mandatory=$true)][string]$InputPath,
    [Parameter(Mandatory=$true)][string]$OutputPdf
)

$word = $null
$document = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $document = $word.Documents.Open($InputPath, $false, $true)
    $document.ExportAsFixedFormat($OutputPdf, 17)
    if (-not (Test-Path -LiteralPath $OutputPdf)) { throw 'Word did not create the PDF.' }
    Write-Output 'PDF exported.'
} finally {
    if ($document -ne $null) { try { $document.Close(0) } catch {} }
    if ($word -ne $null) { try { $word.Quit() } catch {} }
}
