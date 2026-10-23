# FinTelligence Backend — local dev startup script (PowerShell)
# Run from inside the backend/ folder:  .\start.ps1

Set-Location $PSScriptRoot

# ── 1. Create venv if it doesn't exist ────────────────────────────────────
if (-not (Test-Path "venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Cyan
    python -m venv venv
}

# ── 2. Activate venv ──────────────────────────────────────────────────────
Write-Host "Activating virtual environment..." -ForegroundColor Cyan
& ".\venv\Scripts\Activate.ps1"

# ── 3. Install / upgrade dependencies ────────────────────────────────────
Write-Host "Installing dependencies..." -ForegroundColor Cyan
pip install -r requirements.txt --quiet

# ── 4. Create runtime directories ────────────────────────────────────────
New-Item -ItemType Directory -Force -Path db, uploads, reports, chroma_db | Out-Null

# ── 5. Start the server ───────────────────────────────────────────────────
Write-Host ""
Write-Host "Starting FinTelligence backend on http://localhost:8000" -ForegroundColor Green
Write-Host "API docs:  http://localhost:8000/docs" -ForegroundColor Green
Write-Host ""
Write-Host "Make sure these two models are already pulled in Ollama:" -ForegroundColor Yellow
Write-Host "  ollama pull llama3.1:8b    (text analysis, metrics extraction, summaries)" -ForegroundColor Yellow
Write-Host "  ollama pull llava-phi3     (vision: scanned PDFs + images)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Change MODEL= and VISION_MODEL= in .env to switch models." -ForegroundColor DarkGray
Write-Host ""

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
