@echo off
title Team To do
cd /d "%~dp0"

:: Check and install dependencies if express is missing
if not exist "node_modules\express\" (
    echo ========================================================
    echo  Installing required packages for Team To do...
    echo  (This only happens on first run and takes ~20 seconds)
    echo ========================================================
    call npm install --no-audit --no-fund
)

:: Start the background real-time sync server
start /b "" node server.js

:: Launch the native frameless Electron desktop widget
call npx electron electron-main.js
