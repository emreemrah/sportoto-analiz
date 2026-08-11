# Spor Toto Analiz — Proje Rehberi


> ## ⚠ 2026-08-11 — ÜRÜN ARTIK FLUTTER
> RN/Expo uygulaması (`app/`) emekliye ayrıldı ve depodan KALDIRILDI (geçmişte
> durur). Kullanıcıya giden ürün artık **`flutter/`** klasöründeki Flutter
> uygulamasıdır. Bu dosyadaki "Frontend (app/src)" bölümü ve RN ekran adları
> TARİHÇEDİR — yeni iş için `flutter/lib` altına bakın. `backend/` ve
> `render.yaml` aynen geçerlidir: canlı API oradan dağıtılır ve Flutter
> uygulaması ona bağlıdır. Kökteki `:4000` adresi artık web arayüzü SUNMAZ,
> yalnız API + /yonetim panelidir.

> **Derin bağlam / devir için `HANDOFF.md`'yi oku** (mimari, veri akışı, analiz
> motoru mantığı, deploy, mevcut durum). Bu dosya kısa; HANDOFF ayrıntılı.

## Amaç
Resmi Spor Toto bültenini (sportoto.gov.tr) + FootyStats/API-Football verisini
birleştirip her maça **kupon karar desteği** (analiz) sunan uygulama —
**bahis/ödeme değil, analiz.** Güncel + geçmiş bülten, canlı skor, kapsam kontrolü,
kupon oluşturma ve **iki ayrı analiz motoru** (aşağıda; hangisinin nerede
çalıştığı karıştırılmamalı).

## Yapı
- **backend/** — Node.js (ESM) + Express API, port **4000**.
  - Resmi Spor Toto webapi + FootyStats verisini çeker, analiz/tahmin hesaplar,
    mobil/web uygulamaya temiz JSON sunar. API anahtarları sadece backend'de.
- **app/** — Expo (SDK 56) React Native uygulaması; web için Metro, port **8081**.
  - Sadece kendi backend'ine bağlanır (FootyStats'e asla doğrudan değil).

## Önemli dosyalar
### Backend
- `backend/src/server.js` — Express uçları: `/api/bulletin` (güncel, analizli),
  `/api/rounds` (hafta listesi/navigasyon), `/api/history/:roundId` (geçmiş
  hafta: skor + resmi 1/X/2 + ikramiye), `/api/match/:no`, `/api/surprise-radar`.
  Üretimde `public/` varsa web build'ini de aynı sunucudan servis eder.
- `backend/src/sources/sportoto.js` — Resmi Spor Toto webapi istemcisi
  (haftalar, maçlar, skor/sonuç, ikramiye: `GetGameResultByGameRoundId`).
- `backend/src/sources/footystats.js` — FootyStats istemcisi (takım, lig
  tablosu, oyuncular, maç detayı, kulüp armaları).
- `backend/src/refresh.js` — Bülteni çeker, eşleştirir, analiz/tahmin ekler,
  cache'e yazar. `backend/src/enrich.js` — puan durumu/form/H2H/kadro zenginleştirme.
- `backend/src/analysis/` — `surprise.js` (sürpriz puanı), `prediction.js`
  (kupon kuralları), `aiComment.js` (opsiyonel Claude yorumu).
- `backend/src/cache.js` — dosya tabanlı JSON cache (`backend/cache/`).
- `backend/src/config.js` — `.env`'den ayarlar (FOOTYSTATS_API_KEY, PORT, ...).

### Frontend (app/src)
- `screens/BulletinScreen.js` — **Ana ekran.** Hafta seçici (‹ ›), güncel bülten
  (sade maç kartı: Tarih · Ev · VS · Deplasman) + geçmiş bülten (sonuç + ikramiye).
- `screens/MatchDetailScreen.js` — Maç detayı: kupon tahmini, 1/X/2 ihtimaller,
  analiz, puan durumu, lig tablosu, kadrolar.
- `components.js` — Ortak bileşenler: `FormStrip` (G/B/M form rozetleri),
  `RecordBadges` (O-G-B-M sayıları), `PickGrid`, `StatBar`, `ProbBar`, rozetler.
- `api.js` — backend istemcisi. `config.js` — API adresi (yerel/tünel/üretim).
- `theme.js` — renk/aralık/yarıçap. `utils.js` — tarih/ülke yardımcıları.

## Çalıştırma
- Backend: `cd backend && npm install && npm run dev` (nodemon, :4000)
- Web: `cd app && npm install && npm run web` (Metro, :8081)
- Cache yenile: `cd backend && npm run refresh`
- **Veritabanı migration'ları OTOMATİK**: backend açılışında `backend/migrations/`
  sırayla uygulanır (defter: `public.schema_migrations`, advisory lock, tam
  rollback, bütünlük mührü). Elle SQL çalıştırma. `SUPABASE_DB_URL` (session/direct)
  yoksa migration olmaz: **üretimde** worker/scheduler'lar BAŞLAMAZ, geliştirmede
  yüksek sesle uyarılır ve devam edilir (`MIGRATIONS_REQUIRED=1` orada da kapatır).
  Ayrıntı: `backend/migrations/README.md`, `HANDOFF.md` §9.3.
- Derleme kontrolü (web bundle): `curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:8081/index.bundle?platform=web&dev=true"` → 200 beklenir.

## Veri/sözleşmeler
- Takım adları **resmi listedeki gibi** gösterilir (çeviri kapalı: web'de
  `translate=no`). Kulüp armaları FootyStats CDN'den; geçmiş maçlarda yoksa ⚽.
- **Resmi sonuç (1/X/2) sadece resmi veriden** gelir; kupon **tahmini** ile
  karıştırılmaz. Başlamış/oynanmış maça analiz/tahmin üretilmez.
- Güncel bülten = analiz odaklı. Geçmiş bülten = sonuç + ikramiye odaklı.

## Çalışma kuralları (KESİN)
- **Bahis/ödeme/para sistemi kurma** — uygulama "analiz + kupon karar desteği".
- **Sahte/kesin sonuç üretme.** Veri yoksa "Bilinmiyor" / "Bu veri bulunamadı" yaz
  ve **risk/güven seviyesini düşür.** Olmayan veriyi varmış gibi gösterme.
- **Yalnız resmi Spor Toto sonucu kesindir.** Canlı/geçici skor kesin sayılmaz,
  başarıya yazılmaz (renk: 🟢 resmi · 🟡 henüz resmi değil · 🔴 canlı).
- **İddialı dil yok:** "kesin/garanti/banko/yanılmaz/net favori" (koşul sağlanmadan).
- Anahtarlar `backend/.env` içinde (gitignore'lu) — asla koda yazma/commit'leme.
- **Kullanıcı arayüzünde marka adı yok** (ör. "FootyStats" gösterme).
- Backend API mantığını gereksiz büyütme; mevcut akışı bozma. Takım adlarını/logoları
  koru. Minimum dosya değişikliği; iş sonunda değişenleri özetle; web bundle 200 doğrula.
- **Yeni paket kurma ve sormadan push/PR/deploy yapma.**
- **İKİ MOTOR VAR — karıştırma:**
  - `backend/src/analysis/masterEngine.js` — **ÜRÜN STANDARDI**. 40 kriterli
    Master Analiz; `analysisService.js` üzerinden `/api/analysis` ve karne
    uçlarını besler. Analiz ve Radar ekranlarında görünen budur.
  - `app/src/userMatchEngine.js` — 6 kriterli hafif motor. YALNIZ
    `broadcastStudio.js` (Haftanın Özeti ekranı) kullanır; ürünün ana analizi
    DEĞİLDİR. (risk = seçim genişliği: tek=Düşük, çifte=Orta, üçlü=Yüksek)
  - Belgeler bir dönem ikincisini ana motor gibi tarif ediyordu; bu satır o
    karışıklığı kapatmak için var. Detay: `HANDOFF.md` §6.
- `node_modules/`, `.git/`, `dist/`, `build/`, `app/.expo/`, `backend/cache/`,
  `backend/data/`, `backend/public/` üretilen/çıktı — okuma/düzenleme gerekmez.

> Not: Bu dosya CLAUDE.md'nin proje bölümüyle EŞİTLENMİŞTİR (2026-08-06 denetimi).
> Eskiden `userMatchEngine.js`'i ana motor diye anlatıyordu — yanlıştı.
> Çalışma yöntemi kuralları için CLAUDE.md'ye bak.
