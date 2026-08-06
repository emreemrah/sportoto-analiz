@echo off
rem Metro'yu (8082) kapatip emulator akisini bastan calistirir.
rem PORT'a gore oldurur: kullanicinin 8081'deki web Metro'suna DOKUNMAZ.
cd /d "%~dp0"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8082" ^| findstr LISTENING') do taskkill /F /PID %%p >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8083" ^| findstr LISTENING') do taskkill /F /PID %%p >nul 2>&1
timeout /t 3 >nul
call "%~dp0emulator-calistir.bat"
