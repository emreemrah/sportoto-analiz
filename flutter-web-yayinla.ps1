# =============================================================================
# FLUTTER WEB YAYINLAMA — kök adres (https://sportoto-analiz.onrender.com/)
#
# NEDEN BU BETİK: Render'ın node ortamında Flutter SDK yoktur, yani web
# derlemesi dağıtım anında YAPILAMAZ. Bu yüzden derleme burada yapılır ve
# çıktı depoya işlenir (backend/public); sunucu o klasörü statik servis eder
# (backend/src/server.js).
#
# ÜÇ ADIM
#  1) flutter build web --release
#  2) flutter_bootstrap.js YAMASI — buildConfig'e "useLocalCanvasKit":true
#     eklenir. Neden: Flutter 3.44 varsayılanı, çizim motoru canvaskit'i
#     Google CDN'inden (www.gstatic.com) indirmektir; sunucumuzun katı CSP'si
#     (connect-src 'self') bunu engeller ve sayfa BEYAZ açılır. Bu sürümde
#     `--no-web-resources-cdn` bayrağı buildConfig'e yansımıyor, bu yüzden
#     yama gerekiyor. Yama ile canvaskit kendi sunucumuzdan okunur → CDN
#     erişilemese bile uygulama çizilir.
#  3) build/web → backend/public kopyalanır.
#
# SONRA: git add backend/public && git commit && git push  (Render dağıtır)
#
# NOT: yazı tipi (Roboto) hâlâ fonts.gstatic.com'dan gelir; CSP'de yalnız o
# adrese izin verilidir (bkz. backend/src/security/headers.js). Engellenirse
# uygulama çizilir ama YAZILAR görünmez — bu durum yerelde ölçüldü.
# =============================================================================

$ErrorActionPreference = 'Stop'
$flutterDir = 'E:\flt\kodu cevir'
$hedef = Join-Path $PSScriptRoot 'backend\public'

Write-Host '[1/3] Flutter web derleniyor...' -ForegroundColor Cyan
Push-Location $flutterDir
try {
  & flutter build web --release
  if ($LASTEXITCODE -ne 0) { throw 'flutter build web başarısız' }
} finally {
  Pop-Location
}

Write-Host '[2/3] canvaskit yerel kaynağa bağlanıyor (bootstrap yaması)...' -ForegroundColor Cyan
$bootstrap = Join-Path $flutterDir 'build\web\flutter_bootstrap.js'
$icerik = Get-Content $bootstrap -Raw
# DİKKAT: 'useLocalCanvasKit' dizgesi bootstrap'ın KENDİ kodunda da geçer;
# bu yüzden yama kontrolü DEĞERE bakar, anahtar adına değil.
if ($icerik -notmatch '"useLocalCanvasKit":true') {
  $icerik = $icerik -replace '(_flutter\.buildConfig\s*=\s*\{)', '$1"useLocalCanvasKit":true,'
  Set-Content $bootstrap $icerik -NoNewline -Encoding UTF8
  Write-Host '   yama uygulandı' -ForegroundColor Green
} else {
  Write-Host '   zaten yamalı' -ForegroundColor DarkGray
}

Write-Host '[3/3] backend\public güncelleniyor...' -ForegroundColor Cyan
if (Test-Path $hedef) { Remove-Item $hedef -Recurse -Force }
New-Item -ItemType Directory -Force $hedef | Out-Null
Copy-Item (Join-Path $flutterDir 'build\web\*') $hedef -Recurse -Force

$ozet = Get-ChildItem $hedef -Recurse -File | Measure-Object -Property Length -Sum
Write-Host ''
Write-Host ('TAMAM — {0:N1} MB, {1} dosya.' -f ($ozet.Sum / 1MB), $ozet.Count) -ForegroundColor Green
Write-Host 'Şimdi: git add backend/public && git commit && git push' -ForegroundColor Yellow
