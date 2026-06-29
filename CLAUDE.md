# Spor Toto Analiz — Proje Rehberi

## Amaç
Resmi Spor Toto bültenini (sportoto.gov.tr) ve FootyStats verisini birleştirip
**analiz** sunan bir uygulama (bahis tüyosu değil, analiz). Güncel haftanın
bültenini gösterir, "sürpriz" analizi + kupon tahmini (1/0/2/10/02/12/102)
üretir, geçmiş haftaların sonuç ve ikramiye dağılımını gösterir.

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
- Derleme kontrolü (web bundle): `curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:8081/index.bundle?platform=web&dev=true"` → 200 beklenir.

## Veri/sözleşmeler
- Takım adları **resmi listedeki gibi** gösterilir (çeviri kapalı: web'de
  `translate=no`). Kulüp armaları FootyStats CDN'den; geçmiş maçlarda yoksa ⚽.
- **Resmi sonuç (1/X/2) sadece resmi veriden** gelir; kupon **tahmini** ile
  karıştırılmaz. Başlamış/oynanmış maça analiz/tahmin üretilmez.
- Güncel bülten = analiz odaklı. Geçmiş bülten = sonuç + ikramiye odaklı.

## Çalışma kuralları
- Anahtarlar `backend/.env` içinde (gitignore'lu) — asla koda yazma/commit'leme.
- Backend API mantığını gereksiz büyütme; mevcut güncel-bülten akışını bozma.
- Takım isimlerini bozma, logoları koru. Gereksiz refactor yapma.
- Minimum dosya değişikliği; iş sonunda değişen dosyaları kısa özetle.
- Yeni paket kurma ve kullanıcıya sormadan push/PR yapma.
- `node_modules/`, `.git/`, `dist/`, `build/`, `app/.expo/`, `backend/cache/`,
  `backend/public/` üretilen/çıktı klasörleridir — okuma/düzenleme gerekmez.
