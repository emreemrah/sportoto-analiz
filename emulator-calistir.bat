@echo off
rem ============================================================
rem  EMULATORDE CALISTIR — tek tikla: backend + emulator + Metro
rem ------------------------------------------------------------
rem  1) backend (:4000) zaten calisiyorsa yeniden baslatilmaz
rem  2) Android emulator (Pixel_4) yoksa acilir, acilis beklenir
rem  3) Metro 8082'de baslar (8081 web icin serbest kalsin) ve
rem     uygulama emulatore yuklenir
rem
rem  NOT: Emulator icinde "localhost" EMULATORUN KENDISIDIR; PC'ye
rem  10.0.2.2 ile ulasilir. Bu yuzden API adresi 10.0.2.2:4000 verilir.
rem ============================================================
cd /d "%~dp0"
set "SDK=%LOCALAPPDATA%\Android\Sdk"
set "ADB=%SDK%\platform-tools\adb.exe"
set "EMU=%SDK%\emulator\emulator.exe"

echo [1/3] Backend (:4000) kontrol ediliyor...
netstat -ano | findstr ":4000" | findstr "LISTENING" >nul
if errorlevel 1 (
  echo      calismiyor - baslatiliyor...
  start "SporToto Backend" cmd /k "cd /d %~dp0backend && npm run dev"
) else (
  echo      zaten calisiyor.
)

echo [2/3] Emulator kontrol ediliyor...
"%ADB%" devices | findstr "emulator-" >nul
if errorlevel 1 (
  echo      aciliyor - Pixel_4...
  start "" "%EMU%" -avd Pixel_4 -netdelay none -netspeed full
) else (
  echo      zaten acik.
)
"%ADB%" wait-for-device
echo      Acilis tamamlanmasi bekleniyor (1-3 dk surebilir)...
:bekle
set "BOOT="
for /f "usebackq delims=" %%i in (`"%ADB%" shell getprop sys.boot_completed 2^>nul`) do set "BOOT=%%i"
if not "%BOOT%"=="1" (
  timeout /t 5 >nul
  goto bekle
)
echo      Emulator hazir.

rem NEDEN 10.0.2.2 (2026-08-06 tespiti):
rem  • PC'nin LAN IP'sine (192.168.x.x) emulatorden ulasilamiyordu →
rem    "Failed to download remote update".
rem  • "--host localhost" ise Metro'yu YALNIZ IPv6 loopback'e (::1) baglar;
rem    "adb reverse" IPv4 127.0.0.1'e baglandigi icin yine kurulmuyor.
rem  • Dogru yol: emulatorun ev sahibi adresi 10.0.2.2. Metro tum arayuzleri
rem    dinler, Expo Go exp://10.0.2.2:8082 acar. Ters tunel yedek olarak durur.
echo      adb ters tunel kuruluyor (yedek)...
"%ADB%" reverse tcp:8082 tcp:8082 >nul 2>&1
"%ADB%" reverse tcp:4000 tcp:4000 >nul 2>&1

echo [3/3] Metro baslatiliyor (port 8082) ve uygulama yukleniyor...
start "SporToto Metro" cmd /k "cd /d %~dp0app && set EXPO_PUBLIC_API_BASE=http://10.0.2.2:4000&& set REACT_NATIVE_PACKAGER_HOSTNAME=10.0.2.2&& npx expo start --android --port 8082"

echo.
echo Hepsi baslatildi. Ilk acilista Expo Go kurulumu birkac dakika surebilir.
timeout /t 15 >nul
