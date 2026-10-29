# e-makon: Windows terminalda JAVA_HOME / Flutter PATH bo'lmasa ham ishlashi uchun
$ErrorActionPreference = 'Stop'

$candidates = @(
  'C:\Users\user 3\jdk-17',
  'C:\Program Files\Android\Android Studio\jbr',
  'C:\Program Files\Microsoft\jdk-17*'
)
$javaHome = $null
foreach ($c in $candidates) {
  $resolved = Get-Item $c -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($resolved -and (Test-Path (Join-Path $resolved.FullName 'bin\java.exe'))) {
    $javaHome = $resolved.FullName
    break
  }
}
if (-not $javaHome) {
  Write-Error "Java 17 topilmadi. C:\Users\user 3\jdk-17 o'rnating."
}

$flutterBin = 'C:\Users\user 3\flutter\bin'
if (-not (Test-Path "$flutterBin\flutter.bat")) {
  Write-Error "Flutter topilmadi: $flutterBin"
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = if (Test-Path 'C:\Android\Sdk') { 'C:\Android\Sdk' } else { $env:ANDROID_HOME }
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$flutterBin;$javaHome\bin;$env:ANDROID_HOME\platform-tools;" + $env:Path

Set-Location $PSScriptRoot\..
flutter @args
