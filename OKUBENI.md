# ⚽ Spor Toto Analiz

Spor Toto bültenini otomatik çekip her maç için **sürpriz analizi** yapan sistem.
İşaretleme/kupon değil — **analiz** odaklı: hangi maç banko, hangisi sürprize açık.

## Yapı (mimari)

```
sportoto.gov.tr API ─┐
                     ├──→  BACKEND (Node)  ──→  MOBİL APP (Expo)
FootyStats API ──────┘     • API anahtarı .env'de        • sadece backend'i okur
                           • veriyi çeker + cache'ler     • analizi gösterir
                           • sürpriz analizini hesaplar
```

- **backend/** — sunucu. FootyStats anahtarı BURADA, asla uygulamada değil.
- **app/** — React Native (Expo) mobil uygulama. Sadece backend'e bağlanır.

---

## Çalıştırma

### 1) Backend (önce bu)

```bash
cd backend
npm install            # ilk seferde
npm start              # sunucuyu başlatır → http://localhost:4000
```

İlk açılışta bülteni + istatistikleri çeker, cache'ler. 6 saatte bir otomatik yeniler.

**Kendi FootyStats anahtarını eklemek için:**
`backend/.env` dosyasını aç, şu satırları düzenle:
```
FOOTYSTATS_API_KEY=senin_anahtarin        # "example" yerine kendi anahtarın
FOOTYSTATS_SEASON_IDS=1234,5678,...       # analiz edilecek lig sezon id'leri (en fazla 50)
```
> ⚠️ `.env` dosyası `.gitignore` ile korunur, paylaşılmaz. Anahtarını kimseyle paylaşma.

### 2) Mobil uygulama

```bash
cd app
npm install            # ilk seferde
npm start              # QR kod çıkar → telefonda Expo Go ile okut
```

**Önemli:** Telefon, bilgisayarınla **aynı Wi-Fi'da** olmalı.
`app/src/config.js` içindeki `API_BASE` bilgisayarının IP'sini göstermeli
(şu an `192.168.1.100`). IP değişirse oradan güncelle (`ipconfig` → IPv4).

Tarayıcıda denemek için: `app` klasöründe `npm run web`.

---

## Ekranlar

- **📋 Bülten** — haftanın 15 maçı, her birinde 1/X/2 ihtimalleri + sürpriz etiketi
- **🎯 Sürpriz Radarı** — maçlar en sürprize açıktan en bankoya sıralı
- **Maç Detayı** — ihtimaller, sürpriz puanı, unsurlar ve uygulamanın yorumu

## Sürpriz analizi nasıl çalışır?

1. Maçın **oranları** (1/X/2) ihtimale çevrilir (bahisçi marjı temizlenir).
2. **Taban sürpriz** = favori ne kadar zayıf öndeyse o kadar yüksek.
3. Üstüne **unsur puanları** eklenir: form (ppg), xG, çekişme, beraberlik riski.
4. Eşiklere göre etiket: 🟢 **BANKO** · 🟡 **DİKKAT** · 🔴 **SÜRPRİZE AÇIK**.

> Şu an "example" anahtarıyla sadece Premier Lig verisi var; bültendeki o ligin
> maçları analizli gelir, diğerleri "veri yok" der. Kendi anahtarın + doğru sezon
> id'lerini ekleyince bültenin çoğu analizli olur.

## Veri kaynakları
- **Bülten:** sportoto.gov.tr resmi API'si (anahtarsız) — 15 maç, sonuçlar
- **Oran/xG/form:** FootyStats (kendi anahtarınla)
