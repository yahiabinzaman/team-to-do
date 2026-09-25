# Team To-Do - Windows 1-Line PowerShell Installer
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " Installing Team To-Do Desktop Widget on Windows..." -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$InstallDir = "$HOME\Team-To-Do"

if (Test-Path $InstallDir) {
    Write-Host "Updating existing installation in $InstallDir..." -ForegroundColor Yellow
    Set-Location $InstallDir
    git pull origin main
} else {
    Write-Host "Cloning repository to $InstallDir..." -ForegroundColor Green
    git clone https://github.com/yahiabinzaman/team-to-do.git $InstallDir
    Set-Location $InstallDir
}

Write-Host "Installing dependencies..." -ForegroundColor Green
npm install

Write-Host "Configuring Windows Startup..." -ForegroundColor Green
cmd /c setup-windows-autostart.bat

Write-Host "Launching Team To-Do Widget..." -ForegroundColor Green
Start-Process -FilePath "cmd.exe" -ArgumentList "/c start-windows.bat" -WindowStyle Hidden

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " [SUCCESS] Team To-Do installed and running!" -ForegroundColor Green
Write-Host " It will launch automatically whenever you login." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
