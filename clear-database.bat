@echo off
title Renew Gen Resources — Clear Database
echo [Renew Gen ERP] Clearing all data from SQLite database...
cd /d "%~dp0backend"
"%~dp0backend\venv\Scripts\python.exe" -c "from app.clear_db import clear_db; clear_db()"
echo Done.
pause
