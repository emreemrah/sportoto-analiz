# Spor Toto Analiz — Devir & Mimari Rehberi (HANDOFF)

Bu dosya projeyi **başka bir geliştiriciye / Claude oturumuna** devretmek içindir.
Amaç: kişinin kodu ve **analiz mantığını** hızla kavraması. Kısa `CLAUDE.md`
her oturumda otomatik yüklenir; bu dosya ise **derin bağlam** verir.

---

## 0. TEK CÜMLE
Resmi Spor Toto bültenini + FootyStats/API-Football verisini birleştirip her maça
**kupon karar desteği** (analiz) sunan uygulama. **Bahis/ödeme değil, analiz.**

## 1. KESİN KURALLAR (asla ihlal etme)
- **Bahis/ödeme/para sistemi kurma.** Uygulama "analiz + kupon karar desteği".
- **Sahte/kesin sonuç üretme.** Veri yoksa "Bilinmiyor" / "Bu veri bulunamadı"
  yaz ve **risk/güven seviyesini düşür**. Olmayan veriyi varmış gibi gösterme.
- **Yalnız resmi Spor Toto sonucu kesindir.** Canlı/geçici skor kesin sayılmaz,
  başarıya/dashboard'a yazılmaz; renk koduyla ayrılır (🟢 resmi · 🟡 henüz resmi
  değil · 🔴 canlı).
- **İddialı dil yok:** "kesin gelir", "garanti", "banko", "yanılmaz", "net favori"
  gibi ifadeleri (koşullar sağlanmadan) kullanma.
- **API anahtarları yalnız `backend/.env`** (gitignore'lu) — asla koda yazma/commit'leme.
- **Kullanıcı arayüzünde marka adı yok** (ör. "FootyStats" gösterme; "veri kaynağı").
- **Mevcut çalışan yapıyı bozma.** Minimum dosya değişikliği. Gereksiz rota/paket ekleme.
- **Kullanıcıya sormadan push/PR/deploy yapma, yeni paket kurma.**
- Takım adları **resmi bültendeki gibi** gösterilir (çeviri kapalı, `translate=no`).

## 2. MİMARİ & ÇALIŞTIRMA
- **backend/** — Node ESM + Express, **:4000**. Veri çeker, analiz/kapsam hesaplar,
  temiz JSON sunar. Anahtarlar sadece burada.
- **app/** — Expo SDK 56 React Native; web için Metro **:8081**. Sadece kendi
  backend'ine bağlanır (dış API'ye asla doğrudan).
- Çalıştır: `cd backend && npm run dev` (nodemon) · `cd app && npm run web` (Metro)
- Bülten cache yenile: `cd backend && npm run refresh`
- Derleme kontrolü: `curl -s -o /dev/null -w "%{http_code}" "http://localhost:8081/index.bundle?platform=web&dev=true"` → **200** beklenir (500 = hata).
- Telefonda test: `powershell -File .\share.ps1` → Cloudflare tüneli (link her
  çalıştırmada DEĞİŞİR; free tünel). Backend açık olmalı.

## 3. VERİ KAYNAKLARI
| Kaynak | Ne verir | Anahtar |
|---|---|---|
| Resmi Spor Toto webapi | Bülten, maçlar, resmi 1/X/2, ikramiye | yok |
| FootyStats | Lig maçları (oran/xG/form), takım/oyuncu, arma, tek-maç skoru | `FOOTYSTATS_API_KEY` + `FOOTYSTATS_SEASON_IDS` (lig sezon id'leri) |
| API-Football | **Gerçek-zamanlı canlı skor + dakika** | `APIFOOTBALL_API_KEY` (limitli) |
| Supabase | Üyelik/profil/yorum/topluluk tahmini | `SUPABASE_URL/…KEY` |
| Open-Meteo | Hava (maç bilgi kartı) | **anahtarsız** |

## 4. ANA AKIŞLAR
1. **Refresh** (`backend/src/refresh.js` → `refreshAll`): Spor Toto bültenini çeker
   → FootyStats sezonlarını (config.seasonIds) çeker → her maçı `matcher.js` ile
   eşleştirir (isim + tarih) → `enrich.js` ile zenginleştirir (puan durumu, form,
   son5, sezon stat, H2H, arma) → `analysis/`'ten sürpriz/tahmin ekler → **kapsam
   raporu** üretir → `weather.js` ile bilgi kartı → cache'e yazar (`backend/cache/`).
2. **Eşleştirme & alias** (`matcher.js`): takım adları farklıysa `ALIASES`'a elle
   eklenir (ör. `helsinki→hjk`, `shenzhenpengcity→sichuanjiuniu`). Kapsanmayan maç
   çıkarsa sebebini `/api/coverage` gösterir (lig kapsam dışı / takım yok / isim).
3. **Canlı skor**: güncel bülten `/api/bulletin` her ~45sn API-Football ile tazelenir;
   **geçmiş bültendeki başlamış maçlar** `/api/history` içinde API-Football (öncelik,
   dakika dahil) + FootyStats (yedek) ile tazelenir (`getLiveFixtures`, throttle).
4. **Kupon**: maç detayı/bülten → **paylaşılan taslak** (`app/src/couponStore.js`) →
   `CouponBuilderScreen` → kaydet (`createCoupon`, ilk kupon = dereceli). Kuponlar
   **hesaba bağlı** backend'e senkron (`/api/coupons`, `couponStore.syncFromServer`).
5. **Analiz** (aşağıda ayrıntılı).

## 5. ÖNEMLİ DOSYALAR
**Backend**
- `server.js` — tüm uçlar: `/api/bulletin`, `/api/history/:id`, `/api/rounds`,
  `/api/match/:no`, `/api/coverage`, `/api/system-scorecard`, `/api/coupons`, auth/…
- `refresh.js` — refresh + eşleştirme + kapsam + canlı footy skor + snapshot.
- `matcher.js` — isim normalizasyon + `ALIASES` + tarih kontrolü + kapsam teşhisi.
- `sources/{sportoto,footystats,apifootball}.js` — dış API istemcileri.
- `enrich.js` — takım stats (standing, season xG/over/btts, form, son5, H2H).
- `weather.js` — Open-Meteo (anahtarsız). `cache.js` — dosya JSON cache.
- `routes/coupons.js` — kullanıcı kuponları (`backend/data/coupons.json`, gitignore).
- `mw.js` — `requireAuth` (Supabase token → req.user).

**Frontend (app/src)**
- `userMatchEngine.js` — **ANA ANALİZ MOTORU** (aşağıda). `components/UserAnalysisView.js` — görünümü.
- `couponStore.js` / `couponConfig.js` — kupon veri/kural + sunucu senkron + taslak.
- `screens/MatchDetailScreen.js` — maç detay (Özet/Analiz/İstatistik/Karşılaştırma/
  Yorumlar sekmeleri). "Analiz" sekmesi = UserAnalysisView + Kazanma İhtimalleri.
- `screens/BulletinScreen.js` — bülten (güncel + geçmiş, canlı skor, filtreler).
- `screens/CouponBuilderScreen.js` / `CouponsScreen.js` — kupon oluştur / Kuponlarım.
- `screens/UserDashboardScreen.js` — Başarı Panelim (yalnız resmi sonuç).
- `screens/RadarScreen.js` — "Radar" sekmesi (sürpriz radarı) + Sistem Karnesi.
- `components/CouponPickBlock.js` — maç detayında 1/X/2 + "Sistemden al" (analiz seçimi).
- `components/MatchInfoCard.js` — lig/hafta + stadyum + hava kartı.
- `App.js` — sekmeler: Ana Sayfa · Bülten · Radar · Profil. `api.js`, `auth.js`,
  `theme.js`, `utils.js`, `liveLogic.js`, `prefs.js`.

## 6. ANALİZ MOTORU MANTIĞI (en kritik bölüm)
Dosya: `app/src/userMatchEngine.js` → `analyzeUserMatch(m)`. **Kullanıcının kendi
maç okuma mantığı.** Yalnız şu kriterler çalışır (başka yok — xG/oran/AI/hakem/hava
KARARDA kullanılmaz):

1. **Puan durumu** — güç/güven veren avantaj ≈ 5 maçlık fark = **5×3 = 15 puan**.
   fark ≥15 güçlü (±2), 9-14 hafif (±1), altı = avantaj yok.
2. **Ev sahibi formu** — son5(iç saha) + iç saha kaydı. İyi/güçlü → 1 lehine.
3. **Deplasman formu** — dış saha güç seviyesi (güçlü/orta/zayıf/**çok zayıf**).
   Güçlü → X doğar, 2 silinmez; **çok zayıf** (4+ M, ≤1 G) → 1 belirgin (+2).
4. **Eksik oyuncu** — **VERİ YOK** → "Bu veri bulunamadı", güven düşer.
5. **Teknik direktör değişimi** — **VERİ YOK** → "Bu veri bulunamadı".
6. **Ortak rakip kıyası** — `last5detail`'den ortak rakiplere karşı: önce SONUÇ
   (G3/B1/M0), eşitse **averaj** (az yiyen iyi), eşitse **atılan gol**. Tek ortak
   rakip (ör. ikisi de yenilmiş) → belirleyici SAYILMAZ (sinyal 0).

**Karar:** kriter sinyalleri toplanır → `net` (+ ev lehine, − deplasman).
- net ≥3 → **1** · net 1-2 → **1X** · net ≤−3 → **2** · net −1..−2 → **X2**
- net 0 + beraberlik riski → **1X2 (kapalı, 3 ihtimal)**, değilse **12**.

**RİSK = önerilen seçimin GENİŞLİĞİ** (kullanıcı kuralı): tek (1/X/2)=**Düşük**,
çifte (1X/X2/12)=**Orta**, üçlü (1X2)=**Yüksek**. → "risk yüksekse 3 ihtimalli".

**Güven (dataConfidence):** eksik oyuncu/hoca hep yok → en fazla **"Orta"**
(asla "Yüksek"). Bu dürüstlük gereği.

**Ek gösterim (karara katılmaz, sadece bilgi):** H2H özeti (`checkH2H`), Lider
takımlara karşı sonuçlar (`checkVsTop`, ilk 5 × last5detail). İstenirse sinyale eklenebilir.

> Eski bir "DecisionEngineView / decisionEngine.js" (xG/oran tabanlı B+C+D motoru)
> vardı; kullanıcı beğenmedi, **UI'dan kaldırıldı** (dosyalar duruyor, bağlı değil).

## 7. KAPSAM KONTROL MEKANİZMASI
`/api/coverage` + bülten kartındaki "⚠ N maçta veri yok" + kart etiketi. Refresh her
maçı sınıflar: eşleşti / **lig kapsam dışı** / **takım kaynakta yok** / **isim
eşleşmedi (alias gerekir)**. Yeni maç veri gelmiyorsa buradan sebebi görülür.

## 8. DEPLOY (Render)
- `render.yaml` — tek servis (backend + web build birlikte). **`main` branch'e push
  → otomatik deploy.** Anahtarlar (`sync:false`) **Render panelinden** girilir.
- Kupon dosya deposu (`backend/data`) Render free'de **ephemeral** (redeploy'da
  sıfırlanır) — kalıcı prod için Supabase tablosuna taşınmalı (henüz yapılmadı).

## 9. MEVCUT DURUM (devir anı)
- `main`'de yayında; feature branch'te görsel + analiz iyileştirmeleri var.
- **Henüz commit edilmemiş** bir dizi UI/motor değişikliği olabilir — `git status`
  ile bak; kullanıcı onayıyla commit/deploy edilir.
- Bilinen eksikler: eksik oyuncu & teknik direktör verisi (kaynak yok) → kriter
  4-5 hep "Bilinmiyor"; H2H tek-tek skorları yok (özet var); `backend/data` prod'da
  kalıcı değil.

## 10. YENİ CLAUDE İÇİN BAŞLANGIÇ PROMPT'U
Yeni oturumun ilk mesajına şunu yapıştır:

> Bu repo "Spor Toto Analiz" — futbol maçları için **kupon karar desteği** (bahis
> değil) sunan Expo RN + Node/Express uygulaması. Başlamadan önce kök dizindeki
> **`HANDOFF.md`** ve **`CLAUDE.md`** dosyalarını oku; oradaki **kesin kuralları**
> (sahte/kesin sonuç yok, veri yoksa "Bilinmiyor" + risk artır, yalnız resmi Spor
> Toto sonucu kesin, iddialı dil yok, marka adı gösterme, anahtarlar backend/.env'de,
> sormadan push/deploy/paket yok) harfiyen uygula. Ana analiz mantığı
> `app/src/userMatchEngine.js` (6 kriter + risk=seçim genişliği). Değişiklik
> yapmadan önce ilgili dosyaları incele, bittiğinde web bundle'ın 200 döndüğünü
> doğrula, değişen dosyaları kısaca özetle.
