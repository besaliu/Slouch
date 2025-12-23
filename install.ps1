# Slouch Ghost Installer for Windows
# Usage: irm https://raw.githubusercontent.com/besaliu/Slouch/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

$AppName = "Slouch Ghost"
$Version = "0.1.1"
$InstallerUrl = "https://github.com/besaliu/Slouch/releases/download/v$Version/Slouch.Ghost_${Version}_x64-setup.exe"
$InstallerName = "SlouchGhost-Setup.exe"
$TempPath = "$env:TEMP\$InstallerName"

function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "                    Slouch Ghost Installer                        " -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Check if Windows
if ($env:OS -ne "Windows_NT") {
    Write-Host "Error: This installer is for Windows only." -ForegroundColor Red
    Write-Host "For macOS, use: curl -fsSL https://raw.githubusercontent.com/besaliu/Slouch/main/install.sh | bash"
    exit 1
}

# Download installer
Write-Host "[1/3] " -NoNewline -ForegroundColor Blue
Write-Host "Downloading Slouch Ghost v$Version..."

try {
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $InstallerUrl -OutFile $TempPath -UseBasicParsing
    Write-Host "      Downloaded successfully" -ForegroundColor Green
} catch {
    Write-Host "      Error: Failed to download installer." -ForegroundColor Red
    Write-Host "      Please check your internet connection and try again."
    exit 1
}

# Run installer
Write-Host "[2/3] " -NoNewline -ForegroundColor Blue
Write-Host "Running installer..."
Write-Host "      Follow the installation wizard to complete setup." -ForegroundColor Yellow

try {
    Start-Process -FilePath $TempPath -Wait
    Write-Host "      Installation complete" -ForegroundColor Green
} catch {
    Write-Host "      Error: Failed to run installer." -ForegroundColor Red
    exit 1
}

# Cleanup
Write-Host "[3/3] " -NoNewline -ForegroundColor Blue
Write-Host "Cleaning up..."
Remove-Item -Path $TempPath -Force -ErrorAction SilentlyContinue
Write-Host "      Done" -ForegroundColor Green

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "      Slouch Ghost has been installed successfully!               " -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "      Launch Slouch Ghost from your Start Menu or Desktop."
Write-Host ""
Write-Host "      Privacy Note: " -NoNewline -ForegroundColor Blue
Write-Host "All posture detection happens locally."
Write-Host "      Your camera feed never leaves your device."
Write-Host ""
