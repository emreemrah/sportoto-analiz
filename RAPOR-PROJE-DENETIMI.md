# PROJE DENETİMİ — A'dan Z'ye envanter

Tarih: 2026-08-06 · Kapsam: backend, app, testler, dokümanlar, deploy/güvenlik.
Yöntem: dört ayrı tarama (kod sağlığı, uygulama, test/doküman, yayın/güvenlik).
**Bu rapor yalnız TESPİT içerir — hiçbir düzeltme yapılmadı.**

Öncelik anahtarı: 🔴 hemen · 🟠 yakında · 🟡 sırası gelince · ⚪ bilgi.

---

## 1. GÜVENLİK VE YAYIN

🔴 **`backend/.env.yedek-0107` hâlâ duruyor ve 9 gerçek sır içeriyor**
(Supabase secret + veritabanı parolası + FootyStats + API-Football anahtarları).
`.gitignore` `*env-yedek*` deseniyle kapsıyor, git'e girmemiş — ama `ANAHTAR-YENILEME.md`
"iş bitince sil" diyor, silinmemiş. Bu dosya bir kez yanlış yere kopyalanırsa
tüm anahtarlar sızar. **Öneri: sil.**

🟢 **Sızıntı yok (doğrulandı):** `git ls-files` ve geçmiş taramasında tek sır dosyası
yok; kaynak kodda gömülü anahtar deseni bulunamadı; `backend/data`+`cache` içinde
e-posta eşleşmesi 0, bu klasörlerden git'e giden dosya 0.

🟠 **render.yaml eksik değişkenler** — blueprint yalnız 9 anahtar tanımlıyor; panel
şunları hiç sormuyor, sessizce boş kalıyor:
- `MODERATOR_EMAILS` → moderasyon paneli **hiç kimseye** açılmaz (Play'in "inceleme
  süreci" şartı fiilen çalışmaz).
- `INTERNAL_API_KEY` → dış zamanlayıcıdan snapshot mühürleme yapılamaz (yalnız localhost).
- `ALLOWED_ORIGINS` + `NODE_ENV` → ayrı alan adı önüne konursa tarayıcı istekleri
  engellenir; `NODE_ENV=production` yoksa CORS'ta localhost/LAN kalıbı üretimde de açık
  kalır ve migration kapısı "geliştirme" koluna düşer.
- `ARCHIVE_DRIVER` / `ANALYSIS_DRIVER` / `HISTORY_DRIVER` → boşsa otomatik seçim;
  Supabase değişkenlerinden biri eksikse arşiv/analiz/geçmiş **sessizce Render diskine**
  yazar ve her deploy'da silinir (yalnız arşiv uyarı basıyor, diğer ikisi sessiz).
- `FOOTYSTATS_SEASON_IDS`: yayında 28 id, yerelde 31 → **yayının lig kapsamı dar.**

🟠 **Migration belgesi kaymış:** `backend/migrations/` içinde 9 dosya var (sonuncusu
`009_profiles_predictions.sql`), README yalnız 001–006'yı anlatıyor. 009 sıfırdan
kurulan bir veritabanına uygulanmazsa kayıt/profil/tahmin uçları ölü olur.

⚪ **backend/public (yerel kopya) 2 gün geride** — Render her deploy'da yeniden
üretiyor, yayın tazedir; ama yerelden çalıştırılırsa eski arayüz servis edilir.
İçinde 29 Haziran'dan kalma artık bir bundle dosyası da duruyor.

---

## 2. VERİ AKIŞI KIRILGANLIKLARI

🟠 **FootyStats kotasında global tavan yok.** `kotaBekcisi.js` gerçek API sayacını
okuyor (tahmin değil) ve 300'lük rezerv bırakıyor; ama `/api/history/:roundId`
tazelemesi **hafta başına** 60 sn kısıtlı — aynı akşam 3 hafta gezilirse saatlik
1.800 kotası aşılabilir. 2 Ağustos'ta bültenin 14/15 → 0/15 düşmesi bu sınıftandı.
Ayrıca `kotaDurumu()` hiçbir uçtan yayınlanmıyor: **kalan kota dışarıdan izlenemiyor**
(`/api/health` içinde de yok).

🟠 **API-Football hesabı askıda.** Oran sağlayıcısı söküldü ama canlı skor yolu hâlâ
aynı anahtarı kullanıyor → canlı dakika/istatistik/olay şeridi "veri yok" der (uydurmaz).
Çözüm yalnız hesap panelinden.

⚪ **Bilyoner:** kaynak dosyası projede yok; WAF kuralı yalnız politika olarak duruyor.
`backend/cache/bilyonerDiag.json` 22 Temmuz'dan kalma ölü teşhis dosyası.

---

## 3. TUTARSIZLIKLAR (gerçek hata riski)

🔴 **Katalog sürümü iki yerde, iki FARKLI değerle:**
- `archive/constants.js` → `criteria-1.0.0` (snapshot mührüne yazılan)
- `analysis/analysisConfig.js` → `criteria-catalog-2.0.0` (motorun gerçek sürümü)
Mühürlenen bültenler **yanlış katalog sürümüyle** damgalanıyor; ileri-test karnesi
hangi katalogla üretildiğini yanlış raporlar. Arşiv bütünlüğü açısından en kritik bulgu.

🟠 **`misli` hayalet eşlemesi:** adaptör silinmiş ama `providers/kaynakKodu.js` içinde
`misli: 'k2'` duruyor. Kodun kendi yorumu riski itiraf ediyor: *"iki kaynak aynı koda
düşerse veriler sessizce birbirini ezer."*

🟡 **İki paralel sağlayıcı kaydı** (`providers/playedPercentages.js` Map ve
`radar/publicBettingProviders.js` Array) — ikincisi fiilen ölü, yine de ayrı API taşıyor.

🟡 **İki karne yolu:** `/api/scorecards/*` ile `/api/system-scorecard` +
`/api/criteria-scorecard` aynı veriyi iki uçtan sunuyor (geriye uyumluluk).

---

## 4. YARIM KALMIŞ / ÖLÜ KOD

### Backend
- `archive/hash.js → verifyPayloadHash` **hiç çağrılmıyor**: snapshot bütünlük
  doğrulaması yazılmış ama devrede değil (hash üretiliyor, doğrulanmıyor). 🟠
- Kullanılmayan export'lar: `isSnapshotOfficialForward`, `fetchChosenSeasonIds`,
  `resolveFilters`, `stopArchiveWorker`, `sessionsEnabled`, `registerPublicProvider`.
- `ev/config.js` içinde 7 ölü sabit — yorumu "ileride ekrana yazılır" diyor:
  **yarım kalmış EV (beklenen değer) ekranı.**
- `_to_delete/bilyonerDiag.js` iki kırık import taşıyor (çalıştırılamaz).
- Yanlış `mkdir` izi boş klasörler: `src/analysis/analysis`, `src/routes/routes`,
  `src/sources/sources`, `tools/tools`.
- Bölünme adayı büyük dosyalar: `refresh.js` 1017, `criterionCatalog.js` 855,
  `routes/radar.js` 852, `server.js` 814 satır.

### Uygulama
- 🟠 **`decisionEngine.js` + `DecisionEngineView.js` = 656 satırlık ölü küme.**
  Hiçbir ekran açmıyor. En büyük tek temizlik kalemi.
- Ölü dosyalar: `SahaBackdrop.js`, `BultenBackdrop.js`, `takimTema.js` +
  `useTakimTema.js` (renk teması geri alınmıştı), `hooks/usePerformanceDashboard.js`,
  `data/mockPerformance.js`, `data/mockAnalysisSnapshots_fresh_check.js`
  (dosyanın kendi başlığı "güvenle silebilirsin" diyor).
- İçe aktarılıyor ama **hiç kullanılmıyor**: `Polls.js` (~330 satır), `CompareBars.js`,
  `LineupBuilder.js`.
- `SystemDashboardScreen` yalnız geliştirme derlemesinde kayıtlı (yayında erişilemez).
- **~172 ölü stil anahtarı**: BulletinScreen 57 (kaldırılan kupon butonları + eski
  geçmiş kartı bloğu), MatchDetailScreen 51, ProfileScreen 26 (sökülen rozet/seviye
  stilleri), HomeScreen 7.
- **22 ölü import ismi**: MatchDetailScreen 13, RadarScreen 9.
- Dört ayrı arka plan bileşeni aynı işi yapıyor (ikisi ölü); `ui.js` / `components.js` /
  `components/` üç ayrı "ortak bileşen" adresi.
- ⚪ Uykuda küme (bilinçli): Yayın Stüdyosu `features.js` ile kapalı ama statik import
  edildiği için bundle'a giriyor. `userMatchEngine.js` yalnız buradan erişiliyor.

---

## 5. HATA YÖNETİMİ

🟠 **Backend'de sessizce yutulan üç kritik hata:**
- `refresh.js:132` `catch {}` — bir sezon çekimi düşerse **hiç iz kalmıyor**, bülten
  eksik veriyle devam ediyor. (2 Ağustos'taki kapsam çöküşünün kardeşi.)
- `routes/auth.js` üç yerde `.catch(() => {})` — hesap silme, doğrulama e-postası
  yeniden gönderme ve şifre sıfırlama hataları yutuluyor; kullanıcıya "gönderildi"
  denip gönderilmemiş olabilir.
- `server.js:262` — bozuk `coupon-pricing.json` sessizce "veri yok"a düşüyor.

🟡 Uygulamada **32 boş `catch {}` + 18 `.catch(() => {})`.** Çoğu yerel depolama
(zararsız), ama ağ hataları da yutuluyor: beğeni gönderimi, anket oyu, kupon merkezi
yüklemesi, `api.js` yenileme akışı.

🟢 `console.log` kalıntısı **yok** (her iki tarafta da): loglar önekli ve yapısal.

---

## 6. TESTLER

🔴 **`app/test-ui/liderlik.test.jsx` KIRIK** — silinen `LeaderboardScreen`'i import
ediyor; `npm run test:ui` bu süiti çözemez. (Oyunlaştırma sökülürken testi unutulmuş.)

🟠 **32 test atlanıyor** — hepsi canlı PostgreSQL istiyor (`MIGRATION_TEST_DB_URL`).
Kapsam kaybı ciddi: migration sırası/kilit/rollback/bütünlük mührü, dört moderasyon
tablosunda RLS'in açık olduğu, otomatik gizleme eşiği, CHECK kısıtları.
Projenin kendi kuralı: *"Atlandı, geçti demek değildir."*

🟠 **Son üç günün UI'ı test dışı:** `InfoIpucu`, `TakimLogoZemin`, `UlkeEtiketi`,
`TeamPickerScreen` hiçbir testte geçmiyor. (Saf mantık modülleri — `radarGuards`,
`ulkeSeridi`, `takimTema`, `favoriteTeams` — iyi test edilmiş.)

🟡 **Kırılgan bekçi testler:** 54 dosya kaynak metnine regex ile bakıyor. Biçimsel bir
düzenleme (prop'u değişkene almak, satır sonu) davranış değişmese bile testi kırar;
tersten, regex bulunur ama kod hiç çalıştırılmadığı için yanlış-yeşil riski de var.

---

## 7. DOKÜMAN BAYATLIĞI

🔴 **Ana motor çelişkisi:** `HANDOFF.md` (3 yerde) ve `AGENTS.md` (2 yerde) hâlâ
`userMatchEngine.js`'i "ANA ANALİZ MOTORU" diye tarif ediyor. Doğrusu
`masterEngine.js` ve `CLAUDE.md` bunu düzeltiyor — ama okuyucuyu tam o yanlış
bölüme yönlendiriyor ("Detay: HANDOFF §6"). Yeni bir geliştirici/oturum bu yüzden
yanlış motoru düzenler.

🟠 **HANDOFF.md'de var olmayan dosyalar:** `CouponBuilderScreen.js`, `CouponsScreen.js`
(ikisi de silinmiş, yerlerinde `CouponCenterScreen` + `CouponEditorScreen` var).
Ayrıca "tüm güncel iş feature dalında, main eskidir" diyor — bugün main güncel.

🟠 **Kaldırılan özellikler hâlâ anlatılıyor:** `OKUBENI.md` "rozetler"i sayıyor
(sistem söküldü), `RAPOR-kupon-merkezi.md` Akıllı Kupon'u yaşayan özellik gibi
anlatıyor (düğmesi kaldırıldı), Liderlik ekranının kaldırıldığı hiçbir yerde yazmıyor,
yeni Sistem/Kriter/Seçimim aktarımı hiçbir dokümanda yok.

🟠 **`tasks/todo.md` 3 Ağustos'ta durmuş** — sonraki 7 commit (oyunlaştırma sökümü,
takım seçimi/logo, radar korumaları, ülke şeridi, mobil sadelik, 360px, hero yarılama,
migration sabrı) deftere hiç yazılmamış. `CLAUDE.md` bunu şart koşuyordu.
`tasks/lessons.md` güncel görünüyor (10 ders).

⚪ **Dokümanlardaki açık işler** (özet): `MODERATOR_EMAILS` girilmesi, resmî kolon
bedeli teyidi, gerçek telefonda bildirim/Bildir-Engelle testi, "güvenli/riskli" dil
temizliği (#203–208, keşif yapıldı düzenleme yok), arma eşleşmeyen takımlar (#212–215),
kupon deposunun Supabase'e taşınması, `_to_delete/` klasörünün silinmesi, mağaza
maddeleri (E1–E10), TÜRKPATENT/hukuki görüş/Play Console.

---

## 8. ÖNCELİKLİ İLK 10 İŞ (önerilen sıra)

1. 🔴 `backend/.env.yedek-0107` sil (sır dosyası).
2. 🔴 Katalog sürümü çelişkisini gider (`criteria-1.0.0` ↔ `criteria-catalog-2.0.0`).
3. 🔴 Kırık `app/test-ui/liderlik.test.jsx` — sil ya da düzelt.
4. 🔴 `HANDOFF.md` + `AGENTS.md` motor bilgisini düzelt (yanlış yönlendiriyor).
5. 🟠 Render'da eksik değişkenler: `MODERATOR_EMAILS`, `NODE_ENV=production`,
   sürücüler; `FOOTYSTATS_SEASON_IDS` yerelle eşitle.
6. 🟠 `refresh.js:132` ve `auth.js` sessiz catch'lerini logla (hata görünür olsun).
7. 🟠 Ölü kod temizliği: decisionEngine + DecisionEngineView + ölü backdrop'lar +
   takimTema kümesi + Polls/CompareBars/LineupBuilder (~1.400 satır).
8. 🟠 `misli: 'k2'` hayalet eşlemesini kaldır (sessiz veri ezme riski).
9. 🟡 Ölü stil/import temizliği (~172 stil, 22 import).
10. 🟡 `tasks/todo.md`'yi güncelle; migrations/README'ye 007-009'u ekle;
    kota durumunu `/api/health`'e ekle.

---

Not: hiçbir madde "acil bozuk" değil — uygulama çalışıyor, yayın ayakta ve testler
yeşil (backend 944, app 756). Buradaki liste, birikmiş teknik borcun dürüst dökümüdür.
