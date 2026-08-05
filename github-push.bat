@echo off
rem Feature dalini GitHub'a gonderir (main DEGIL - otomatik deploy tetiklenmez).
cd /d "%~dp0"
echo GitHub'a gonderiliyor: feature/gecmis-bulten-ve-rozet-tasarimi
git push origin feature/gecmis-bulten-ve-rozet-tasarimi
echo.
echo Sonuc yukarida. Bu pencere 30 saniye sonra kapanir.
timeout /t 30 >nul
