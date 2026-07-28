@echo off
title ONIN Infosys ERP — Clear Database
echo [ONIN Infosys ERP] Resetting SQLite database...

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
%PYTHON_CMD% clear_db.py
echo.
echo [ONIN Infosys ERP] Database cleared and re-initialized with Admin and Staff credentials!
pause
