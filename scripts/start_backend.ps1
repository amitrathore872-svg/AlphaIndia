
$ROOT_DIR = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "🚀 Starting Alpha India Backend..." -ForegroundColor Green

Set-Location "$ROOT_DIR\backend"

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

& "$ROOT_DIR\.venv\Scripts\Activate.ps1"

python -m uvicorn main:app --reload