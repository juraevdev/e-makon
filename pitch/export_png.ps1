$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$pptx = Join-Path $here 'E-MAKON_investor_taqdimoti.pptx'
$out = Join-Path $here 'preview'
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory -Force $out | Out-Null
$app = New-Object -ComObject PowerPoint.Application
try {
    $pres = $app.Presentations.Open($pptx, $true, $false, $false)
    $i = 1
    foreach ($slide in $pres.Slides) {
        $slide.Export((Join-Path $out ('slide{0:D2}.png' -f $i)), 'PNG', 1600, 900)
        $i++
    }
    $pres.Close()
} finally {
    $app.Quit()
}
Get-ChildItem $out | Select-Object -ExpandProperty Name
