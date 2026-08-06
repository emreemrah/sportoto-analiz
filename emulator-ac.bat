@echo off
rem Expo Go'yu DOGRU adresle yeniden acar. Hata ekranindaki "reload" eski
rem adresi (LAN IP) tekrar denedigi icin gerekli.
cd /d "%~dp0"
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
"%ADB%" reverse tcp:8082 tcp:8082
"%ADB%" reverse tcp:4000 tcp:4000
"%ADB%" shell am force-stop host.exp.exponent
timeout /t 2 >nul
"%ADB%" shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:8082"
echo Acildi.
timeout /t 5 >nul
