# Java 17 Installation and Configuration Script
# Run this script in PowerShell as Administrator

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Java 17 Installation for React Native" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "⚠️  This script needs to be run as Administrator" -ForegroundColor Yellow
    Write-Host "   Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit
}

# Check if Chocolatey is installed
Write-Host "Checking for Chocolatey package manager..." -ForegroundColor Yellow
$chocoInstalled = Get-Command choco -ErrorAction SilentlyContinue

if (-not $chocoInstalled) {
    Write-Host "Installing Chocolatey..." -ForegroundColor Green
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    
    # Refresh environment
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

Write-Host "✓ Chocolatey is ready" -ForegroundColor Green
Write-Host ""

# Install Java 17
Write-Host "Installing Microsoft OpenJDK 17..." -ForegroundColor Yellow
choco install microsoft-openjdk17 -y

# Refresh environment variables
Write-Host "Refreshing environment variables..." -ForegroundColor Yellow
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Set JAVA_HOME
$javaPath = "C:\Program Files\Microsoft\jdk-17.0.13.11-hotspot"
if (Test-Path $javaPath) {
    Write-Host "Setting JAVA_HOME environment variable..." -ForegroundColor Yellow
    [System.Environment]::SetEnvironmentVariable("JAVA_HOME", $javaPath, "Machine")
    $env:JAVA_HOME = $javaPath
    Write-Host "✓ JAVA_HOME set to: $javaPath" -ForegroundColor Green
} else {
    # Try to find Java 17 installation
    $possiblePaths = @(
        "C:\Program Files\Microsoft\jdk-*",
        "C:\Program Files\Java\jdk-17*",
        "C:\Program Files\OpenJDK\jdk-17*"
    )
    
    foreach ($pattern in $possiblePaths) {
        $found = Get-ChildItem -Path (Split-Path $pattern) -Filter (Split-Path $pattern -Leaf) -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) {
            $javaPath = $found.FullName
            [System.Environment]::SetEnvironmentVariable("JAVA_HOME", $javaPath, "Machine")
            $env:JAVA_HOME = $javaPath
            Write-Host "✓ JAVA_HOME set to: $javaPath" -ForegroundColor Green
            break
        }
    }
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Close this PowerShell window" -ForegroundColor White
Write-Host "2. Open a NEW PowerShell window" -ForegroundColor White
Write-Host "3. Run: java -version" -ForegroundColor White
Write-Host "   (Should show Java 17)" -ForegroundColor Gray
Write-Host "4. Navigate to your project:" -ForegroundColor White
Write-Host "   cd d:\job\app\sensors\smart-stim-app" -ForegroundColor Gray
Write-Host "5. Run: npm run android" -ForegroundColor White
Write-Host ""
Write-Host "Press Enter to exit..."
Read-Host
