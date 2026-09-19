# e-makon: Windows terminalda JAVA_HOME bo'lmasa ham ishlashi uchun
$ErrorActionPreference = 'Stop'
$javaHome = 'C:\Program Files\Android\Android Studio\jbr'
if (-not (Test-Path "$javaHome\bin\java.exe")) {
  Write-Error "Java topilmadi: $javaHome"
}
$env:JAVA_HOME = $javaHome
$env:Path = "$javaHome\bin;" + $env:Path
Set-Location $PSScriptRoot\..
flutter @args
