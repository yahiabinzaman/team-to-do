# Team To do - Windows 1-Line Universal PowerShell Installer
# Requires NO pre-installed Git or Node.js - Handles everything automatically!

$ErrorActionPreference = "Continue"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " Installing Team To do Desktop Widget on Windows..." -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$InstallDir = "$HOME\Team-To-Do"
$ZipPath = "$env:TEMP\team-to-do.zip"
$ExtractTemp = "$env:TEMP\team-to-do-extract"

# --- 1. Check and Install Node.js if missing ---
$hasNode = Get-Command node -ErrorAction SilentlyContinue

if (-not $hasNode) {
    Write-Host "[1/4] Node.js is missing. Installing Node.js LTS automatically..." -ForegroundColor Yellow
    
    $hasWinget = Get-Command winget -ErrorAction SilentlyContinue
    $installedViaWinget = $false

    if ($hasWinget) {
        try {
            Write-Host "Installing via Windows Package Manager (winget)..." -ForegroundColor Gray
            & winget install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements | Out-Null
            $installedViaWinget = $true
        } catch {}
    }

    if (-not $installedViaWinget) {
        Write-Host "Downloading Node.js official installer..." -ForegroundColor Gray
        $nodeMsi = "$env:TEMP\nodejs-lts.msi"
        $nodeUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi"
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi -UseBasicParsing
        Write-Host "Running silent installation..." -ForegroundColor Gray
        Start-Process msiexec.exe -ArgumentList "/i `"$nodeMsi`" /qn /norestart" -Wait
        Remove-Item $nodeMsi -Force -ErrorAction SilentlyContinue
    }

    # Refresh PATH in current session
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath;C:\Program Files\nodejs"
    
    Write-Host "[OK] Node.js installed successfully!" -ForegroundColor Green
} else {
    Write-Host "[1/4] Node.js is already installed." -ForegroundColor Green
}

# --- 2. Download Project Code (No Git required) ---
Write-Host "[2/4] Downloading latest Team To do application files..." -ForegroundColor Cyan

if (Test-Path $ExtractTemp) { Remove-Item $ExtractTemp -Recurse -Force -ErrorAction SilentlyContinue }
if (-not (Test-Path $InstallDir)) { New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null }

$repoZipUrl = "https://github.com/yahiabinzaman/team-to-do/archive/refs/heads/main.zip"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $repoZipUrl -OutFile $ZipPath -UseBasicParsing

Expand-Archive -Path $ZipPath -DestinationPath $ExtractTemp -Force
$unzippedFolder = Join-Path $ExtractTemp "team-to-do-main"

if (Test-Path $unzippedFolder) {
    Copy-Item -Path "$unzippedFolder\*" -Destination $InstallDir -Recurse -Force
} else {
    Copy-Item -Path "$ExtractTemp\*" -Destination $InstallDir -Recurse -Force
}

Remove-Item $ZipPath -Force -ErrorAction SilentlyContinue
Remove-Item $ExtractTemp -Recurse -Force -ErrorAction SilentlyContinue

Set-Location $InstallDir
Write-Host "[OK] Files installed in $InstallDir" -ForegroundColor Green

# --- 3. Install NPM Dependencies (using cmd.exe to prevent any PowerShell ExecutionPolicy issue) ---
Write-Host "[3/4] Installing application dependencies (this takes ~30 seconds)..." -ForegroundColor Cyan
& cmd.exe /c "call npm install --no-audit --no-fund"

# --- 4. Configure Windows Startup & Launch ---
Write-Host "[4/4] Setting up Windows Auto-start and launching widget..." -ForegroundColor Cyan

# Create silent VBS startup launcher
$startupFolder = [System.Environment]::GetFolderPath("Startup")
$vbsFile = Join-Path $startupFolder "LaunchTeamToDo.vbs"
$vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "$InstallDir"
WshShell.Run "cmd /c start-windows.bat", 0, False
"@
Set-Content -Path $vbsFile -Value $vbsContent -Encoding ASCII

# Start the widget now
Start-Process -FilePath "cmd.exe" -ArgumentList "/c start-windows.bat" -WorkingDirectory $InstallDir -WindowStyle Hidden

Write-Host "========================================================" -ForegroundColor Green
Write-Host " [SUCCESS] Team To do is now running on your Desktop!" -ForegroundColor Green
Write-Host " It will launch automatically whenever you login." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
