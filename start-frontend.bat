@echo off
title Renew Gen Resources — Frontend
SET "PATH=C:\Program Files\nodejs;%PATH%"
echo [Renew Gen ERP] Starting Next.js frontend on http://localhost:3000 ...
cd /d "%~dp0frontend"
npm run dev
pause
