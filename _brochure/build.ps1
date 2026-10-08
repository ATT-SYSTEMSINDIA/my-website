# Renders each brochure page in _brochure/ to a PDF in assets/brochures/ using headless Edge.
# Usage: powershell -ExecutionPolicy Bypass -File _brochure\build.ps1 [name ...]
#   e.g. build.ps1 subs-brochure   (no names = build all)
param([string[]]$Names = @("qsoft-brochure", "subs-brochure", "att-company-profile"))

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root "assets\brochures"
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
New-Item -ItemType Directory -Force $outDir | Out-Null

foreach ($name in $Names) {
    $src = Join-Path $PSScriptRoot "$name.html"
    $out = Join-Path $outDir "$name.pdf"
    $url = "file:///" + ($src -replace '\\', '/')
    & $edge --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=10000 "--print-to-pdf=$out" $url 2>$null | Out-Null
    Start-Sleep -Seconds 1
    Get-Item $out | Select-Object Name, Length, LastWriteTime
}
