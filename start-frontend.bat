@echo off
title Renew Gen Resources — Frontend
echo [Renew Gen ERP] Starting Next.js frontend on http://localhost:3000 ...
cd /d "%~dp0frontend"
npm run dev
pause
