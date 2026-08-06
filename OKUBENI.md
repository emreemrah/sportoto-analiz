# ⚽ Sportoto Master Analiz

Resmî Spor Toto bültenini otomatik çekip her maç için **veri destekli analiz**
sunan sistem. Bahis oynatmaz, para kabul etmez, hiçbir bahis sitesine
yönlendirmez — yalnız **istatistik ve olasılık analizi** gösterir.
Hiçbir çıktı kazanç garantisi değildir. **18+**

## Yapı (mimari)

```
sportoto.gov.tr API ─┐
FootyStats API ──────┼──→  BACKEND (Node/Express) ──→  UYGULAMA (Expo: Android/iOS/Web)
API-Football ────────┤     • tüm API anahtarları .env'de   • yalnız backend'i okur
Oynanma gözlemleri ──┘     • veri + mühürlü arşiv + analiz  • analiz ekranları
        Supabase (Postgres) ← üyelik, yorum, kalıcı arşiv
```

- **backend/** — sunucu. Tüm dış API anahtarları BURADA (`backend/.env`),
  asla uygulamada değil. Kurulum alanları için: `backend/.env.example`.
- **app/** — Expo (React Native) uygulaması. Yalnız backend'e bağlanır;
  adresi `EXPO_PUBLIC_API_BASE` ortam değişkeninden alır (yayın derlemesinde
  HTTPS zorunludur, yerel IP'ler reddedilir — bkz. `app/src/apiBase.js`).

## Çalıştırma

### 1) Backend (önce bu)

```bash
cd backend
npm install            # ilk seferde
npm start              # http://localhost:4000
```

İlk açılışta bülteni + istatistikleri çeker, önbellekler; 6 saatte bir
otomatik yenilenir. Üyelik/arşiv için Supabase alanlarını `.env`'e girin
(boş bırakılırsa üyelik uçları kapalı, analiz yine çalışır).

### 2) Uygulama

```bash
cd app
npm install            # ilk seferde
npm start              # QR kod → telefonda Expo Go ile okut
npm run web            # tarayıcıda denemek için
```

Geliştirmede telefon ile bilgisayar aynı Wi-Fi'da olmalı ve
`EXPO_PUBLIC_API_BASE` bilgisayarın adresini göstermeli.

## Başlıca özellikler

- **📋 Bülten** — haftanın 15 maçı; her maçta veri destekli 1/X/2 analizi
- **🎯 Radar Merkezi** — 4 karar radarı (Rakip Gücü, xG/Beklenti, Oynanma
  DNA, Oran Takibi) + bilgi amaçlı Bülten DNA paneli (karara katılmaz)
- **🔬 Master Analiz** — 40 kriterlik, kullanıcı seçimli analiz motoru;
  veri yoksa uydurmaz, "analiz dışı" der
- **🧾 Sistem Karnesi** — geçmiş tahminlerin mühürlü, değiştirilemez kaydı
  üzerinden dürüst başarı ölçümü
- **🎟️ Kupon Merkezi** — kişisel kupon taslakları (maç bazlı kilit: maç
  başladıktan sonra seçim değiştirilemez)
- **📺 Yayın Stüdyosu** — yayıncılar için sunum ekranları
- **👤 Üyelik + topluluk** — yorumlar, moderasyon, cihaz yönetimi

## Dürüstlük kuralları (kısaca)

- "Kesin, garanti, banko, kazandırır" dili kullanılmaz; en güçlü ifade
  "Güçlü Aday"dır ve garanti değildir.
- Tahminler maç kilitlenmeden mühürlenir; geçmişe dönük tahmin üretilmez.
- Küçük örneklemde yüzde gösterilmez ("örneklem yetersiz" denir).
- Kupon sırası gibi nedensel bağı olmayan örüntüler karara katılmaz.

## Veri kaynakları

- **Bülten/sonuçlar:** sportoto.gov.tr resmî API (anahtarsız)
- **Oran/xG/form:** FootyStats · **Canlı skor:** API-Football (anahtarlar `.env`)
- **Oynanma yüzdeleri:** yasal bayilerin kamuya açık uçlarından 15 dk'lık
  mühürlü gözlemler (ayrıntı: `backend/src/providers/`)

> Güncel geliştirme durumu ve devir notları için: `HANDOFF.md` · `DEVAM.md`
