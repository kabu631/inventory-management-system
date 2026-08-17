@echo off
title Renew Gen Resources — Seed Database
echo [Battery ERP] Seeding database...
cd /d "%~dp0backend"
"%~dp0backend\venv\Scripts\python.exe" -c "from app.database import init_db; from app.seed import seed; init_db(); seed()"
echo Done.
pause
