@echo off
title Team To do
cd /d "%~dp0"

:: Start the background real-time sync server
start /b "" node server.js

:: Launch the native frameless Electron desktop widget
npx electron electron-main.js

