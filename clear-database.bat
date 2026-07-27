@echo off
title Renew Gen Resources Nepal — Clear Database
echo [Renew Gen ERP] Clearing all data from SQLite database...
set PYTHONPATH=C:\Users\kabin\OneDrive\Desktop\erp\Lib\site-packages
cd /d "%~dp0backend"
"C:\Python314\python.exe" -c "from app.clear_db import clear_db; clear_db()"
echo Done.
pause
