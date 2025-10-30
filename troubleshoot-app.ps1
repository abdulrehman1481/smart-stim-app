# App Troubleshooting Script
$ADB = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

Write-Host "=== Smart Stim App Troubleshooting ===" -ForegroundColor Cyan
Write-Host ""

# Check device connection
Write-Host "1. Checking device connection..." -ForegroundColor Yellow
& $ADB devices
Write-Host ""

# Check if app is installed
Write-Host "2. Checking if app is installed..." -ForegroundColor Yellow
$appInstalled = & $ADB shell pm list packages | Select-String "smartstimapp"
if ($appInstalled) {
    Write-Host "✓ App is installed: $appInstalled" -ForegroundColor Green
} else {
    Write-Host "✗ App is NOT installed" -ForegroundColor Red
}
Write-Host ""

# Check app permissions
Write-Host "3. Checking app permissions..." -ForegroundColor Yellow
& $ADB shell dumpsys package com.abrehman.smartstimapp | Select-String -Pattern "permission" | Select-Object -First 20
Write-Host ""

# Clear logcat
Write-Host "4. Clearing old logs..." -ForegroundColor Yellow
& $ADB logcat -c
Write-Host "✓ Logs cleared" -ForegroundColor Green
Write-Host ""

# Launch app
Write-Host "5. Launching app..." -ForegroundColor Yellow
& $ADB shell am start -n com.abrehman.smartstimapp/.MainActivity
Start-Sleep -Seconds 3
Write-Host ""

# Check recent logs
Write-Host "6. Checking app logs (last 5 seconds)..." -ForegroundColor Yellow
Write-Host "---" -ForegroundColor Gray
& $ADB logcat -d -s "ReactNativeJS:*" -s "BLE:*" -s "Expo:*" | Select-Object -Last 50
Write-Host "---" -ForegroundColor Gray
Write-Host ""

Write-Host "=== Troubleshooting Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "What do you see on your phone?" -ForegroundColor Yellow
Write-Host "1. Gray screen - App might be crashing"
Write-Host "2. White screen - App is loading"
Write-Host "3. Blue header with 'Smart Stim Controller' - App is working!"
Write-Host ""
