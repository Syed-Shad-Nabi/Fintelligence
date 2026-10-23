$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$analystModelfile = Join-Path $root "models/Modelfile.fintel-analyst"
$visionModelfile = Join-Path $root "models/Modelfile.fintel-vision"

Write-Host "Creating local FinTelligence models..."
ollama create fintel-analyst:final -f $analystModelfile
ollama create fintel-vision:final -f $visionModelfile

Write-Host "`nAvailable models:"
ollama list

Write-Host "`nDone. Use these in your environment:"
Write-Host "  LLM_MODEL=fintel-analyst:final"
Write-Host "  VISION_MODEL=fintel-vision:final"
