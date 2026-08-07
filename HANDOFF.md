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
- **Cihazda kriter motoru YOKTUR** (2026-08-07). Eskiden iki hafif yerel motor
  vardı (`userMatchEngine.js`, sonra `analysis/engine.js`); ikisi de kaldırıldı.
  Tek motor: `backend/src/analysis/masterEngine.js` (40 kriter, `/api/analysis`).
- `couponStore.js` / `couponConfig.js` — kupon veri/kural + sunucu senkron + taslak.
- `screens/MatchDetailScreen.js` — maç detay (Özet/Analiz/İstatistik/Yorumlar).
  **"Analiz" sekmesi (2026-08-07)** = Master Analiz kutusu + `KriterBasariListesi`.
  Liste satırına dokununca `KriterKirilimScreen` açılır: o kriterin yön verdiği
  TÜM maçlar ham hâlde (sıra · oran 1/X/2 · oynanma % · kriter · sonuç · ✓/✗)
  + Hepsi/Tuttu/Tutmadı süzgeci + Hafta/Sıra/Oran/Oynanma sıralaması.
  Ekran **hüküm vermez**; kullanıcı maçlara bakıp kendi kararını verir.
- `screens/BulletinScreen.js` — bülten (güncel + geçmiş, canlı skor, filtreler).
- `screens/CouponCenterScreen.js` / `CouponEditorScreen.js` — Kupon Merkezi / editör.
  (Eski `CouponBuilderScreen`/`CouponsScreen` SİLİNDİ — 2026-07-24 kupon yenilemesi.)
- `screens/UserDashboardScreen.js` — Başarı Panelim (yalnız resmi sonuç).
- `screens/RadarScreen.js` — "Radar" sekmesi (sürpriz radarı) + Sistem Karnesi.
- Kupon aktarımı: editörde **Sistem · Seçimim**. "Kriter" düğmesi 2026-08-07'de
  kaldırıldı (kullanıcı kriter seçimi kalkınca "Sistem" ile aynı işi yapıyordu).
  Maç kartındaki "⚙ Sistemden al" da resmî tahmine (`m.prediction`) bağlıdır.
- `components/MatchInfoCard.js` — lig/hafta + stadyum + hava kartı.
- `App.js` — sekmeler: Ana Sayfa · Bülten · Radar · Profil. `api.js`, `auth.js`,
  `theme.js`, `utils.js`, `liveLogic.js`, `prefs.js`.

## 6. TEK MOTOR — MASTER ANALİZ (ÖNEMLİ)
> ⚠️ **GÜNCELLEME (2026-08-07).** Cihaz tarafındaki hafif motorlar KALDIRILDI.
> Artık tek motor var: **`backend/src/analysis/masterEngine.js`** (40 kriter).
> `analysisService.js` üzerinden `/api/analysis` ve karne uçlarını besler;
> Analiz, Radar ve Sistem Karnesi ekranlarında görünen budur.
>
> Ayrıca **kullanıcı kriter seçimi kaldırıldı**: analiz her zaman resmî profille
> hesaplanır. Kriter seçme ekranı, profil sürümleme, kullanıcı analizi kaydetme
> ve ilgili uçlar (`/api/analysis/profiles*`, `save-user-analysis`) silindi.
>
> Aşağıdaki 6 kriterlik anlatım, kaldırılan hafif motorun mantığıdır — tarihsel
> değeri için korunuyor, **yaşayan kod değildir.**

(TARİHSEL) Kaldırılan dosya: `app/src/userMatchEngine.js` → `analyzeUserMatch(m)`. Yalnız şu kriterler
çalışır (başka yok — xG/oran/AI/hakem/hava KARARDA kullanılmaz):

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

## 8.1 KALDIRILAN ÖZELLİKLER (geri gelmesi istenmiyor)
- **Yayın Stüdyosu** (2026-08-06): dört ekran (Broadcast/StudioBulletin/
  StudioMatch/StudioKarne), `broadcast*.js`, `studioKarne/studioCouponSave`,
  `userMatchEngine.js` (yalnız oradan erişiliyordu), 9 test ve
  `scripts/render-studio.mjs` SİLİNDİ. Özellik anahtarı (`features.js`) de
  kalktı. **Duran ve stüdyoya AİT OLMAYAN modüller:** `studioParts.js`
  (ortak tablo parçaları), `couponStudioParts.js`, `studioTheme.js`,
  `studioFonts.js`, `studioShare.js` — dördü de KUPON ekranlarını besliyor;
  adlarındaki "studio" yalnız miras.
- **Oyunlaştırma** (2026-08-06): rozet/puan/seviye/görev/liderlik tamamen
  söküldü (backend uçları + app ekranları + bildirim türleri).
Silinen dosyalar `_to_delete/` altında duruyor.

## 9. MEVCUT DURUM (devir anı)
- **GÜNCEL (2026-08-06): `main` ve `feature/gecmis-bulten-ve-rozet-tasarimi` AYNI
  noktada.** Yayın (Render) `main`'i izler; feature dalına commit atılır, sonra
  `main`'e ileri sarılır (`github-main-birlestir.bat`).
- **`backend/.env` git'te YOK** (anahtarlar) — ayrıca güvenli şekilde paylaşılmalı:
  `FOOTYSTATS_API_KEY`, `FOOTYSTATS_SEASON_IDS`, `APIFOOTBALL_API_KEY`,
  `SUPABASE_URL/PUBLISHABLE_KEY/SECRET_KEY` (adlar için `render.yaml`).
- Bilinen eksikler: eksik oyuncu & teknik direktör verisi (kaynak yok) → kriter
  4-5 hep "Bilinmiyor"; H2H tek-tek skorları yok (özet var); `backend/data` (kupon)
  Render free'de kalıcı değil (Supabase tablosuna taşınmalı).
- Deploy istenirse: feature → `main` merge + push → Render otomatik deploy.

### 9.1 Radar tamamlama sistemleri (2026-07 görevi)
- **Resmî geçmiş bülten hafızası** (`src/history/`): sportoto.gov.tr'nin kendi
  açık webapi'sinden geçmiş sezon/haftalar checkpoint'li + sayfalı içe aktarılır
  (`importer.js`), provenance `official_result_history` — ileri-test karnelerine
  ASLA girmez, geçmişe tahmin YAZILMAZ. Skor↔sonuç çapraz doğrulanır; uyuşmazlık
  `result_conflict` + audit, analiz dışı. Depo: `historyStore.js` (dosya/Supabase
  — migration **005**). Zamanlayıcı: `scheduler.js` (server.js açılışında).
- **Bülten Sıra DNA'sı** (`src/history/positionDna.js`): 1-15 sıra 1/X/2
  dağılımları (son 5/10/25/50/tümü + sezon + segment + eğilim + shrinkage;
  n<10 yön sinyali yok). Uç: `GET /api/radar/position-dna` (öğrenme sınırı:
  güncel hafta hariç). Radar 5 = "Bülten DNA".
- **Oynanma yüzdesi çerçevesi** (`src/providers/playedPercentages.js` +
  `percentageDna.js`): sağlayıcı adaptör kaydı (Bilyoner kayıtlı fakat açık uç
  doğrulanmadığı için `enabled:false` — uydurma yüzde YOK), toplam doğrulama,
  opening/regular/pre_freeze/post_lock_research semantiği (mühür = ilk maç −5dk),
  bant + geri çekilme hiyerarşili DNA, sağlayıcı uzlaşması. Radar 3 = "Oynanma DNA".
- **Rakip Seviyesi & Saha Performansı** (`src/analysis/opponentStrength.js`):
  point-in-time rakip sınıfı (bugünkü tablo geçmişe uygulanmaz), ev yalnız iç
  saha / deplasman yalnız dış saha, lig büyüklüğüne duyarlı yüzdelik, kalite
  etiketleri (Kaliteli/Şişirilmiş/Seviye Testi Eksik/Güçlü Rakip Sorunu).
  Radar 1 = "Rakip Gücü". refresh.js `attachVenueProfiles` ile bağlar.
- **Kullanıcı dili**: Orta Risk→Temkinli, Sürpriz Adayı→Sürpriz Sinyali,
  Yetersiz Veri→Analiz Hazır Değil; `unsupported` alanlar (sakatlık vb.) veri
  puanını düşürmez ve kartlarda tekrarlanmaz (metodolojide bir kez açıklanır).
- **Migration 005** (`migrations/005_history_dna.sql`): history tabloları +
  `bulletin_data_observations`'a kind/usable_for_prediction/first_observed_late.
  Idempotent, DELETE yok, kilitli snapshot'lara dokunmaz. Supabase'e uygulanmadan
  geçmiş içe aktarım Supabase sürücüsünde bekler (backoff'la dener; dosya
  sürücüsünde `HISTORY_DRIVER=file` ile çalışır).
- **Migration 007** (`migrations/007_moderation_report_block.sql`): moderasyon —
  `comment_reports` (aynı kişi aynı yorumu bir kez bildirir; sebep `CHECK` ile 7
  değere kilitli) + `user_blocks` (çift yönlü tekillik). İkisinde de RLS açık.
  Sebep listesi ÜÇ yerde yazılı — `backend/src/moderation.js`,
  `app/src/moderationReasons.js` ve bu dosyadaki `CHECK` — ve üçünün eşleşmesi
  `backend/test/moderation.test.mjs` + `app/test/moderation-reasons.test.mjs`
  tarafından **testle** korunur; elle eşleşmeye güvenilmez.
  **Gizlilik kararı:** bildirim sayısı, bildiren kimliği ve engelin yönü hiçbir
  uçtan dönmez ve hiçbir ekranda gösterilmez; "beni kim engelledi" diye bir uç
  YOKTUR. Yorum listesi engel kümesi okunamazsa **503 döner** (fail-closed),
  süzgeçsiz liste asla gösterilmez.

- **Moderasyon süreci — Topluluk Kuralları + operatör paneli (2026-07-25).**
  Google'ın kullanıcı içeriği için istediği üç şartın üçüncüsü: bildirimlere
  karşılık veren yazılı bir inceleme süreci.
  - **Herkese açık sayfa:** `backend/legal/topluluk-kurallari.html` →
    `/topluluk-kurallari` (+ `/community-guidelines`, `.html`). Gizlilik ve
    hesap silme sayfalarıyla aynı `serveLegal()` mekanizması. Uygulama
    kurulmadan açılır. Uygulamadaki bağlantı Hakkında ekranında; yol TEK
    kaynakta: `app/src/brand.js` → `COMMUNITY_RULES_PATH`, ve
    `app/test/moderation-panel.test.mjs` bunun `server.js`'teki rotayla
    aynı olduğunu ölçer.
  - **Yetki:** `backend/src/moderatorGate.js`. Operatör listesi YALNIZ
    `backend/.env` → `MODERATOR_EMAILS`. Liste tanımsız/boşsa **herkes
    reddedilir** (fail-closed). Eşleşme tamdır (alt-dize yetki vermez),
    e-postası **doğrulanmamış** hesap listede olsa bile operatör değildir,
    istemcinin "ben moderatörüm" demesi hiçbir şey ifade etmez. Bu değişkeni
    başka hiçbir dosya okumaz — test bunu da korur.
  - **Uçlar:** `backend/src/routes/moderation.js` (`/api/moderation` altında).
    `GET /access` kapının ÜSTÜNDEDİR ve herkese **200** döner
    (`{operator:true|false[, sebep:'eposta-dogrulanmamis']}`); diğer dördü —
    `GET /reports`, `POST /comments/:id/hide`, `POST /comments/:id/unhide`,
    `POST /reports/:id/dismiss` — operatör olmayana **403**.
  - **İşlemler:** `backend/src/moderationOps.js`. `yorumuGizle` ÖNCE yorumu
    gizler SONRA bildirimleri kapatır; sebebi **elle** yazar — bu, otomatik
    gizlemeyi MÜHÜRLER (bildirimler geri çekilse de yorum açılmaz).
    `yorumuGeriAl` ÖNCE bildirimleri kapatır SONRA gizlemeyi temizler (ters
    sıra, yorumun kendini yeniden gizletmesine yol açardı).
    `bildirimiYokSay` idempotenttir ve **elle** gizlenmiş yorumu AÇMAZ.
    `bekleyenBildirimler` yoruma göre gruplar, `total` gerçeği söyler, silinmiş
    yoruma ait bildirimler sessizce atılmaz — `orphanCount` olarak sayılır.
  - **Uygulama tarafı:** `app/src/screens/ModerationScreen.js` (ekran),
    `app/src/moderationView.js` (saf karar mantığı — ekran JSX olduğu için
    testler bu modülü çalıştırır), Profil'deki giriş `moderationAccess()`
    cevabına bağlı ve **varsayılan olarak gizlidir** (hata durumunda da).
    **Uygulamaya hiçbir operatör kimliği gömülmez** — Android paketi okunabilir
    bir dosyadır; `MODERATOR_EMAILS` uygulamanın hiçbir dosyasında geçmez ve
    test bunu tarar.
  - **Gizlilik:** bildirenin kimliği **operatöre de** gösterilmez. Panelde
    yalnız KAÇ KİŞİ bildirdiği görünür (otomatik gizleme eşiği üç FARKLI
    kişidir; bu sayı olmadan karar verilemez).
  - **Testler:** `backend/test/moderation-ops.test.mjs` (52; 44–52 gerçek
    şemaya karşı), `backend/test/legal-pages.test.mjs` (14),
    `app/test/moderation-panel.test.mjs` (44).

### 9.2 EN GÜNCEL DURUM (2026-07-22 · devir anı — buradan devam et)
Radar bölümü şu an DÜRÜST HÂLİYLE KABUL EDİLDİ; kullanıcı diğer bölümlere geçmek
istiyor. Bu görevlerde yapılanlar:

- **Gerçek oynanma yüzdesi kaynağı (Bilyoner) — açık/oturumsuz uçlar bulundu:**
  `GET https://www.bilyoner.com/api/sto/programs/active` (program + dinamik gcNo)
  ve `GET .../api/sto/playratio?gcNo=<gcNo>` (count_1→1, count_0→X, count_2→2).
  Tarayıcıda `credentials:'omit'` ile HTTP 200 doğrulandı. Adaptör:
  `src/providers/bilyoner.js` (gerçek parser + matcher.js ile eşleştirme + belirsizlik
  reddi + `assertAsciiHeaders`). Fixture: `test/fixtures/bilyoner-1525.json`.
- **⚠️ AÇIK KONU — Bilyoner backend'den ERİŞİLEMİYOR:** ByteString hatası (UA'daki
  Türkçe 'ı') düzeltildikten sonra backend gerçek çağrıyı yapabildi ama Bilyoner
  sunucusu tarayıcı-dışı isteklere **HTTP 400 / code 40319 "giriş gerekli"** erişim
  koruması uyguluyor (7 header setinde aynı; TLS parmak izi düzeyinde bir WAF).
  **Bu koruma AŞILMADI ve aşılmayacak** (kullanıcı talimatı + ilke). Sonuç: Radar 3
  şu an gerçek gözlem YAZMIYOR; `providers:1` ama `written:0`, hata izole. Radar 3
  "gözlem bekleniyor" gösterir, sahte yüzde ÜRETMEZ — bu, kaynağın olmadığı durumda
  DOĞRU davranış (kullanıcı onayladı). Sağlayıcı incelemesi: `src/providers/PROVIDERS.md`
  (Misli = SockJS/cookie WebSocket, Nesine = İddaa'ya yönlendiriyor, Oley = yüzde yok).
  Bilyoner `enabled:true` bırakıldı (kaynak gerçek + public; erişim yolu açılırsa çalışır).
- **Migration 005 — artık elle uygulanmıyor.** Migration'lar backend açılışında
  OTOMATİK uygulanıyor (bkz. §9.3). Tek koşul `SUPABASE_DB_URL`; tanımlanana dek
  geçmiş arşiv `backend/data/history/` DOSYA deposunda birikiyor (dayanıklı düşüş:
  `supabaseStore.addObservations` kolon-yok hatasında semantik kolonları düşürüp
  raw ile yazar). Gerçek arşiv: **~23-31 hafta içe aktarıldı.**
- **Radar 5 (Bülten DNA) ekranı SADELEŞTİRİLDİ (kullanıcı isteği):** üstte yalnız
  dönem filtresi (Tüm Haftalar / Son 5 / Son 10 / Son 15), altında 15 maç, her maç
  KENDİ satırında kendi sırasının geçmiş 1/X/2 yüzdesini gösterir ("Geçmiş 1. sıra:
  1 %61 · X %13 · 2 %26", tam sayı, toplam 100). Sıra seçici / n / arşiv sayısı /
  shrinkage ana ekrandan KALDIRILDI. Pencereler EN SON tamamlanmış bültenden geriye,
  güncel hafta hariç. Kod: `positionDna.js` (`last15` penceresi eklendi),
  `RadarScreen.js` (`dnaPeriod` state + `renderMemoryRow` + `roundPct100`).
- **Test/derleme durumu:** backend **236/236** yeşil, app testleri yeşil,
  `expo export --platform web` başarılı. Yeni test dosyaları: `bilyoner-adapter`,
  `bilyoner-headers` (ByteString regresyon), `observation-resilience`.
- **Teslim raporları** (kök dizinde): `RAPOR-radar-tamamlama.md`,
  `RAPOR-oynanma-ve-migration.md`, `RAPOR-bytestring-duzeltme.md`,
  `RAPOR-radar-tarif-denetimi.md`.
- **Geçici tanı dosyası** cihazda `backend/_to_delete/bilyonerDiag.js` — silinebilir.
- **SIRADAKİ:** kullanıcı radar dışı bölümlere geçmek istiyor (ana bülten ekranı,
  maç detayı, geçmiş bülten/sonuç, kupon akışı, Sistem/Kriter Karnesi, üyelik/profil/
  topluluk). Hangi bölüm + orada görülen sorun kullanıcıdan alınacak.

### 9.3 OTOMATİK MIGRATION MOTORU (2026-07-25)
Veritabanı şeması artık yayın altyapısının bir parçası: **elle SQL çalıştırılmıyor.**

- **Nerede:** `backend/src/migrate/` — `plan.js` (hangi dosya çalışacak kararı; saf,
  DB'siz test edilebilir), `sqlScan.js` (ifade ayırıcı: metin/tanımlayıcı/yorum/
  dolar-tırnak farkındalığı + psql meta-komutu ayıklama), `runner.js` (uygulayıcı),
  `verify.js` (tablo/RLS/trigger doğrulaması), `dbUrl.js` (bağlantı + gizlilik
  süzgeci), `index.js` (açılış sarmalayıcısı). Ayrıntı: `backend/migrations/README.md`.
- **Ne zaman:** `server.js` içinde `app.listen` geri çağrısında, **worker ve
  scheduler'lardan ÖNCE**. Migration başarısızsa `startAutoRefreshScheduler`,
  `startHistoryAndObservationScheduler`, `startArchiveWorker` ve `syncCatalog`
  BAŞLAMAZ (hepsi veritabanına YAZAR). HTTP dinleyici bilerek ayakta bırakılır ki
  durum `/api/health` → `migration` alanından okunabilsin.
- **Açılış kapısı — ortam ayrımı (`index.js`):** `NODE_ENV=production` + Supabase
  yapılandırılmış + `SUPABASE_DB_URL` YOK ⇒ `ok:false`, worker'lar başlamaz.
  Aynı durum **geliştirmede** yüksek sesle uyarır ama backend'i durdurmaz
  (`MIGRATIONS_REQUIRED=1` orada da kapatır). Supabase hiç yapılandırılmamışsa
  dosya modudur, migration gerekmez. Karar tablosu `test/migrate-gate.test.mjs`
  ile ölçülür (7 test, DB gerektirmez).
  *Bu testler bir uyumsuzluktan doğdu: dokümanlar "bağlantı yoksa worker'lar
  BAŞLAMAZ" diyordu, kod ise ortam ayrımı yapmadan devam ediyordu. Cihazda backend
  açılıp log okununca görüldü ve düzeltildi.*
- **Defter:** `public.schema_migrations` (version, filename, checksum(sha256),
  applied_at, applied_ms, applied_by, seq). RLS açık + policy YOK ⇒ anon/publishable
  anahtarla erişim reddedilir. Satırlar silinmez/güncellenmez.
- **Eşzamanlılık:** PostgreSQL advisory lock (`sha256('sportoto:schema_migrations:v1')`
  türevi anahtar, oturum düzeyinde ⇒ süreç çökerse kendiliğinden serbest kalır).
- **Tek doğruluk kaynağı:** dosya listesi diskten okunur. `npm run migrate` artık
  psql çağırmıyor, aynı motoru çalıştırıyor (`scripts/migrate.js`). *Eski psql
  listesi 004'te unutulmuştu — 005 ve 006 o yoldan HİÇ çalışmıyordu.*
- **Kanıt:** `test/migrate-live.test.mjs` gerçek PostgreSQL 16'ya karşı 12 test
  (sıra, tek kez, 2 ve 5 eşzamanlı backend, tam rollback, kaldığı yerden devam,
  bütünlük reddi, sırasız reddi, kurala uymayan dosya adı reddi, **kilitli veri
  parmak izi değişmiyor**, gizlilik, doğrulayıcı öz-denetimi).
  `MIGRATION_TEST_DB_URL` yoksa ATLANIR ve "atlandı ≠ geçti" uyarısı basar.
  DB'siz statik/saf testler: `migrate-plan`, `migrate-scan`, `migration-safety`.
- **⛔ AÇIK KOŞUL:** `SUPABASE_DB_URL` (Supabase → Project Settings → Database →
  Connection string, **session/direct 5432**, 6543 pooler DEĞİL) backend ortamında
  tanımlı olmalı. PostgREST (`SUPABASE_URL`+`SUPABASE_SECRET_KEY`) DDL çalıştıramaz —
  yetki değil, protokol sınırı. Tanımlanana dek şema güncellenmez ve worker'lar başlamaz.

### 9.4 DEVİR ANI (2026-07-25 · buradan devam et)

- `SUPABASE_DB_URL` **tanımlandı**; otomatik migration çalıştı, worker/scheduler
  kendiliğinden başladı (kullanıcının ölçümü — ne bulut kabı ne cihaz VM'i
  Supabase'e ulaşabiliyor). Telefon bildirimleri **gerçek Android cihazda**
  doğrulandı (yine kullanıcının ölçümü).
- **E9 üç şartın üçü de kapandı:** bildirme + engelleme (yorum menüsü,
  Engellenen Kullanıcılar ekranı) ve **inceleme süreci** (Topluluk Kuralları
  sayfası + operatör paneli — yukarıdaki migration 007 maddesine bak).
- **Kullanıcıdan beklenen tek kod-dışı adım:** `backend/.env` içine
  `MODERATOR_EMAILS=<doğrulanmış e-posta>`. Bu satır olmadan operatör YOKTUR;
  İnceleme girişi kimsede görünmez.
- **Ölçüm (bulut):** backend **486/486** (gerçek PostgreSQL 16 bağlı, 0 atlandı),
  uygulama **376 geçti / 1 atlandı**, `index.bundle` **HTTP 200**.
- **Ölçüm (cihaz bilgisayarı):** `moderation-ops` + `legal-pages` **57 geçti /
  0 kaldı / 9 atlandı**; `moderation` + `migrate-live` **21 geçti / 0 kaldı /
  23 atlandı**. Atlananlar canlı PostgreSQL isteyen testlerdir (cihazda
  `MIGRATION_TEST_DB_URL` yok) — **atlandı, geçti demek değildir.** Tam 486'lık
  süit cihazda **ölçülemedi**: ağ dokunan testler cihaz VM'inde ~42 kat yavaş
  (`api.test.mjs` 17,9 sn / bulutta 0,43 sn) ve cihaza verilen her komut 45 sn'de
  kesiliyor, arka plan süreci de komutlar arasında yaşamıyor.
- **Eşitleme dersi (tekrarlanacak):** `git status --short` bu çalışma kopyasında
  2,1 MB çıktı ürettiği için bir bölümün değişenlerini ayırt etmeye yaramıyor.
  Bunun yerine **dosya dosya md5 dökümü** alınıp bulut ↔ cihaz karşılaştırıldı
  (`find … | xargs md5sum`). Yalnız bu tarama sayesinde cihazda **2 eksik yardımcı
  dosya** (`backend/test/helpers/livePg.mjs`, `pgSupabase.mjs`) ve **2 eski test
  dosyası** görüldü; bunlar olmadan cihazdaki moderasyon testleri
  `ERR_MODULE_NOT_FOUND` ile çöküyordu. Şu an `backend/src` + `app/src` +
  `app/test` (**261** dosya) ve `backend/test` (**45** dosya) ağaçlarının tamamı
  bulutla **birebir aynı**.
- **Henüz denenmemiş:** gerçek telefonda Bildir/Engelle ve İnceleme akışı.
- **Ertelenmiş (kullanıcı kararı):** alan adı + HTTPS, destek e-postası, Play
  Console + imzalama anahtarı, applicationId onayı, marka sorgusu, ad kararı,
  "kupon" dili kararı, mağaza görselleri. Kod tarafındaki eksikler bitmeden
  yayın adımlarına geçilmiyor.

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
