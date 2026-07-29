@echo off
title Renew Gen Resources — Seed Database
echo [Battery ERP] Seeding database...
set PYTHONPATH=C:\Users\kabin\OneDrive\Desktop\erp\Lib\site-packages
cd /d "%~dp0backend"
"C:\Python314\python.exe" -c "from app.database import init_db; from app.seed import seed; init_db(); seed()"
echo Done.
pause
