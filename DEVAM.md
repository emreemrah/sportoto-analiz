# DEVAM NOTU — yeni oturuma devir (27 Temmuz 2026)

Bu dosya, **yeni bir Cowork oturumunun (yeni hesap) hiçbir şey sormadan
kaldığı yerden devam edebilmesi** için yazıldı. Önce `CLAUDE.md`, sonra
`HANDOFF.md`, sonra bu dosya okunmalı. Bu dosyada yazan kurallar
**kullanıcının kendi koyduğu kurallardır**, öneri değildir.

---

## 0) Kullanıcı ve çalışma biçimi

- Kullanıcı: **emrah**. Proje: **Sportoto Master Analiz** — Spor Toto bülteni için
  **analiz / kupon karar desteği**. **Bahis veya ödeme sistemi DEĞİL.**
- Kullanıcının en sık tekrarladığı kural, aynen:
  **“manuel işlem istemiyorum sen yapacaksın otomatik olacak.”**
  → Ona çalıştırması için komut verilmez, panel adımları anlatılmaz.
  Kurulum, dosya yazma, test, sunucu kontrolü **asistan tarafından**
  cihaz köprüsü (`mcp__remote-devices__*`) ve Chrome köprüsü ile yapılır.
  Tek istisna: onun hesabına ait dış paneller (aşağıda §6).
- Rapor dili **Türkçe**, sade, abartısız. Kod içi yorumlar da Türkçe ve
  “neden böyle yapıldı” anlatır.

---

## 1) Yollar ve servisler

| Ne | Nerede |
|---|---|
| Cihazdaki proje (Windows) | `C:\Users\emrah\sportoto-analiz-karar-motoru-test` |
| Aynı proje (yalnız `device_bash` için Linux mount) | `/sessions/<oturum>/mnt/sportoto-analiz-karar-motoru-test` |
| Backend | Node.js ESM + Express, **:4000** (`backend/`) |
| Uygulama | Expo SDK 56 React Native web, **:8081** (`app/`) |
| Anahtarlar | **yalnız `backend/.env`** — koda/commit'e/loga asla yazılmaz |

**Kritik ayrım:** `device_commit_files` / `device_stage_files` **Windows**
yolunu ister; `device_bash` **Linux mount** yolunu ister. Karıştırılırsa
“dosya yok” hatası alınır.

---

## 2) Cihazla çalışırken bilinen tuzaklar (hepsi bu projede yaşandı)

1. **`device_stage_files` bazen ESKİ (bayat) bir kopya döndürür.** Bir kez
   sunucu dosyası 32.301 bayt olarak geldi, cihazdaki gerçek dosya 34.542
   baytken. Diff yanlış çıktı. **Her zaman `device_bash md5sum` ile çapraz
   doğrula.** Şüphede kalırsan cihazda `cp` ile taze bir yola kopyala ve onu
   stage et.
2. **`expectedMtimeMs` alt saniye hassasiyetlidir.** `stat -c %Y` saniye verir;
   `...543000` yazarsan reddedilir, doğrusu `...543068` olabilir. Reddedilen
   yanıt gerçek `deviceMtimeMs` değerini söyler — onu kullan. **`force:true`
   ancak md5 ile içeriğin değişmediğini kanıtladıysan.**
3. **`device_bash` 45 saniyede kesilir.** Test süitlerini **tek tek** çalıştır:
   `timeout 40 node --test test/<dosya>.test.mjs`. Çıktıyı süzerken `grep -a`.
4. **Cihazda `rm` YASAK** (izin verilmiyor). Silinecek şey `_to_delete/` altına
   `mv` edilir ve kullanıcıya söylenir; klasörü **o** temizler.
   Şu an içinde: `_to_delete/stage-check-8`, `_to_delete/stage-check-9`.
5. Bazı backend dosyaları `-r--r--r--` modunda; `device_bash` ile düzenlemeden
   önce `chmod +w` gerekir (`device_commit_files` etkilenmez). Hâlâ salt okunur:
   `apifootball.js`, `footystats.js`, `sportoto.js`, `misli.js`, `nesine.js`,
   `routes/auth.js`, `routes/comments.js`, `routes/coupons.js`, `routes/predictions.js`.
6. **Canlı doğrulama Chrome köprüsüyle yapılır.** Onun tarayıcısında
   `http://localhost:8081/` sekmesi açık; oradan `javascript_tool` ile
   `fetch('http://localhost:4000/...')` çağrılır. `device_bash`’in ağı yoktur.
   `javascript_tool` çıktısı ~1300 karakterde kesilir → yanıtı `.slice()` ile kırp.

---

## 3) DEĞİŞMEZ KURALLAR (kullanıcının koyduğu — ihlal edilmez)

- **Yeni npm paketi kurma; sormadan push / PR / deploy yapma.**
  (Bugüne kadar tek tek onaylananlar: `expo-notifications`,
  `expo-local-authentication`, `pg`, `expo-font` + `@expo-google-fonts/barlow-semi-condensed`.
  Başka hiçbiri onaylı değil.)
- **Sahte/kesin sonuç üretme.** Veri yoksa “bu veri bulunamadı” yazılır, güven
  düşürülür. **Yalnız resmî Spor Toto sonucu kesindir.**
- **İddialı dil yok:** kesin / garanti / banko / yanılmaz / net favori.
- **Arayüzde marka adı yok** (ör. FootyStats görünmez; CDN yalnız
  `backend/src/crestProxy.js` içinde).
- **Bilyoner WAF (HTTP 400 / 40319) ASLA atlatılmaz.**
- **Depolama anahtarları yeniden adlandırılmaz:** `sportoto.token`,
  `sportoto.prefs`, `sportoto.couponCenter.v1`, `sportoto.analysisProfiles.v2`,
  `sportoto.analysisProfile.v1`, `sportoto.notifications.v1`, `sportoto.push.v1`,
  `sportoto.broadcastStudio.v1`.
- **Arşiv silinmez/değiştirilmez:** bülten arşivi, mühürlü analizler, resmî
  sonuçlar, Radar ve Sistem Karnesi verileri.
- Kullanıcı kuponu başka kullanıcıya görünmez; hesap/telefon/e-posta/token
  hiçbir yüzeyde görünmez; paylaşılan görsellerde kişisel veri yoktur.
- **İlk yarı sonuçları hiçbir hesaplamada kullanılmaz.**
- **Uygulamanın adı onun onayı olmadan başka markaya çevrilmez.**
- **“Bulut veya birim test sonucunu gerçek cihaz başarısı gibi sunma.”**
  → Bulut sonuçları ve onun makinesindeki sonuçlar **ayrı ayrı** raporlanır.
- Kolon sayısı 2.500 sınırı ve birim kolon bedeli kuralı: **yayın stüdyosunda
  kullanıcı tarafından kaldırıldı**, ama `CouponEditorScreen.js` ve
  `coupon/smart.js` için **hâlâ geçerli** (testlerle kilitli).

---

## 4) Son iş: Radar 4 için İKİNCİ ORAN KAYNAĞI (talep aynen: “radar 4 bulunan
maçın oranlarını veren bir yerden daha çekelim, eskiside kalsın”)

> ### ✅ 27 Temmuz — BU KAYNAK KALDIRILDI (iş bitti)
> emrah’ın son ve bağlayıcı talimatı aynen şu:
> **“ozaman sadece radar 4 eklediğimiz 2. oran satırını silelim diğerleri
> eskisi gibi kalsın”**
>
> Yani **yalnız §5-A uygulandı** (ikinci oran kaynağı söküldü). **§5-B
> İPTAL EDİLDİ**: canlı dakika, canlı istatistik çubukları ve canlı olay
> şeridi **yerinde kaldı**; `src/sources/apifootball.js`, `config.js` ve
> `APIFOOTBALL_API_KEY` **duruyor**. Bu talimat, daha önceki “Canlı bölümleri
> ekrandan kaldır.” yanıtını **geçersiz kılar**.
>
> Aşağıdaki envanter, neyin söküldüğünü geriye dönük okumak için duruyor.

**Durum: kod tarafı BİTTİ, senkron edildi, testler yeşil. Gerçek veri akışı
kullanıcının hesabı askıda olduğu için doğrulanamadı — ve artık
doğrulanmayacak, çünkü kaynak kaldırılıyor.**

- **Eski kaynak aynen duruyor** — `recordObservationsFromData()`
  (`backend/src/archive/snapshotService.js:117`), `source: 'refresh'`, verisi
  FootyStats’tan gelen `preOdds`. Hiç ellenmedi. `registerOddsProvider`,
  `'refresh'` kimliğini iddia eden adaptörü **hata fırlatarak reddeder** —
  yani eski yazıcı yapısal olarak korunuyor.
- **İkinci kaynak:** `backend/src/providers/apifootballOdds.js` (API-Football
  v3, maç-öncesi 1/X/2, birden çok şirketin **ortancası**). Çerçeve:
  `backend/src/providers/marketOdds.js`, kimlikler `providers/oddsSources.js`.
- **Çağrı bütçesi:** ikinci kaynak yalnız **açılış (+75 sn), günlük mühür
  (23:55) ve mühür öncesi** çalışır; 30 dakikalık kadansta **çalışmaz**,
  hata alınca **tekrar denemez**.
- **Kaynaklar birleştirilmez, ortalaması alınmaz.** Ekranda her kaynak kendi
  satırında; yön oku yalnız **aynı** kaynağın önceki günüyle kıyaslanır.
- **Radar 4’ün altın kuralı korundu:** “o güne ait gözlem yoksa geriye dönük
  oran ÜRETİLMEZ.”
- **Erişim durumları ayrı kodlarla yazılır** (karıştırmak yasak):
  `no_fixture_match` (liste alındı, maç yoktu) · `fixture_lookup_failed`
  (denedik, alamadık) · `outside_access_window` (kaynak “şu tarihler arası”
  dedi, hiç denemedik) · `source_blocked` (erişim kapalı) · `no_odds_published`.
- **Devre kesici:** “suspended / invalid key / not subscribed / quota” gibi
  yanıtlarda tur **anında** durur ve kaynak kendini kapatır (kota: UTC gün
  dönümüne kadar, hesap: 6 saat). Soğuma boyunca **tek ağ isteği bile
  yapılmaz**. Sebebi: **aynı API anahtarını canlı skor yolu da kullanıyor**
  (`src/sources/apifootball.js` → `server.js:153 refreshLiveScores()`).
  FootyStats canlı skoru (`refreshLiveFootyScores`, `server.js:425`) ayrı ve
  ayakta.
- **Teşhis ucu:** `GET /api/internal/odds-source-probe` → kaynağa **gerçek**
  istek atar (en çok 2 çağrı), anahtarı yanıtta döndürmez, soğumayı bilerek
  dinlemez ve engel kalkmışsa soğumayı temizler.

### Test sayıları — SÖKME SONRASI (27 Temmuz, iş bitti)
| Süit | Bulut | emrah’ın makinesi |
|---|---|---|
| `backend/test/market-odds-framework.test.mjs` **(YENİ)** | 20/20 | 20/20 |
| `backend/test/radar-odds-reason.test.mjs` | 16/16 | 16/16 |
| `backend/test/history-scheduler.test.mjs` | 4/4 | 4/4 |
| `app/test/radar-screen-logic.test.mjs` | 8/8 | 8/8 |
| `app/test/radar-odds-reason.test.mjs` | 7/7 | 7/7 |
| Tüm backend süiti | 576 geçti / 0 kaldı (32 atlandı) | — |
| Tüm app süiti | 630 geçti / 0 kaldı (1 atlandı) | — |

Kaldırılan süitler (`market-odds-second-source.test.mjs` 53 test,
`radar-odds-multi-source.test.mjs` 16 test) `_to_delete/` altında duruyor.
md5’ler bulut ↔ cihaz birebir aynı.

---

## 5) YAPILAN İŞ — Radar 4’ün ikinci oran satırı söküldü (27 Temmuz)

**DURUM: A tamamlandı, B iptal.** emrah’ın son talimatı kapsamı daralttı:
sadece **A) ikinci oran kaynağı** söküldü, **B) canlı bölümler ellenmedi**.

### İşe başlamadan
`fetch('http://localhost:4000/api/radar/daily-odds')` → **eski kaynağın
çalıştığını** kaydet (beklenen: `sources:["refresh"]`,
`sourceLabels:{"refresh":"Birincil oran kaynağı"}`, 15 maç). Bu, iş bitince
**aynen** böyle kalmalı. Sökme işleminin tek kırmızı çizgisi bu: **eski oran
kaynağına dokunulmaz.**

### A) İkinci oran kaynağını kaldır — ✅ YAPILDI
1. `backend/src/providers/marketOdds.js` → `apifootballOdds` import’u ve
   `registerOddsProvider(apifootballOddsAdapter)` satırı (≈62) silinir.
   **Çerçevenin kendisi KALIR** (`registerOddsProvider`, `validateOdds`,
   `collectKnownFixtureIds`, `observeMarketOdds`): scheduler bunu kullanıyor
   ve `'refresh'` kimliğini koruyan yapısal kilit burada. Sağlayıcısız hâli
   zararsızdır, durum kaydına “kayıtlı sağlayıcı yok” yazar.
2. `backend/src/providers/apifootballOdds.js` → cihazda `_to_delete/` altına
   **`mv`** (silme yasak).
3. `backend/src/server.js` → `/api/internal/odds-source-probe` rotası
   (≈551) ve ilgili import kaldırılır.
4. `backend/src/providers/oddsSources.js` → `SECOND_ODDS_SOURCE` ve etiketi
   çıkar; `LEGACY_ODDS_SOURCE` + `sortOddsSources` **kalır**.
5. `backend/test/market-odds-second-source.test.mjs` (53 test) kaldırılır —
   **ama önce** eski kaynağı koruyan üç davranış `radar-odds-reason.test.mjs`
   içine taşınır: (a) `'refresh'` kimliğini iddia eden sağlayıcı reddedilir,
   (b) o güne gözlem yoksa geriye dönük oran üretilmez, (c) oranı olmayan maça
   sebep yazılır. **Bu üçü kaybolmamalı.**
6. Ekran tarafı: `app/src/screens/RadarScreen.js` içindeki çok-kaynaklı
   görünüm ve `app/test/radar-odds-multi-source.test.mjs` (16 test) kaldırılır.
   Tek kaynaklı yol zaten `oddsMultiSource` bayrağı kapalıyken çalışan yoldur;
   sökerken **Radar 4’ün mevcut görünümü birebir korunmalı**.

### B) Canlı bölümlerini kaldır — ❌ İPTAL (yapılmadı, yapılmayacak)

> emrah: **“diğerleri eskisi gibi kalsın”**. Canlı dakika, canlı istatistik
> çubukları ve canlı olay şeridi **ekranda duruyor**; aşağıdaki adımların
> **hiçbiri uygulanmadı**. `sources/apifootball.js`, `config.js` ve
> `APIFOOTBALL_API_KEY` yerinde. Metin, ileride yeniden istenirse diye duruyor
> — **kendiliğinden uygulanacak bir plan değildir, önce sorulur.**
1. **`app/src/screens/LiveMatchDetailScreen.js` DOSYASI SİLİNEMEZ.** Bildirime
   dokunma rotası oraya gidiyor (`src/pushRoute.js` → `MAC_ROTASI`,
   `App.js:179`), ve `app/test/push-route.test.mjs` içinde 8’den fazla test
   buna bağlı. Kaldırılacak olan **ekranın içindeki canlı istatistik ve olay
   şeridi panelleri** ile `hasLiveData` bağımlılığıdır — ekranın kendisi ve
   rota **kalır**.
2. `backend/src/server.js` → canlı detay ucundaki (≈318-345)
   `fetchLiveFixtures` / `fetchFixtureStatistics` / `fetchFixtureEvents`
   kullanımı ve `sources/apifootball.js` importu (≈16) kaldırılır.
3. `backend/src/refresh.js` → `apifootball.js` importu (≈12), `refreshLiveScores()`
   (≈744) ve `server.js:153`’teki çağrısı kaldırılır.
   **`refreshLiveFootyScores` (FootyStats) KALIR** — geçici skorun tek kaynağı o.
4. `backend/src/sources/apifootball.js` → `_to_delete/` altına `mv`.
   (Dosya salt okunur olabilir; gerekirse `chmod +w`.)
5. `backend/src/config.js` → `apiFootballKey` / `apiFootballApi` alanları
   kullanılmaz hâle gelir; temizlenir. `.env` dosyasına **dokunulmaz**.

### Kaldırma sonrası gerçek durum (doğrulandı)
- **Durdu:** yalnız **Radar 4’ün ikinci oran satırı** (ve ekrandaki kaynak
  başlığı/etiketleri, `/api/internal/odds-source-probe` teşhis ucu).
- **Aynen devam ediyor:** canlı dakika, canlı istatistik çubukları, canlı olay
  şeridi, resmî Spor Toto sonucu, bülten, puan durumu, form, H2H, kadrolar,
  armalar, **Radar 4’ün eski/birincil oran kaynağı**, FootyStats geçici skoru.
- **Çerçeve kasıtlı olarak duruyor:** `providers/marketOdds.js` kayıtlı
  sağlayıcısız çalışır (`no-provider` ile durur, oran uydurmaz) ve `'refresh'`
  kimliğini koruyan yapısal kilidi taşır. Arka uçtaki `bySource` /
  `sourceCount` alanları kaynak-bağımsızdır, tek kaynakta eski davranışa
  birebir iner — mühürlü oran çekirdeğine dokunmamak için **korundu**.

### Bitirme kontrolü — ✅ tamamı yapıldı
`node --check` (bulut+cihaz) → test süitleri (bulut+cihaz) → `index.bundle`
**200** (6.517.833 bayt) → cihaza yazıldı → **md5 bulut ↔ cihaz birebir aynı**
→ cihazda testler tekrar çalıştı → `/api/radar/daily-odds` yanıtı Chrome
köprüsünden doğrulandı ve **işe başlamadan önceki hâliyle birebir aynı**:
`sources:["refresh"]` · `sourceLabels:{"refresh":"Birincil oran kaynağı"}` ·
15 maç · 6 gün · `counts:{total:15,withAny:10,withoutAny:5}` ·
`day0.bySourceCounts:{"refresh":7}`. Ekran görüntüsüyle de doğrulandı: Radar 4
maç başına **tek oran satırı** gösteriyor, kaynak başlığı yok.
`/api/internal/odds-source-probe` artık **404** (uç kaldırıldı).

---

## 6) Yalnız emrah’ın yapabileceği, bekleyen işler

- **API-Football hesabı askıda** — kaynağın kendi cümlesi:
  “Your account is suspended, check on https://dashboard.api-football.com.”
  Yalnız o panelden çözülür. **Oran tarafı için artık gerekmiyor** (kaynak
  söküldü), ama **canlı skor yolu hâlâ aynı anahtarı kullanıyor**
  (`src/sources/apifootball.js`) — hesap askıdayken canlı dakika/istatistik/
  olay şeridi veri bulamaz ve ekranda “veri yok” der, **uydurmaz**.
- `backend/.env` içine `MODERATOR_EMAILS=<doğrulanmış e-postası>`.
- `backend/legal/topluluk-kurallari.html` içindeki “en geç 7 gün içinde”
  inceleme sözünün teyidi.
- Resmî birim kolon bedeli → `backend/data/coupon-pricing.json` (uydurulmaz).
- Gerçek telefonda maç hatırlatma bildirimi testi.
- Mağaza yayın maddeleri (§E, E1–E10).
- `_to_delete/` klasörünü silmek.

---

## 7) Açık kalan geliştirme işleri (sırayla)

- **#203–#208 — “güvenli/riskli” dilinin temizliği.** Kullanıcı bunu
  **“Tamamen kaldır”** olarak seçti. Dosyalar: `decisionEngine.js`,
  `analysis/engine.js`, `DecisionEngineView.js`, `RadarCenterCards.js`,
  `RadarScreen.js`, `MatchDetailScreen.js`, `WeekSummaryScreen.js`.
  Keşif taraması yapıldı, **düzenleme yapılmadı.** Sonunda “risk dili geri
  sızarsa kırılan” bir test bırakılacak.
- **#212–#215 — arma/logo eşleşmeyen takımlar.** Kural koda yazılı:
  *“Buraya yalnız KAYNAK verisiyle doğrulanmış çiftler eklenir; tahmini alias
  eklenmez”* ve *“başka kulübün arması veya ‘benzeri’ bir görsel ASLA
  konmaz.”* Ayrıca kupon dışındaki ekranların doğrudan CDN’e giden arma
  isteklerini `/api/crest` üzerinden geçirmek kaldı.
- **Ertelenmiş:** `marketRadar.js` içinde hesaplanan ama hiç gösterilmeyen
  açılış oranı / hareket kolonları (`openingImplied`, `lockImplied`,
  `currentImplied`, `overroundPct`, `movement`, `inversion`).

---

## 8) Doğrulama alışkanlığı (her iş sonunda)

1. `node --check` (veya babel parse) → sonra ilgili test süitleri.
2. Web paketi: `curl -s -o /dev/null -w "%{http_code}"
   "http://localhost:8081/index.bundle?platform=web&dev=true"` → **200**.
3. Cihaza yaz → **md5 karşılaştır** → cihazda testleri **tekrar** çalıştır.
4. Raporda bulut ve cihaz sonuçları **ayrı** yazılır.
