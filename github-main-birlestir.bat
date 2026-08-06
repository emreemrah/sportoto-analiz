@echo off
rem TEK TIKLA YAYIN: feature dalini GitHub'a gonderir VE main'e ileri sarar.
rem main'e push Render'da OTOMATIK DEPLOY tetikler (kullanici onayli akis).
cd /d "%~dp0"
echo GitHub'a gonderiliyor (feature + main)...
git push origin feature/gecmis-bulten-ve-rozet-tasarimi feature/gecmis-bulten-ve-rozet-tasarimi:main
echo.
echo Sonuc yukarida. Render deploy'u birkac dakika icinde baslar (5-10 dk).
timeout /t 30 >nul
