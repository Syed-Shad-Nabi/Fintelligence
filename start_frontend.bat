@echo off
title FinTelligence Frontend
cd "%~dp0frontend"
echo Starting FinTelligence Frontend...
if not exist node_modules (
    echo Installing frontend dependencies...
    call npm install
)
call npm run dev
pause
