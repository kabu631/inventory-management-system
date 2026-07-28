@echo off
title ONIN Infosys ERP — Seed Database
echo [ONIN Infosys ERP] Seeding sample hardware catalog and 12-month transaction data...

cd /d "%~dp0"

set "PYTHON_CMD="
if exist "%~dp0Scripts\python.exe" set "PYTHON_CMD=%~dp0Scripts\python.exe"
if "%PYTHON_CMD%"=="" if exist "C:\Python314\python.exe" set "PYTHON_CMD=C:\Python314\python.exe"
if "%PYTHON_CMD%"=="" where python >nul 2>&1 && set "PYTHON_CMD=python"
if "%PYTHON_CMD%"=="" where py >nul 2>&1 && set "PYTHON_CMD=py -3"

if "%PYTHON_CMD%"=="" (
    echo [ERROR] Python environment not found! Please install Python 3.10+ or add it to PATH.
    pause
    exit /b 1
)

if exist "%~dp0Lib\site-packages" (
    set "PYTHONPATH=%~dp0Lib\site-packages;%~dp0backend"
) else (
    set "PYTHONPATH=%~dp0backend"
)

cd /d "%~dp0backend"
%PYTHON_CMD% -c "from app.database import init_db; from app.seed import seed; init_db(); seed()"
echo.
echo [ONIN Infosys ERP] Database seeded successfully!
pause
