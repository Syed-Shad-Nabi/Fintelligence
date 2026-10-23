@echo off
title FinTelligence Backend
cd "%~dp0backend"
echo Starting FinTelligence Backend...
powershell -ExecutionPolicy Bypass -File .\start.ps1
pause
