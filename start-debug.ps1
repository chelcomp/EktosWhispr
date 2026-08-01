<#
.SYNOPSIS
    Starts EktosWhispr in development mode with debug logging enabled.

.DESCRIPTION
    Sets EKTOSWHISPR_LOG_LEVEL=debug and runs 'npm run dev'.
    Reports the current git commit hash for version verification.

.NOTES
    Requires Node 26 (per .nvmrc). Run from repository root.
#>

param(
    [switch]$NoCompile = $false
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  EktosWhispr - Debug Mode Launcher" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Show git commit hash for version verification
$gitHash = git log -1 --format="%H %s" 2>$null
if ($gitHash) {
    Write-Host "Git commit: $gitHash" -ForegroundColor Green
} else {
    Write-Host "Warning: Not a git repository or git not available" -ForegroundColor Yellow
}

# Set debug log level
$env:EKTOSWHISPR_LOG_LEVEL = "debug"
Write-Host "EKTOSWHISPR_LOG_LEVEL = $env:EKTOSWHISPR_LOG_LEVEL" -ForegroundColor Green

# Ensure we're in the right directory
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $repoRoot
Write-Host "Working directory: $(Get-Location)" -ForegroundColor Gray

# Check Node version
$nodeVersion = node --version 2>$null
if ($nodeVersion) {
    Write-Host "Node version: $nodeVersion" -ForegroundColor Gray
    if (-not $nodeVersion.StartsWith("v26")) {
        Write-Host "Warning: Node 26 expected (per .nvmrc), found $nodeVersion" -ForegroundColor Yellow
    }
} else {
    Write-Host "Error: Node not found in PATH" -ForegroundColor Red
    exit 1
}

# Run npm install if node_modules missing
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "npm install failed" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

# Compile native binaries unless -NoCompile flag
if (-not $NoCompile) {
    Write-Host "Compiling native binaries..." -ForegroundColor Yellow
    npm run compile:native
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Native compile failed" -ForegroundColor Red
        exit $LASTEXITCODE
    }
    Write-Host "Downloading runtime binaries..." -ForegroundColor Yellow
    npm run download:whisper-cpp
    npm run download:llama-server
    npm run download:sherpa-onnx
    npm run download:meeting-aec-helper
    npm run download:whisper-vad-model
    npm run download:diarization-models -- --output-dir resources/bin/diarization-models
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Binary download failed" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

Write-Host ""
Write-Host "Starting EktosWhispr in debug mode..." -ForegroundColor Cyan
Write-Host "Logs will appear below and in:" -ForegroundColor Gray
Write-Host "  %APPDATA%\EktosWhispr-development\logs\debug-*.log" -ForegroundColor Gray
Write-Host ""

# Run the app
npm run dev

# Exit with same code as npm
exit $LASTEXITCODE