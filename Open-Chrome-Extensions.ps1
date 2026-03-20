$extensionFolder = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "Extension folder:" $extensionFolder
Start-Process explorer.exe $extensionFolder
Start-Process "chrome.exe" "chrome://extensions/"
Write-Host "In Chrome: enable Developer mode, click 'Load unpacked', and select the extension folder shown above."
