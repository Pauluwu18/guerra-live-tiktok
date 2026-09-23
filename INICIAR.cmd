@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Necesitas Node.js 20 o superior para ejecutar el juego.
 pause
 exit /b 1
)
if not exist node_modules\tiktok-live-connector (
 call npm install --cache .npm-cache
 if errorlevel 1 (
  pause
  exit /b 1
 )
)
start "" http://127.0.0.1:4173
node --max-old-space-size=128 --optimize-for-size server.mjs
pause
