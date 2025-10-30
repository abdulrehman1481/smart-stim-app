# Quick Connect to Your Phone Wirelessly
# Save this file as: connect-phone.ps1

$PHONE_IP = "10.7.78.43"  # Your phone's IP address
$ADB = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

Write-Host "Connecting to phone at $PHONE_IP..." -ForegroundColor Cyan

& $ADB connect "${PHONE_IP}:5555"

Write-Host "`nChecking connection..." -ForegroundColor Cyan
& $ADB devices

Write-Host "`nDone! Your phone is connected wirelessly." -ForegroundColor Green
Write-Host "You can now run: npx expo run:android" -ForegroundColor Yellow
