
Write-Host ""
Write-Host "🚀 Starting Alpha India Backend..." -ForegroundColor Green

Set-Location "$PSScriptRoot\backend"

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

& "$PSScriptRoot\.venv\Scripts\Activate.ps1"

python -m uvicorn main:app --reload