@echo off
title Renew Gen Resources ERP — System Launcher
echo =========================================================
echo       Renew Gen Resources ERP System — Local Launcher
echo =========================================================
echo.
echo Launching services...
echo [1/2] Starting Backend API Server (http://127.0.0.1:8000)...
start "Renew Gen ERP Backend Service" cmd /k "%~dp0start-backend.bat"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend UI Portal (http://localhost:3000)...
start "Renew Gen ERP Frontend Portal" cmd /k "%~dp0start-frontend.bat"

echo.
echo =========================================================
echo Services started!
echo - Backend API:  http://127.0.0.1:8000
echo - Frontend UI: http://localhost:3000
echo.
echo Default Logins:
echo - Admin:      renewgenadmin / P@shupat1n@th
echo - Staff:      staff / staff123
echo - Accountant: accountant / accountant123
echo =========================================================
echo.
pause
