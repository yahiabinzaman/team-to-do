@echo off
title Team To do
cd /d "%~dp0"

:: Check and install dependencies if express, electron-updater, or nodemailer is missing
if not exist "node_modules\express\" goto install_deps
if not exist "node_modules\electron-updater\" goto install_deps
if not exist "node_modules\nodemailer\" goto install_deps
goto launch_app

:install_deps
echo ========================================================
echo  Installing required packages for Team To do...
echo  (This happens on first run or after an update)
echo ========================================================
call npm install --no-audit --no-fund

:launch_app
:: Launch the native frameless Electron desktop widget (starts internal server automatically)
call npx electron electron-main.js
