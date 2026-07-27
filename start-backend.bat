@echo off
title Renew Gen Resources Nepal — Backend
echo [Renew Gen ERP] Starting FastAPI backend on http://127.0.0.1:8000 ...
set PYTHONPATH=C:\Users\kabin\OneDrive\Desktop\erp\Lib\site-packages
cd /d "%~dp0backend"
"C:\Python314\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
pause
