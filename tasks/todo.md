# Görev: Yönetim (admin) paneli — v1

**Karar (tek satır):** Panel, backend'in kendisi tarafından `/yonetim` adresinde
sunulan **tek dosyalık web sayfası** olacak; yetki için YENİ bir rol sistemi
KURULMAYACAK, mevcut `MODERATOR_EMAILS` operatör kimliği kullanılacak.

## Neden web paneli, neden uygulama içi ekran değil
- Yönetim işleri (bülteni yenile, kota bak, bildirim incele) masaüstünde
  yapılır; telefonda küçük ekranda yapılması zor ve gereksiz.
- Uygulama içinde zaten `ModerationScreen` var; panel onu değiştirmez,
  masaüstünden aynı işi yapmayı ekler.
- Mağaza politikası açısından da yönetim arayüzünün uygulama paketinde
  olmaması daha temiz.

## Yetki
- Mevcut `operatorKapisi` (src/moderatorGate.js) aynen kullanılacak:
  `.env` içindeki `MODERATOR_EMAILS`, doğrulanmış e-posta şartı, fail-closed.
- Panel, uygulamanın kendi giriş ucunu (`POST /api/auth/login`) kullanır;
  ayrı bir şifre/anahtar YOK (ikinci bir sır = ikinci bir sızıntı yüzeyi).

## Yapılacaklar
- [x] Mevcut moderasyon/yetki altyapısını incele
- [x] `backend/src/routes/admin.js` — operatöre kapalı iki uç:
      `GET /api/admin/ozet`, `POST /api/admin/bulten-yenile`
- [x] `backend/admin/index.html` — tek dosya panel (giriş + Durum + Bülten + Moderasyon)
- [x] `server.js` — `/yonetim` yolundan paneli sun, `/api/admin` rotasını bağla
- [x] Bekçi testleri: uçlar operatör olmadan 403, panel yolu var
- [x] Yerelde çalıştırıp doğrula

## Kapsam dışı (v1)
- Kullanıcı silme/askıya alma (tehlikeli, geri alınamaz — ayrı karar)
- İçerik düzenleme, elle skor girme (arşiv dokunulmazlığı kuralı)
- Rol tablosu / çoklu yetki seviyesi (gereksiz saldırı yüzeyi)

## İnceleme
- Panel yalnız OKUR ve iki güvenli işlem yapar: bülteni yenile, yorum gizle/geri al.
- Hiçbir uydurma sayı yok: veri yoksa "bilinmiyor" yazılır.
- Yeni paket kurulmadı (saf HTML + JS).
- Doğrulama: `/api/admin/ozet` giriş olmadan **401** döndü (tarayıcıda ölçüldü).
- Testler: backend 950 geçti / 0 kaldı (32 atlandı — canlı veritabanı isteyenler).

## Operatör ayarı — GEÇİCİ olarak yapıldı (2026-08-06)
Kullanıcı kararı: şimdilik kendi adresi kullanılacak. `backend/.env` içine
`MODERATOR_EMAILS=emrahanlar.41@hotmail.com` yazıldı ve backend yeniden
başlatıldı. Ayrı bir "admin@" adresi açmaya gerek yok: panel, uygulamanın
kendi hesabıyla çalışır.

- Bu dosya `.gitignore`'lu → değer GitHub'a gitmez, yalnız bu bilgisayarda.
- Gerçek sunucuya geçince aynı değişkeni orada da tanımlaman gerekecek.
- İleride ayrı bir yönetim adresi açarsan tek satırı değiştirmek yeterli
  (virgülle birden fazla adres de yazılabilir).

**Şart:** bu adresle uygulamada bir hesap OLMALI ve e-postası
DOĞRULANMIŞ olmalı (kapı `email_confirmed_at` arar). Hesap yoksa önce
uygulamadan kayıt olup doğrulama bağlantısına tıklamak gerekir.

## İpucu Bandı — YAPILDI ve GERİ ALINDI (2026-08-07)
Kullanıcı kararı: istenen bu değildi (web sitesi isteniyordu). Banner ile
ilgili tüm değişiklikler geri alındı: App.js ve prefs.js eski hâline döndü,
tipConfig.js / TipBanner.js / tip-banner-mantik.test.mjs silindi. Çalışma
ağacı bu iş öncesiyle birebir aynı (git ile doğrulandı).

## Kanıt Altyapısı — 3 iş (2026-08-07)

Ortak sorun: başarı karnesine sayılan **tek** hafta var (12 maç). Bu boyutta
"örüntü bulduk" demek istatistiksel olarak boştur. Üç iş, bu sorunun üç ayrı
yüzüne bakar ve **hiçbiri karne kurallarını gevşetmez.**

### 1. Keşif havuzu — `backend/src/analysis/sinyalToplama.js`
`sinyalKayitlariniTopla({ kesif: true })` artık mührü **geç atılmış**
(`late_unverified`) haftaları da toplar. Örüntü taraması bunu kullanır.

- Başarı karnesi uçlarına **dokunulmadı**; oradaki kapı aynen kapalı.
- Beyaz liste: yalnız `late_unverified`. Demo, `legacy_backfill`,
  `retrospective_backtest` ve `unknown` **girmez** — ilk üçü üretilmiş veridir,
  sonuncusunda tahminin maçtan önce üretildiğine dair hiçbir kanıt yoktur.
- Her kayıt `kesif` ve `muhurTuru` etiketi taşır; panelde "Kaynak" sütununda
  `resmî` / `n/m keşif` / `tamamı keşif` olarak görünür. Karıştırılamaz.
- Test: `backend/test/kesif-havuzu.test.mjs` (4) — en kritiği, uydurma verinin
  havuza **sızmadığını** kanıtlayan test.

### 2. Mühürleme alarmı — `backend/src/archive/muhurDurumu.js` (yeni)
51. hafta, mührü ilk maçtan sonra atıldığı için karneye giremedi ve bu
**sessizce** oldu. Mühür kaçtıktan sonra geri dönüş yok; tek savunma önceden
uyarmak. Yeni uç: `GET /api/admin/muhur-durumu` (salt okur, mühür atmaz).

- Durumlar: `saglam` / `gec` / `kayip` / `bekliyor` / `eksik` / `bilinmiyor`.
- İlk maça 6 saat kala mühür yoksa **kritik**, 24 saat kala uyarı.
- Panelde Genel sekmesinin **en üstünde** alarm bandı + hafta hafta tablo.
- Test: `backend/test/muhur-alarmi.test.mjs` (9) — "iyi haber kötü haberi
  gizlemez" testi dahil.

### 3. İleri-doğrulama — `backend/src/analysis/oruntuTarayici.js`
Bir örüntüyü bulduğu verinin üzerinde ölçmek kendini doğrulamaktır.
`ileriDogrula()` örüntüyü **eski** haftalarda arar, **en son haftayı** sınav
olarak ayırır ve örüntünün hiç görmediği veride ne olduğunu yazar.

- Veri yetmiyorsa (< 3 hafta) sayı **uydurulmaz**: `yeterli:false` ve sebep
  döner. Bugünkü veriyle panelde görünecek şey büyük ihtimalle budur — ve
  doğrusu da odur.
- Panelde ayrı kart: Eğitimde / Sınavda / tuttu·kısmen·tutmadı.
- Test: `backend/test/ileri-dogrulama.test.mjs` (5) — en önemlisi, eğitimde
  %100 olup sınavda çöken örüntünün **ifşa edildiğini** kanıtlayan test.

### Bekçi testi
`yonetim-paneli.test.mjs`: panel.js'in aradığı her `$('id')` index.html'de var
mı? Eksik id, script'i o satırda öldürür ve ekran "boş ama hatasız" görünür.

**Doğrulama:** backend süitleri parça parça çalıştırıldı, **0 başarısız**.
Panelin tarayıcıda görsel doğrulaması **yapılamadı** (Chrome eklentisi oturum
sırasında bağlantıyı kesti) — bu adım açık kaldı.

## Kriter Seçimi Kaldırıldı → Kriter Başarıları Maç İçine (2026-08-07)

Kullanıcı kararı ve gerekçesi: "Yorum katmayacaksın, olanı göstereceksin. Bu
kriter burada başarılı demeyecek — bunu ben tutan maçlardan kendim bakarak
anlamam lazım." Kriter seçme paneli kaldırıldı; yerine kriterlerin GEÇMİŞ
karnesi ve ham maç tablosu kondu.

### Eklenen
- `app/src/components/KriterBasariListesi.js` — maç detayı → Analiz sekmesinde
  kriter karnesi (dönem seçici + satır: "12 maçta 7 başarı · %58 ›").
- `KriterKirilimScreen` sadeleşti: yorum, bant adı ve hüküm YOK; tek ham tablo
  (sıra · maç · oran 1/X/2 · oynanma % 1/X/2 · kriter · sonuç · skor · hafta ·
  ✓/✗) + Hepsi/Tuttu/Tutmadı süzgeci + Hafta/Sıra/Oran/Oynanma sıralaması.

### Kaldırılan (kullanıcı onayıyla)
- `app/src/screens/AnalysisSettingsScreen.js` — "Analiz Kriterlerim" ekranı
- `app/src/analysisProfile.js` — profil deposu (seçim, etki, Manuel/Akıllı)
- `app/src/components/UserAnalysisView.js` — kullanıcı seçimli analiz görünümü
- `app/src/analysis/engine.js` + `thresholds.js` — cihazdaki hafif kriter motoru
- `app/src/kriterAktarim.js` — kupona kriterle aktarım
- Kupon editöründeki "🎛 Kriter" düğmesi ve penceresi
- Sistem Karnesi'ndeki "Kriter" sekmesi (artık maç içinde)
- Backend: `/api/analysis/profiles*` (7 uç), `save-user-analysis`,
  `/bulletins/:id/user`; `resolveProfile()` artık HER ZAMAN resmî profil döner
  (istek gövdesindeki profil YOK SAYILIR — eski istemci arka kapı açamaz).
- Testler: `analysis-profile`, `kriter-aktarim`, `analysis-honesty`,
  `esik-birligi` (kaldırılan kodu test ediyorlardı).

### Davranış değişikliği
- "⚙ Sistemden al" artık bültenin **resmî tahminine** (`m.prediction`) bağlı;
  tahmin yoksa seçim yapılmaz (uydurma sembol yazılmaz).
- Master Analiz kutusundaki "Profil: … · Mod: …" satırı kalktı (tek profil var).

### Korundu (bilerek)
- `backend/src/analysis/analysisStore.js` profil/kullanıcı-analizi metotları ve
  `analysis_profiles` tablosu: **hesap silme akışı** o tabloyu temizliyor
  (`accountDeletion.js`). Eski kullanıcı verisi silinebilir kalmalı.
- `localData.js` içindeki eski profil anahtarları: çıkış/hesap silmede temizlik.

### Doğrulama
- app: 501 test, 500 geçti (`simple-test.mjs` bu işten ÖNCE de kırıktı).
- backend: tüm süitler parça parça çalıştırıldı, **0 başarısız**.
- Kalıntı taraması: `analysisProfile|AnalysisSettings|UserAnalysisView|
  kriterAktarim|analysis/engine` → yalnız localData anahtarları (kasıtlı).
- Belgeler güncellendi: CLAUDE.md "İKİ MOTOR" → "TEK MOTOR" + kriter seçimi yok;
  HANDOFF.md §6 ve frontend dosya listesi.
- **Yapılamadı:** tarayıcıda görsel doğrulama (Chrome eklentisi bağlı değil).

## HAFTA KAYBI ÖNLEMLERİ (2026-08-08)

Kullanıcı: "1 hafta eksik olursa proje komple çöp olur, kayıp kesinlikle
olmamalı." Haklı: bütün arşivin ayakta kalması, tek bir makinenin TEK BİR
DAKİKADA açık olmasına bağlıydı. 51. hafta böyle kaybedildi.

### 1. "Geç mühür" tanımı düzeltildi — `snapshotService.js`
ESKİ: planlanan mühür anından **2 dakika** sonrası geç sayılıyordu ve hafta
karneye HİÇ giremiyordu. Suni bir uçurumdu: mühür 16:55 yerine 16:58'de atılsa
bile ilk maç 17:00'daysa tahmin hâlâ maç öncesidir.
YENİ: **geç = ilk maç başladıktan sonra mühürlendi.** Dürüstlüğü koruyan gerçek
sınır budur; provenance kapısındaki `locked_after_first_match` ile aynı çizgi.
→ Kurtarma penceresi 2 dakikadan, maç saatine kadar uzadı.

### 2. Aday mühür (ön-taahhüt) — `archive/adayMuhur.js` (yeni)
İlk maça **8 saat** kala, **10 dakikada bir**, bültenin o anki hâli diske aday
mühür olarak yazılır. Mühür anında sunucu ayaktaysa normal akış çalışır ve aday
silinir. Sunucu o an KAPALIYSA ve maçlar başladıysa, son aday resmî mühre
**terfi** eder — `lockedAt` olarak YAKALAMA anı kullanılır.

Dürüstlük: terfi geçmişi yazmaz. Aday maç başlamadan yakalanmıştır, gerçek
veriyi taşır, kayıtta `trigger: 'aday-muhur'` olarak görünür. **Maçtan sonra
yakalanmış aday ASLA terfi etmez** (`mac_sonrasi_yakalanmis`).

→ Gereksinim "16:55'te makine açık olsun"dan "öğleden sonra bir ara açık
olsun"a indi.

### 3. Elle mühürleme (son çare) — `POST /api/admin/muhurle`
Panelde düğme. Otomatik akış çalışmazsa operatör maç başlamadan haftayı
kurtarır. **İlk maç başladıysa reddeder** — geçmişe tahmin yazılmaz.
Erken mühre izin verilir (dürüst; yalnız son dakika hareketi snapshot'a girmez).

### 4. Panelde görünürlük
Genel sekmesi → Mühür Durumu: güncel hafta, mühür anı, **aday mühür var mı**
(yedek var / yok / geçersiz) + elle mühürle düğmesi.

### Doğrulama
- `test/aday-muhur.test.mjs` (13) — en kritiği: maç sonrası yakalanmış aday
  terfi etmiyor; kilit anı terfi anı değil YAKALAMA anı.
- `test/freeze.test.mjs` (+2) — 3 dk gecikmeli mühür GEÇ DEĞİL; maç sonrası
  mühür geç.
- Backend süitleri parça parça: **0 başarısız**.

### AÇIK RİSK (kod çözemez)
Aday mühür de dosyaya yazılıyor ve o dosya AYNI makinede. Makine hafta boyunca
hiç açılmazsa hafta yine kaybedilir. Kalıcı çözüm: backend'in 7/24 açık bir
sunucuda çalışması (Render zaten var, üretimde kullanılmıyor).

## SIRADAKİ İŞ — Radar 5'e oynanma + oran filtresi (spec, 2026-08-08)

Kullanıcı kararları (soruldu, cevaplandı):
1. Filtre **hem üstteki 1/X/2 dağılımını hem alttaki maç listesini** süzer.
2. Oynanma filtresi **bu maça yakınlık**: birebir / ±3 / ±5 / ±10 (Radar 3 dili).
3. Oran filtresi de eklenecek — geçmişte oran verisi az; ekran kaç maçın oranı
   olduğunu AÇIKÇA yazacak, eksik veriyle yüzde uydurulmayacak.

### Tasarım (kullanıcı netleştirdi, 2026-08-08)
İKİ KATMANLI filtre:

  ÜST KATMAN (mod):
    Tüm Haftalar · Son 5 · Son 10 · Son 15 · **Oynanma %** · **Oran**

  ALT KATMAN (yalnız Oynanma % / Oran seçiliyken görünür):
    Son 5 maç · Son 10 maç · Son 15 maç

BİRİM FARKI — ATLANMAMASI GEREKEN NOKTA: üst katmanda birim HAFTA (bülten),
alt katmanda birim MAÇ. "Son 5 maç" = bu sıranın yüzdesine uyan son 5 maç,
5 hafta değil. Radar 3'teki played-dna ekranında bu ayrım zaten var
(`limit` = maç, `tol` = yakınlık); aynı dil kullanılacak, yeni kavram
uydurulmayacak.

HER SATIR KENDİ MAÇINA BAKAR: 1. sıra, güncel haftanın 1. sırasındaki maçın
oynanma yüzdesine yakın geçmiş maçları; 6. sıra kendi maçınınkini süzer.
Tek bir "hafta yüzdesi" YOKTUR.

### Nerede
`RadarScreen` → Radar 5 (Bülten DNA) → dönem filtresi satırı + altına ikinci
satır (yalnız ilgili modda).

### Yapılacaklar
1. `history/positionDna.js` → `computePositionDna(matches, { ..., sec })`
   `sec(m)` yüklemi eklenecek; `usable` süzgecine girecek. SAF kalmalı.
2. `routes/radar.js` → `/position-dna`:
   - `?oynanmaTol=0|3|5|10` ve `?oranTol=...` parametreleri.
   - Geçmiş maçların oynanma yüzdesi için `collectPlayedDnaRecords` +
     `sonGunOynanmaIndeksi` (position-matches dalında ZATEN var, oraya taşınacak
     ya da paylaşılacak — iki kopya OLMASIN).
   - Karşılaştırma noktası: GÜNCEL haftanın aynı sıradaki maçının yüzdesi.
     Yani yakınlık sıra bazında ayrı hesaplanır.
   - **Önbellek anahtarına filtre parametreleri EKLENECEK** — yoksa filtre
     değişince eski sonuç döner (sessiz hata).
3. `/position-matches` aynı parametreleri alacak (liste ile dağılım aynı
   süzgeci kullanmalı; ikisi ayrışırsa hangisi doğru bilinmez).
4. App: `RadarScreen`'e ikinci filtre satırı + `api.radarPositionDna/Matches`
   imzalarına parametre.
5. Testler: (a) yakınlık süzgeci doğru maçları seçiyor, (b) filtre değişince
   önbellek yenileniyor, (c) oran verisi olmayan maç sayısı ekranda yazılıyor,
   (d) süzgeç sonrası örneklem düşünce yüzde yerine "yetersiz" deniyor.

### Neden bugün başlanmadı
Değişiklik DNA hesabına ve önbellek anahtarına dokunuyor; yarım bırakılırsa
Radar 5 sessizce yanlış sayı gösterir (en tehlikeli hata sınıfı). Temiz bir
oturumda, testleriyle birlikte yapılacak.

---

# 16 Ağustos 2026 — Ana sayfa: "önce geçen hafta, sonra yeni hafta" akışı

**Belirti (kullanıcı):** Emülatörde uygulama açılınca ana sayfada önce bir
önceki haftanın verisi görünüyor, yeni haftanınki sonradan geliyor.

**Kök neden:** `HomeScreen` iki AYRI isteği birleştiriyor:
`bulletinProvider` (güncel bülten, ≈1 MB) ve `_oncekiHaftaProvider`
(rounds + history, küçük). "Yaklaşan Maçlar" şeridi `yaklasanMaclar(guncel,
onceki)` ile çiziliyordu ve `guncel` henüz gelmemişken `matches` boş oluyordu.
`yaklasanMaclar` güncel haftaya asgari yer ayırır (`enAzGuncel`); güncel hafta
boşken bu pay 0'a düşüyor ve şerit geçici olarak **%100 geçen haftaya**
kalıyordu. Bülten inince liste yeniden kuruluyor ve yeni hafta "sonradan
geliyormuş" gibi görünüyordu. Backend önbelleği yanlış hafta DÖNMÜYOR
(bulletin.json roundId=1529 doğruydu) — sorun tamamen istemci tarafı yarış.

**Düzeltme:** `flutter/lib/features/home/home_screen.dart`
- `bultenYerlesti = data != null || error != null` eklendi.
- "Yaklaşan Maçlar" bölümü `if (bultenYerlesti && upcoming.isNotEmpty)`
  koşuluna alındı. Hata durumunda da çizilir (orada güncel hafta gerçekten
  yoktur, geçen hafta doğru yedektir).

**Doğrulama:** `flutter analyze lib/features/home/home_screen.dart` → temiz.
Emülatörde (Pixel_10_Pro_XL) soğuk açılış + ana sayfaya geçiş ekran
görüntüleriyle izlendi: yükleme sırasında şerit hiç çizilmiyor, bülten
yerleşince iki hafta tasarlanan oranda birlikte görünüyor.

**Not (düzeltilmedi, gözlem):** Hero sayaçları "Maç Analizi 1/15 · Öne Çıkan 0
· Sürpriz Adayı 0" gösteriyor; backend 15/15 başlamamış · 13 eşleşen diyor.
Analiz üretimi ile eşleşme arasındaki bu fark ayrıca bakılmalı.

---

# 16 Ağustos 2026 — Ana sayfa: dört görsel/dürüstlük düzeltmesi

## 1) "Öne Çıkan Analizler" kartları eşit yükseklikte
**Belirti:** Soldaki kartta 1/X/2 verisi olduğu için kart uzuyor, sağdaki
kartta veri olmadığı için kısa kalıyordu; yan yana iki kart basamak gibi
duruyordu.
**Düzeltme (`features/home/home_screen.dart`):**
- İki kartın satırı `IntrinsicHeight` + `CrossAxisAlignment.stretch` oldu.
- `_AnalysisCard` içinde "Analiz Detayı" düğmesinden önce `Spacer()` — artan
  boşluk yutulur, düğme iki kartta da alta hizalanır.
- İhtimal verisi yokken artık `_ihtimalYok()` çizilir: 1/X/2 kutularıyla AYNI
  iskelet, ama sayı yerine "İHTİMAL / verisi yok". Sahte kutu ya da "%–" YOK.

## 2) "Yaklaşan Maçlar": her kartta hafta + ülke işareti
**Belirti:** Hafta rozeti yalnız 1. Hafta kartlarında vardı; ayrıca çoğu
kartta bayrak çıkmıyordu.
**Kök neden (bayrak):** `/api/history/:roundId` resmî Spor Toto geçmiş
bültenini olduğu gibi döner ve orada lig adı "2026/2027 Sezonu" gibi genel bir
metindir; `ulkeAyikla` bu metinden ülke çıkaramadığı için bayrak çizilemiyordu.
**Düzeltme:**
- `home_screen.dart` — `_haftaRozeti()`: rozet HER kartta. Önceki hafta uyarı
  tonunda, güncel hafta tema tonunda; yazı rengi `okunurMetin(zemin)`.
- `backend/src/server.js` — `/api/history/:roundId` lig adını o haftanın
  MÜHÜRLÜ arşiv kaydından (`getSnapshot(roundId).payload.matches[].league`)
  tamamlar. Yalnız sıra numarası VE ev sahibi adı tutuyorsa taşınır; arşive
  hiçbir şey yazılmaz. Ölçüm: 1528. hafta 15 maçın 13'ü artık gerçek lig adı
  ("Turkey Süper Lig", "Spain La Liga") ile geliyor.
- `widgets/ulke_etiketi.dart` — lig tanınmıyorsa artık nötr top simgesi +
  lig adı çizilir (eskiden yalnız düz yazı). Ülke UYDURULMAZ; simge yuvası
  korunduğu için satırlar hizalı kalır.
- KALAN: "Final" ve "2026/2027 Sezonu" etiketli maçlarda ülke verisi ne resmî
  bültende ne arşivde var (FootyStats eşleşmesi yok) — bayrak yerine nötr top.

## 3) "Zorluk: Kolay" etiketi kaldırıldı
Yanıltıcıydı (haftanın "kolay" olması diye bir şey yok; kolaylık/garanti imâsı)
ve rengi tema dışıydı. Hero'da yalnız hafta + ilk maç saati kaldı. Backend'in
`difficulty` alanı duruyor, bu ekranda gösterilmiyor.

## 4) Genel yeşil (`AppColors.field` 0xFF16A34A) ana sayfadan kaldırıldı
Rozetler artık temanın yumuşak yüzeylerini kullanır ve yazı rengi zeminden
hesaplanır (`okunurMetin`), böylece takım teması + açık/koyu görünüm değişince
kontrast korunur:
- `_AnalysisCard`: SÜRPRİZ ADAYI → dolgulu `accent`/`onAccent`, AÇIK MAÇ →
  `warningSoft`, DENGELİ → `primarySoft`. (Takım temasında `accentSoft` ile
  `primarySoft` aynı renge ayarlandığı için üç kademe üç AYRI yüzeyden seçildi.)
- `_SurpriseCard`: YÜKSEK → `warningSoft`, ORTA → `primarySoft`, DÜŞÜK → `bgAlt`.
`AppColors.field` artık hiçbir yerde kullanılmıyor.

**Doğrulama:** `flutter analyze` temiz; emülatörde (Pixel_10_Pro_XL) ekran
görüntüleriyle: iki analiz kartı eşit yükseklikte ve düğmeler hizalı, hafta
rozetleri 1. ve 2. haftada da görünüyor, TÜRKİYE/İSPANYA bayrakları geldi,
hero'da zorluk etiketi yok.

---

# 16 Ağustos 2026 — "Bayraksız maç, armasız takım kalmasın"

**İstek:** Hiçbir maç kartı bayraksız, hiçbir takım armasız kalmayacak.

## A) Marsilya'nın arması — kök neden ad eşleşmesiydi (backend)
Bülten takımı **"Marsilya"**, kaynak adı **"Olympique de Marseille"**. Arma
defterinde kayıt VARDI (id 443, `france-olympique-de-marseille.png`) ama hiçbir
metin katmanı Türkçe exonimi bağlayamıyordu → `logoReason: not_found`.
`backend/src/matcher.js` ALIASES tablosuna doğrulanmış çift eklendi:
`marsilya: ['olympiquedemarseille', 'olympiquemarseille']`.

Yan kazanç: eşleşme kurulunca maç FootyStats'e de bağlandı ve lig adı
`"2026/2027 Sezonu"` → **`"France Ligue 1"`** oldu. Ölçüm: güncel bültende ve
1528. haftada **armasız taraf sayısı 0**.

DENENDİ VE REDDEDİLDİ: `externalTeamId: 7959` üzerinden arma çekmek.
`fetchTeamVenue(7959)` Podgorica/Karadağ dönüyor — o kimlik Marsilya DEĞİL.
Yanlış kulübün armasını basmak sessiz ve ciddi bir hata olurdu.

## B) Lig adı ülke vermediğinde bayrak — armadan türetme (istemci)
`lib/core/ulke_seridi.dart`'a saf yardımcılar eklendi:
`armaUlkesiEn` · `macArmaUlkesiEn` · `macUlkesiEn`. Arma adresindeki ülke ön eki
(`.../teams/germany-fc-bayern-munchen.png`) yedek ülke kaynağı olur.
- `UlkeEtiketi`'ye `yedekUlkeEn` parametresi: lig adı ülke VERMEZSE devreye
  girer, "ALMANYA · Final" gibi çizer. Erişilebilirlik etiketine kaynağı yazılır
  ("kulüp armalarından").
- `ulkeListesi` (ana sayfa ülke şeridi) da aynı yedeği kullanır; "Final" maçı
  artık ülkesiz çip bırakmıyor.
- Bağlandığı yerler: ana sayfa (üç kart) + Bülten'deki canlı ve geçmiş maç
  kartları.
- **SINIR (kural):** bu KULÜBÜN ülkesidir, turnuvanın değil. İki kulüp farklı
  ülkedeyse (uluslararası maç) ülke BELİRSİZ sayılır ve bayrak BASILMAZ —
  yanlış bayrak, bayraksızlıktan kötüdür.

## C) Armasız takım için baş harf rozeti (istemci)
`Logo._fallback()` artık takımın adından en çok iki baş harf yazıyor (Türkçe
büyük harf kuralıyla); ad yoksa eski nötr topa düşüyor. Böylece sağlayıcıda
karşılığı bulunamayan her takımın da kendine ait bir kimliği oluyor ve yan yana
iki armasız takım birbirine benzemiyor. Ülke şeridinde (`lig_seridi.dart`)
`name` BİLEREK verilmiyor: oradaki özne kulüp değil ülke.

**Doğrulama:** `flutter analyze lib` temiz; **721 + 15 yeni test geçti**
(`test/arma_ulkesi_test.dart` — ön ek okuma, iki kelimelik ülke, uluslararası
maçta susma, şeride yansıma).

## Ek düzeltme — rozetler kartın içinde kayboluyordu
**Belirti (kullanıcı):** "Yaklaşan Maçlar"da 2. Hafta rozeti koyu karta koyu,
belli olmuyor.

**Ölçüm:** rozetler ham `*Soft` değerlerini kullanıyordu ve bu yüzeyler her
temada karttan ayrışmıyordu:
- koyu görünüm: `primarySoft` #1C2740 / kart #1B2029 = **1.11**
- açık görünüm: `warningSoft` #FFF4DD / kart #FFFFFF = **1.08**
İkisi de `komsuTon`'un "göz ancak seçer" eşiğinin (1.25) ALTINDA. Yani sorun
yalnız 2. Hafta rozetinde değildi; açık modda 1. Hafta rozeti de siliktı.

**Düzeltme:** `core/theme/takim_paleti.dart` → `ayrisanYuzey(istenen, zemin,
{ayrimEsigi = 1.4})`. Hue korunur, yalnız parlaklık gerektiği kadar kaydırılır;
zaten ayrışan renge DOKUNULMAZ. Bağlandığı yerler: hafta rozeti, `_AnalysisCard`
sınıf rozetleri, `_SurpriseCard` seviye rozetleri.

**Doğrulama:** `test/ayrisan_yuzey_test.dart` (5 test: iki gerçek ölçüm, hue
korunumu, gereksiz değiştirmeme, düzeltilmiş yüzeyde AA metin kontrastı).
Emülatörde koyu ve açık modda ekran görüntüsüyle bakıldı. Toplam **740 test**.

---

# 16 Ağustos 2026 — REGRESYON ÖNLEMİ (kullanıcı isteği: "bir daha aynı şeyi görmek istemiyorum")

Gün boyunca altı kusur elle bulunup elle düzeltildi ve HİÇBİRİ teste
bağlanmamıştı. Bu bölüm o boşluğu kapatır.

## 1) `test/ana_sayfa_kurallari_test.dart` — 6 render testi
Her test bir kullanıcı şikâyetinin karşılığı ve şikâyet cümlesi testin adında:
bülten yerleşmeden şerit çizilmez · iki analiz kartının düğmeleri aynı hizada ·
ihtimal yokken sahte kutu değil dürüst satır · hafta rozeti her kartta · hero
zorluk göstermez · lig adı ülke vermese de bayrak çıkar.
Ağ, `api.tasiyici` dikişiyle sahteleniyor; yükleme yarışı için taşıyıcı ucu
testin açacağı ana kadar bekletebiliyor (Dio yanıt akışı `runAsync` gerektirdi).

**MUTASYON KANITI:** iki düzeltme geçici olarak geri alındı (`bultenYerlesti &&`
kaldırıldı, `IntrinsicHeight`+`stretch` sökülüp `start`a döndürüldü) → 6 testin
6'sı KIRMIZI. Geri konunca yeşil. Testler yük taşıyor.

## 2) `test/gorsel_kurallar_test.dart` — kural taraması + tema süpürme
- `AppColors.field` (genel yeşil) hiçbir dosyada kullanılmaz.
- "Zorluk / ZORLUĞU" hiçbir ekranda geçmez.
- İddialı dil kullanıcı CÜMLELERİNE sızmaz (veri anahtarları ve olumsuzlama
  içeren yasal uyarılar muaf — bekçi dar tutuldu ki gürültüden kapatılmasın).
- Her görünüm modunda rozet zeminleri karttan ≥1.4 ayrışır ve yazısı AA tutar.

**BU TARAMA HEMEN BİR ŞEY BULDU:** "Zorluk" ana sayfadan kaldırılmıştı ama
`week_summary_screen.dart` içindeki **"BÜLTEN ZORLUĞU" bandı duruyordu**
(Kolay/Orta/Zor + yeşil/amber/kırmızı segment çubuğu, hero'daki "Haftanın
Özeti" düğmesinden ulaşılıyor). Kaldırıldı; `_zorlukBandi`, `_zorlukRengi`,
`_segment` ve `_doluSegment` tümüyle silindi.

## 3) `test/ayrisan_yuzey_test.dart` — 5 test
Kontrast düzeltmesinin ölçüm nöbetçisi (gerçek iki ölçüm, hue korunumu,
gereksiz renk bozmama, AA metin).

## 4) Backend `test/crest-registry.test.mjs` — 2 yeni test
- Türkçe exonim: "Marsilya" → Olympique de Marseille arması (bugünkü arıza).
- Alias tablosu bütünlüğü: her anahtar/değer normalize edilmiş olmalı —
  normalize edilmemiş bir satır hiç eşleşmez ve SESSİZCE ölür.

## 5) YAN BULGU — bekçiler zaten var olan bir arızayı ortaya çıkardı
`npm test` koşturulunca mevcut `kaynak-kodu.test.mjs` KIRMIZIYDI:
`/api/radar/current` yanıtında bahis sitesi markası sızıyordu.
**Kök neden sessiz ŞEKİL UYUŞMAZLIĞI:** maskeleme `{...p, providerId:
kaynakKodu(p.providerId)}` yapıyordu ama `details.providers` iki AYRI şekilde
gelebiliyor — veri yokken `{id, name}` (providerId YOK → `kaynakKodu(undefined)`
= 'k0', marka spread ile aynen geçiyor), veri varken `{providerId: 'nesine', …}`.
**Düzeltme:** kimlik artık tek alanda (`providerId`) taşınır, marka adı hiç
taşınmaz; koda çevirme TEK sınırda (routes/radar.js) yapılır ve `id`/`name`
alanları düşürülür. `/public-percentage-history` de maskelendi
(`observations[].source` ham iç kimlikti). Dört uç canlı doğrulandı: temiz.

## Sonuç
- Flutter: `flutter analyze lib test` temiz · **751 test** (13 yeni).
- Backend: **1077 test, 0 hata** (2 yeni).
- `tasks/lessons.md`'ye beş kurallık ders yazıldı (mutasyon kanıtı zorunlu,
  kuralı ekran ekran değil tarama ile koru, bekçi dar olmalı, kontrast ölçülür).
