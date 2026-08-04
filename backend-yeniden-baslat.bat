@echo off
rem Backend'i güvenle yeniden başlatır: YALNIZ 4000 portunu dinleyen süreci
rem kapatır (Metro/8081'e dokunmaz), sonra nodemon ile tekrar açar.
echo Backend (port 4000) kapatiliyor...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4000" ^| findstr "LISTENING"') do taskkill /PID %%a /F
timeout /t 2 /nobreak >nul
cd /d "%~dp0backend"
echo Backend yeniden baslatiliyor (npm run dev)...
start "sportoto-backend" cmd /k "npm run dev"
echo Tamam. Bu pencereyi kapatabilirsiniz.
timeout /t 5 >nul
