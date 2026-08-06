@echo off
rem Yerel .env'deki CALISAN veritabani sifresini kullanarak Render icin dogru
rem pooler adresini uretir ve PANOYA kopyalar. Sifre EKRANDA GOSTERILMEZ.
powershell -NoProfile -Command ^
  "$satir = Select-String -Path 'backend\.env' -Pattern '^SUPABASE_DB_URL=' | Select-Object -First 1;" ^
  "if (-not $satir) { Write-Host 'HATA: backend\.env icinde SUPABASE_DB_URL yok.'; exit 1 };" ^
  "$url = $satir.Line.Substring(16).Trim();" ^
  "if ($url -match '://([^:]+):(.+)@') { $sifre = $Matches[2] } else { Write-Host 'HATA: adres cozulemedi.'; exit 1 };" ^
  "$yeni = 'postgresql://postgres.lgrgwqucgiajmonhmadq:' + $sifre + '@aws-1-eu-west-2.pooler.supabase.com:5432/postgres';" ^
  "Set-Clipboard -Value $yeni;" ^
  "Write-Host 'TAMAM: Dogru adres panoya kopyalandi (sifre gizli). Simdi Render kutusuna Ctrl+V yap.'"
pause
