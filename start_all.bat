@echo off
title FinTelligence - Start All
echo Starting FinTelligence Project (Backend + Frontend)...

:: Start backend in a new command window
start "FinTelligence Backend" cmd /k "call "%~dp0start_backend.bat""

:: Wait a moment to ensure backend starts up before frontend
timeout /t 3 >nul

:: Start frontend in a new command window
start "FinTelligence Frontend" cmd /k "call "%~dp0start_frontend.bat""

echo.
echo Both services are starting up in separate windows.
echo - Backend will be available at http://localhost:8000
echo - Frontend will be available at http://localhost:3000
echo.
pause
