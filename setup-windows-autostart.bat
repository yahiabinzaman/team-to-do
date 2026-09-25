@echo off
:: Windows Auto-Start Setup for Apple Team Widget
title Apple Team Widget - Windows Startup Setup
cd /d "%~dp0"

echo ========================================================
echo  Configuring Windows Auto-Run on Login for Team Widget
echo ========================================================

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS_FILE=%STARTUP_FOLDER%\LaunchTeamWidget.vbs"

echo Creating silent auto-start launcher in %STARTUP_FOLDER%...

(
echo Set WshShell = CreateObject("WScript.Shell"^)
echo WshShell.CurrentDirectory = "%~dp0"
echo WshShell.Run "cmd /c start-windows.bat", 0, False
) > "%VBS_FILE%"

echo.
echo [SUCCESS] Windows Auto-run configured!
echo The widget will automatically launch seamlessly in the background whenever you boot or login to Windows.
echo.
pause
