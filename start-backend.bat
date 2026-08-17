@echo off
title Renew Gen Resources — Backend
echo [Renew Gen ERP] Starting FastAPI backend on http://127.0.0.1:8000 ...
cd /d "%~dp0backend"
"%~dp0backend\venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
pause
