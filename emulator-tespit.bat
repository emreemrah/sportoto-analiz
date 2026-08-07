@echo off
rem TESPIT-3: Metro ayakta mi, Expo Go surumu ne, hata satiri ne?
cd /d "%~dp0"
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
set OUT=emulator-durum.txt
> "%OUT%" echo === METRO 8082 DINLIYOR MU ===
netstat -ano | findstr ":8082" >> "%OUT%" 2>&1
>> "%OUT%" echo.
>> "%OUT%" echo === EXPO GO SURUMU ===
"%ADB%" shell "dumpsys package host.exp.exponent | grep versionName" >> "%OUT%" 2>&1
>> "%OUT%" echo.
>> "%OUT%" echo === REVERSE ===
"%ADB%" reverse --list >> "%OUT%" 2>&1
>> "%OUT%" echo.
>> "%OUT%" echo === EXPO LOG ===
"%ADB%" shell "logcat -d | grep -iE 'exponent|expo|manifest|IOException' | tail -40" >> "%OUT%" 2>&1
>> "%OUT%" echo BITTI
echo Tespit bitti.
timeout /t 3 >nul
