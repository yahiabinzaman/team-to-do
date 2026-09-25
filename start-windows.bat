@echo off
title Team To do
cd /d "%~dp0"

:: Ensure dependencies are installed
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install --no-audit --no-fund
)

:: Start the background real-time sync server
start /b "" node server.js

:: Launch the native frameless Electron desktop widget
call npx electron electron-main.js
