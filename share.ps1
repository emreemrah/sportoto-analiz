# Spor Toto Analiz — internete açma (paylaşılabilir link)  [Cloudflare Tunnel]
# -------------------------------------------------------------------------
# HESAP/TOKEN GEREKMEZ. Sadece backend açık olsun, bu dosyayı çalıştır:
#     powershell -ExecutionPolicy Bypass -File .\share.ps1
#
# Ne yapar:
#   1) Backend (:4000) ve web (:8081) icin birer Cloudflare tuneli acar
#   2) Web'i, backend tunel adresini gomerek yeniden baslatir
#   3) Paylasilacak linki ekrana yazar
# Bilgisayar acik ve bu pencere calistigi surece link calisir.
# (Ucretsiz tunelde link her acilista degisir.)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

# cloudflared yolunu bul
$cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cf) {
  $cf = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter cloudflared.exe -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
}
if (-not $cf) { Write-Error "cloudflared bulunamadi. Kur: winget install Cloudflare.cloudflared"; exit 1 }

$log = Join-Path $env:TEMP 'sportoto-share'
New-Item -ItemType Directory -Force -Path $log | Out-Null

function Start-CfTunnel($port, $name, $hostHeader) {
  $err = Join-Path $log "$name.log"
  if (Test-Path $err) { Remove-Item $err -Force }
  $args = @('tunnel','--no-autoupdate')
  if ($hostHeader) { $args += @('--http-host-header', $hostHeader) }
  $args += @('--url', "http://localhost:$port")
  Start-Process -FilePath $cf -ArgumentList $args -RedirectStandardError $err -RedirectStandardOutput "$err.out" -WindowStyle Hidden
  for ($i=0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    $m = Select-String -Path $err -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($m) { return $m.Matches[0].Value }
  }
  return $null
}

Write-Host "Backend tuneli aciliyor..."
$backend = Start-CfTunnel 4000 'back' $null
if (-not $backend) { Write-Error "Backend tuneli alinamadi. Backend (:4000) calisiyor mu?  backend klasorunde: npm run dev"; exit 1 }

Write-Host "Web tuneli aciliyor..."
$frontend = Start-CfTunnel 8081 'front' 'localhost:8081'
if (-not $frontend) { Write-Error "Web tuneli alinamadi."; exit 1 }

# Web'i backend tunel adresiyle yeniden baslat (8081'i kapatip ac)
$pids = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue | Select-Object -Expand OwningProcess -Unique
foreach ($p in $pids) { try { Stop-Process -Id $p -Force } catch {} }
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Backend : $backend"
Write-Host "PAYLAS  : $frontend   <-- bu linki gonder" -ForegroundColor Green
Write-Host "(Kapatmak icin bu pencerede Ctrl+C; tunelleri de kapatmak icin pencereyi kapat)"
Write-Host ""

$env:EXPO_PUBLIC_API_BASE = $backend
Set-Location "$root\app"
npm run web
