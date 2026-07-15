@echo off
setlocal
cd /d "%~dp0"
title Upgrader Game

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed.
  echo Download and install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules\" goto first_run
if not exist ".next\BUILD_ID" goto rebuild
if not exist ".last-build-version" goto rebuild
fc /b "BUILD_VERSION.txt" ".last-build-version" >nul 2>nul
if errorlevel 1 goto rebuild
goto launch

:first_run
echo [1/2] Installing dependencies...
call npm install
if errorlevel 1 goto failed

:rebuild
echo [2/2] Building the latest All Modes version...
call npm run build
if errorlevel 1 goto failed
copy /y "BUILD_VERSION.txt" ".last-build-version" >nul

:launch
echo Starting the game at http://localhost:3000
start "Upgrader Browser" powershell -NoProfile -WindowStyle Hidden -Command "$url='http://localhost:3000'; for($i=0;$i -lt 90;$i++){ try { $r=Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 1; if($r.StatusCode -ge 200){ Start-Process $url; exit } } catch {}; Start-Sleep -Seconds 1 }; Start-Process $url"
call npm start
exit /b %errorlevel%

:failed
echo.
echo [ERROR] Setup failed. Review the messages above.
pause
exit /b 1
