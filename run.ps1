#Requires -Version 5.1
<#
.SYNOPSIS
  E-Makon local runner - API + Telegram bot in the SAME terminal.

.EXAMPLE
  .\run.ps1                 # API (background) + bot (foreground)
  .\run.ps1 -ApiOnly        # faqat API (foreground)
  .\run.ps1 -BotOnly        # faqat bot
  .\run.ps1 -Setup          # venv + pip + .env + migrate + seed
  .\run.ps1 -NoMigrate      # skip migrate/seed
  .\run.ps1 -Redis          # start Redis via docker compose first
  .\run.ps1 -Port 8000
#>
[CmdletBinding()]
param(
    [switch]$Setup,
    [switch]$ApiOnly,
    [switch]$BotOnly,
    [switch]$NoMigrate,
    [switch]$Redis,
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location $Root

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Ensure-Venv {
    $venvPython = Join-Path $Root ".venv\Scripts\python.exe"
    if (-not (Test-Path $venvPython)) {
        Write-Step "Creating virtualenv (.venv)"
        python -m venv .venv
        if ($LASTEXITCODE -ne 0) { throw "python -m venv failed" }
    }
    return $venvPython
}

function Ensure-EnvFile {
    $envPath = Join-Path $Root ".env"
    $example = Join-Path $Root ".env.example"
    if (-not (Test-Path $envPath)) {
        if (-not (Test-Path $example)) {
            throw ".env and .env.example missing"
        }
        Write-Step "Copying .env.example -> .env"
        Copy-Item $example $envPath
        Write-Host "Fill BOT_TOKEN / EMAKON_BOT_SERVICE_KEY in .env before using the bot." -ForegroundColor Yellow
    }
}

function Test-BotTokenConfigured {
    $envPath = Join-Path $Root ".env"
    if (-not (Test-Path $envPath)) { return $false }
    $line = Get-Content $envPath | Where-Object { $_ -match '^\s*BOT_TOKEN\s*=' } | Select-Object -First 1
    if (-not $line) { return $false }
    $value = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
    return -not [string]::IsNullOrWhiteSpace($value)
}

function Invoke-PipInstall([string]$Python) {
    Write-Step "Installing dependencies"
    & $Python -m pip install --upgrade pip | Out-Host
    & $Python -m pip install -r (Join-Path $Root "requirements.txt") | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "pip install failed" }
}

function Invoke-MigrateSeed([string]$Python) {
    Write-Step "Running migrations"
    & $Python manage.py migrate
    if ($LASTEXITCODE -ne 0) { throw "migrate failed" }

    Write-Step "Seeding catalog"
    & $Python manage.py seed_catalog
    if ($LASTEXITCODE -ne 0) { throw "seed_catalog failed" }
}

function Start-RedisIfRequested {
    if (-not $Redis) { return }
    Write-Step "Starting Redis (docker compose)"
    docker compose up -d redis
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose up redis failed (is Docker running?)"
    }
}

function Start-ApiBackground([string]$Python, [int]$ApiPort) {
    $logDir = Join-Path $Root ".run"
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir | Out-Null
    }
    $outLog = Join-Path $logDir "api.out.log"
    $errLog = Join-Path $logDir "api.err.log"

    $prevSettings = $env:DJANGO_SETTINGS_MODULE
    $env:DJANGO_SETTINGS_MODULE = "config.settings.local"
    try {
        $proc = Start-Process -FilePath $Python `
            -ArgumentList @("manage.py", "runserver", "$ApiPort") `
            -WorkingDirectory $Root `
            -WindowStyle Hidden `
            -RedirectStandardOutput $outLog `
            -RedirectStandardError $errLog `
            -PassThru
    }
    finally {
        if ($null -eq $prevSettings) {
            Remove-Item Env:DJANGO_SETTINGS_MODULE -ErrorAction SilentlyContinue
        }
        else {
            $env:DJANGO_SETTINGS_MODULE = $prevSettings
        }
    }
    return $proc
}

function Stop-ApiProcess($Proc) {
    if ($null -eq $Proc) { return }
    try {
        if (-not $Proc.HasExited) {
            Stop-Process -Id $Proc.Id -Force -ErrorAction SilentlyContinue
            # Also stop child runserver reloader if any
            Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
                Where-Object { $_.CommandLine -match "manage\.py runserver" } |
                ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
        }
    }
    catch {
        # ignore cleanup errors
    }
}

# --- main ---
$python = Ensure-Venv
Ensure-EnvFile

if ($Setup) {
    Invoke-PipInstall $python
    Start-RedisIfRequested
    Invoke-MigrateSeed $python
    Write-Host ""
    Write-Host "Setup complete. Next: .\run.ps1" -ForegroundColor Green
    exit 0
}

& $python -c "import django" 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Invoke-PipInstall $python
}

Start-RedisIfRequested

if (-not $NoMigrate -and -not $BotOnly) {
    Invoke-MigrateSeed $python
}

if ($BotOnly) {
    Write-Step "Starting Telegram bot"
    Write-Host "API must already be running at EMAKON_API_BASE_URL" -ForegroundColor Yellow
    & $python -m bot.main
    exit $LASTEXITCODE
}

if ($ApiOnly) {
    Write-Step "Starting Django API on port $Port"
    Write-Host "Docs http://127.0.0.1:$Port/api/docs/" -ForegroundColor Green
    $env:DJANGO_SETTINGS_MODULE = "config.settings.local"
    & $python manage.py runserver $Port
    exit $LASTEXITCODE
}

# Default: API in background (no new window) + bot in this terminal
Write-Step "Starting API (background) + bot (this window)"
Write-Host "API  http://127.0.0.1:$Port/" -ForegroundColor Green
Write-Host "Docs http://127.0.0.1:$Port/api/docs/" -ForegroundColor Green
Write-Host "API logs: .run\api.out.log / .run\api.err.log" -ForegroundColor DarkGray
Write-Host "Ctrl+C stops bot and API." -ForegroundColor DarkGray

$apiProc = $null
try {
    $apiProc = Start-ApiBackground $python $Port
    Start-Sleep -Seconds 2

    if (-not (Test-BotTokenConfigured)) {
        Write-Host "BOT_TOKEN empty in .env - bot skipped. API keeps running until Ctrl+C." -ForegroundColor Yellow
        Write-Host "Press Ctrl+C to stop API." -ForegroundColor Yellow
        Wait-Process -Id $apiProc.Id
        exit 0
    }

    Write-Step "Starting Telegram bot"
    & $python -m bot.main
    exit $LASTEXITCODE
}
finally {
    Write-Host ""
    Write-Step "Stopping API"
    Stop-ApiProcess $apiProc
}
