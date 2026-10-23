# Run backend WITHOUT venv (uses system Python)
# Fix for: venv was created in old folder (gayesahangay) and has broken paths

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# Install deps if needed (run once)
Write-Host "Checking dependencies..." -ForegroundColor Cyan
& python -m pip install -r requirements.txt -q 2>$null

# Create dirs
New-Item -ItemType Directory -Force -Path db, uploads, reports, chroma_db | Out-Null

Write-Host "Starting backend on http://localhost:8000" -ForegroundColor Green
& python -m uvicorn main:app --host 0.0.0.0 --port 8000
