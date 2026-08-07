@echo off
rem Emulatorun GERCEK ekran goruntusunu proje klasorune yazar (ekran.png).
rem Pencere kirpmasindan etkilenmez.
cd /d "%~dp0"
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
"%ADB%" exec-out screencap -p > "%~dp0ekran.png"
echo ekran.png yazildi.
timeout /t 2 >nul
