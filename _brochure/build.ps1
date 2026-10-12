# Renders each brochure page in _brochure/ to a PDF in assets/brochures/ using headless Edge.
# Usage: powershell -ExecutionPolicy Bypass -File _brochure\build.ps1 [name ...]
#   e.g. build.ps1 subs-brochure   (no names = build all)
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Names)
if (-not $Names) { $Names = @("qsoft-brochure", "subs-brochure", "att-company-profile") }

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root "assets\brochures"
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
New-Item -ItemType Directory -Force $outDir | Out-Null

$version = Get-Date -Format "yyyyMMdd-HHmm"
foreach ($name in $Names) {
    $src = Join-Path $PSScriptRoot "$name.html"
    $out = Join-Path $outDir "$name.pdf"
    $url = "file:///" + ($src -replace '\\', '/')
    & $edge --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=10000 "--print-to-pdf=$out" $url 2>$null | Out-Null
    Start-Sleep -Seconds 1
    Get-Item $out | Select-Object Name, Length, LastWriteTime

    # Bump the ?v= tag on site links so browsers fetch the new PDF instead of a cached copy
    Get-ChildItem $root -Filter *.html | ForEach-Object {
        $html = [IO.File]::ReadAllText($_.FullName)
        $updated = [regex]::Replace($html, "assets/brochures/$name\.pdf\?v=[0-9-]+", "assets/brochures/$name.pdf?v=$version")
        if ($updated -ne $html) { [IO.File]::WriteAllText($_.FullName, $updated, (New-Object Text.UTF8Encoding $false)) }
    }
}
