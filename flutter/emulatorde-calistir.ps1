# EMÜLATÖRDE ÇALIŞTIR — otomatik girişle (geliştirme kolaylığı, 2026-08-11)
#
# Emülatöre her yeni derleme kurulduğunda oturum belirteçleri Android
# Keystore'dan düşebiliyor ve uygulama giriş ekranıyla açılıyor. Bu betik
# kimlik bilgisini `--dart-define` ile geçirir; uygulama açılışta bir kez
# kendisi giriş yapar (YALNIZ debug derlemesinde — bkz. lib/core/dev_oturum.dart).
#
# KULLANIM
#   .\emulatorde-calistir.ps1                     # DEV_EMAIL / DEV_SIFRE ortam
#                                                 # değişkenlerinden okur
#   .\emulatorde-calistir.ps1 -Eposta a@b.c -Sifre gizli
#   .\emulatorde-calistir.ps1 -Cihaz chrome       # başka cihazda
#
# PAROLA NEREDE DURSUN
#   En temizi ortam değişkeni (komut geçmişine düşmez):
#     $env:DEV_EMAIL = 'a@b.c'
#     $env:DEV_SIFRE = 'gizli'
#   Parametreyle verirsen parola PowerShell geçmişinde kalır.
#
# Parametre verilmezse uygulama olağan hâlde açılır (giriş ekranı).

param(
  [string]$Eposta = $env:DEV_EMAIL,
  [string]$Sifre  = $env:DEV_SIFRE,
  [string]$Cihaz  = 'emulator-5554'
)

$argumanlar = @('run', '-d', $Cihaz)

if ($Eposta -and $Sifre) {
  $argumanlar += "--dart-define=DEV_EMAIL=$Eposta"
  $argumanlar += "--dart-define=DEV_SIFRE=$Sifre"
  Write-Host "Otomatik giris ACIK ($Eposta) - yalniz debug derlemesinde." -ForegroundColor Green
} else {
  Write-Host "Otomatik giris KAPALI (DEV_EMAIL/DEV_SIFRE yok) - olagan acilis." -ForegroundColor Yellow
}

Write-Host "flutter $($argumanlar -join ' ')" -ForegroundColor DarkGray
& flutter @argumanlar
