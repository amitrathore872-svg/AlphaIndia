
$ROOT_DIR = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "🌐 Starting Alpha India Frontend..." -ForegroundColor Cyan

Set-Location "$ROOT_DIR\frontend"

npm run dev