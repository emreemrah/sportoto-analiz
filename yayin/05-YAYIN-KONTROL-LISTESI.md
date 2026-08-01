# Yayın Kontrol Listesi

**Uygulama:** Sportoto Master Analiz
**Durum tarihi:** 25 Temmuz 2026

Efsane: ✅ hazır ve doğrulandı · 🔨 üzerinde çalışıyorum · ⛔ senden bir şey gerekiyor · ⚠️ karar bekliyor

> **Ölçüm kaynağı ayrımı:** "senin ölçümün" yazan satırlar senin makinende veya
> telefonunda senin tarafından gözlenmiştir. Ne bulut kabı ne cihaz VM'i
> Supabase'e veya telefonuna ulaşabiliyor; o sonuçları kendi doğrulamam gibi
> sunmuyorum.

---

## A. Teknik yapılandırma

| # | Madde | Durum | Dayanak / not |
|---|---|---|---|
| A1 | Uygulama adı her yüzeyde tek ve doğru | ✅ | `app.json`, `brand.js`, web başlığı, splash, Hakkında, yasal sayfalar — hepsi tek kaynaktan |
| A2 | Uygulama kimliği (applicationId) | ⛔ | `com.emrahanlar.masteranaliz` — **ilk yüklemeden sonra asla değişmez**, onayın gerekiyor |
| A3 | Sürüm | ✅ | `version 1.0.0` / `versionCode 1`; `brand.js` ile eşleştiği test edilir |
| A4 | Hedef Android sürümü (targetSdk) | ✅ | Expo SDK 56 / RN 0.85 varsayılanı **API 36 (Android 16)**. Google Play, **31 Ağustos 2026**'dan itibaren yeni uygulama ve güncellemelerde API 36 istiyor — bu tarihe **38 gün** kaldı. Mevcut yapılandırma bu gereksinimi karşılıyor |
| A5 | Android izinleri | ✅ | `permissions: []`; konum, kamera, mikrofon, rehber, depolama izinleri `blockedPermissions` ile **açıkça engellendi** |
| A6 | Yayında localhost / LAN / http adresi yok | ✅ | `app/src/apiBase.js` — yanlış yapılandırmada **sessizce yerele düşmez, açık hata verir** |
| A7 | Kişisel veri HTTPS üzerinden taşınır | ✅ | Aynı dosya: `https://` dışındaki adres yayında reddedilir |
| A8 | Gizli anahtar mobil pakete girmiyor | ✅ | Anahtarlar yalnız `backend/.env`; uygulama yalnız kendi backend'ine bağlanır |
| A9 | Demo / sahte başarı / test verisi yayında kapalı | ✅ | `DEMO_MODE = IS_DEV && …` — yayın derlemesinde daima kapalı; demo veri `isDemo:true` etiketi olmadan hiç gösterilmez |
| A10 | Geliştirici ekranı / debug ayarı yok | ✅ | Demo panoları `demoDataAllowed()` arkasında; üretimde `null` döner |
| A11 | Reklam / analitik / izleme SDK'sı yok | ✅ | 17 bağımlılığın tamamı tarandı — hiçbiri bulunmadı |
| A12 | Web derlemesi çalışıyor | ✅ | `npx expo export --platform web` başarılı; `<title>Sportoto Master Analiz</title>` |
| A15 | Çalışan ekranda marka doğrulaması | ✅ | `npm run verify:screen` — derlenmiş uygulama gerçek tarayıcıda açılır; sekme başlığı ve Ana Sayfa sol üst başlığı ölçülür. Kaynak taraması değil, **çıktı** ölçümü |
| A16 | Metro/Expo önbelleği | ✅ | `npm start` / `npm run web` artık `--clear` ile çalışır; elle önbellek temizliği gerekmez (`start:cache` / `web:cache` hızlı seçenek olarak durur) |
| A17 | Telefon bildirimleri (yerel) | ✅ | **Gerçek Android cihazda doğrulandı.** Test bildirimi üç durumda da geldi: uygulama açıkken, arka plandayken ve **tamamen kapalıyken**. Bildirime dokunmak doğru ekrana yönlendirdi; maç hatırlatma bildirimi doğru maç detayını açtı. **Bu ölçüm sana ait** — telefona ne bulut kabından ne cihaz VM'inden erişebildiğim için benim doğrulamam değil. Uzaktan (sunucudan) push ayrı bir madde ve E3'e bağlı |
| A13 | Uygulama imzalama anahtarı | ⛔ | Anahtar üretimi ve güvenli saklaması **sana ait**. Kaybı = uygulamayı bir daha güncelleyememek |
| A14 | AAB üretimi | ⛔ | Play Console erişimi ve imzalama anahtarı olmadan üretilemez |

---

## B. Yasal ve gizlilik

| # | Madde | Durum | Dayanak / not |
|---|---|---|---|
| B1 | Gizlilik politikası sayfası | ✅ | `backend/legal/gizlilik.html`, 10 bölüm, gerçek veri akışını anlatır |
| B2 | Hesap silme sayfası (kurulum gerektirmeyen) | ✅ | `backend/legal/hesap-silme.html` — e-posta + şifre + `HESABIMI SIL` onayı |
| B3 | Uygulama içi hesap silme | ✅ | Profil → Hesabımı Sil |
| B4 | Silme **gerçek** mi | ✅ | 9 tablo + avatar dosyaları + kupon kaydı + kimlik kaydı kalıcı silinir; 10 test kanıtlıyor |
| B5 | Kısmi başarısızlıkta "silindi" denmiyor | ✅ | Kimlik kaydı **en son** silinir; herhangi bir adım hata verirse hesap silinmez |
| B6 | Korunan veriler silinmiyor | ✅ | Bülten arşivi, mühürlü analizler, resmî sonuçlar, Radar, Sistem Karnesi — testle korunuyor |
| B7 | Yasal sayfalar herkese açık adreste | ⛔ | **Alan adı gerekiyor.** Play, iki sayfanın da kurulum gerektirmeden açılmasını şart koşar |
| B8 | Destek e-posta adresi | ⛔ | `SUPPORT_EMAIL` ortam değişkeni — **sahte adres yazılmadı** |
| B9 | Data Safety formu cevap anahtarı | ✅ | `01-DATA-SAFETY.md` — koddan doğrulanmış |
| B10 | Bağımsızlık bildirimi tüm yüzeylerde | ✅ | Profil (girişli + girişsiz), Hakkında, iki yasal sayfa, mağaza açıklaması |
| B11 | Telif satırı `© 2026 Sportoto Master Analiz` | ✅ | Birebir; testle korunuyor |
| B12 | Veritabanı migration'ları | ✅ | **Otomatik ve çalışır durumda.** `SUPABASE_DB_URL` (session/direct) tanımlandı; backend açılışında migration'lar kendiliğinden uygulandı, veritabanı kontrolü geçti ve arka plan servisleri kendiliğinden başladı. Artık elle SQL YOK. **Bu sonuç senin makinende senin tarafından ölçüldü** — ne bulut kabı ne cihaz VM'i Supabase'e ulaşabildiği için ben bağımsız doğrulayamam; bunu kendi doğrulamam gibi sunmuyorum. Benim doğrulayabildiğim: değişkenin tanımlı olduğu, `postgresql://` ile başladığı ve portun **5432** (doğru, 6543 pooler değil) olduğu — değerin kendisini okumadan |

---

## C. Mağaza kaydı

| # | Madde | Durum | Dayanak / not |
|---|---|---|---|
| C1 | Uygulama adı (≤30) | ✅ | 22 karakter |
| C2 | Kısa açıklama (≤80) | ✅ | 68 karakter |
| C3 | Uzun açıklama (≤4000) | ✅ | `02-MAGAZA-METINLERI.md` |
| C4 | Yasaklı ifade denetimi | ✅ | `backend/test/store-listing.test.mjs` otomatik denetliyor |
| C5 | Kategori: **Spor** (Kumar değil) | ✅ | — |
| C6 | İçerik derecelendirme cevapları | ✅ | `03-ICERIK-DERECELENDIRME.md` — dürüst cevaplar, **18+ beklenir** |
| C7 | Ekran görüntüleri | ⛔ | Aşağıdaki D bölümü |
| C8 | Uygulama simgesi 512×512 | ✅ | `yayin/play-icon-512.png` üretildi — mevcut özgün `icon.png`'den ölçeklendi, kurum logosu içermez |
| C9 | Öne çıkan grafik 1024×500 | ⛔ | Henüz üretilmedi |

---

## D. Ekran görüntüleri — gereken liste

Google Play, telefon için **en az 2, en fazla 8** ekran görüntüsü ister.
Boyut: en az 320 px, en fazla 3840 px kenar; oran 16:9 ile 9:16 arası.
Önerilen: **1080×1920 PNG**.

| # | Ekran | Ne gösterilmeli | Dikkat |
|---|---|---|---|
| 1 | Haftalık bülten | 15 maçlık liste, tarih ve takımlar | Gerçek bülten olmalı; sahte maç üretilmemeli |
| 2 | Maç detayı — analiz | Kriterler ve gerekçeler | "Güçlü Aday" dili görünmeli, "banko" **görünmemeli** |
| 3 | Maç detayı — istatistik | Puan durumu, form, ikili geçmiş | — |
| 4 | Tahmin listesi | Kaydedilmiş tercihler | "Kesin sonuç veya kazanç vaadi değildir" notu kadrajda kalmalı |
| 5 | Sistem Karnesi | Gerçek başarı raporu | **Demo veri ile ekran görüntüsü alınmamalı** |
| 6 | Hakkında | Bağımsızlık bildirimi ve telif | Bu kare, incelemeciye bağımsızlığı gösterir — atlanmamalı |

**Ekran görüntüsü kuralları:**

- Hiçbir karede **e-posta, telefon, token veya gerçek kullanıcı adı**
  görünmemeli.
- Hiçbir karede **kurum logosu veya operatör markası** bulunmamalı.
- Kareye eklenen tanıtım yazılarında da iddialı dil yasağı geçerlidir.
- Demo/mock veri ile görüntü alınmamalı; Google, gerçek uygulamayı
  yansıtmayan görselleri yanıltıcı sayar.

---

## E. Yayından önce kapatılması gereken açık maddeler

| # | Madde | Kim yapacak |
|---|---|---|
| E1 | Alan adı + HTTPS sunucu (B7, A6) | **Sen** |
| E2 | Destek e-posta adresi (B8) | **Sen** |
| E3 | Play Console hesabı + imzalama anahtarı (A13, A14) | **Sen** |
| E4 | `com.emrahanlar.masteranaliz` onayı (A2) | **Sen** |
| E5 | `SUPABASE_DB_URL` bağlantı dizesi (B12) | ✅ **Tamamlandı** — 25.07.2026. Dize `backend/.env` içine yazıldı (session/direct, port 5432). Otomatik migration çalıştı, veritabanı kontrolü geçti, arka plan servisleri kendiliğinden başladı. Bir daha SQL kopyalanmayacak. Ayrıntı: `yayin/06-SUPABASE-BAGLANTISI.md` |
| E6 | Marka vekili sorgusu (`04-RISK-RAPORU.md` §3) | **Sen** |
| E7 | Ad hakkındaki karar (`04-RISK-RAPORU.md` §1) | **Sen** |
| E8 | "Kupon" dili hakkındaki karar (`04-RISK-RAPORU.md` §2) | **Sen** |
| E9 | Yorum bildirme + kullanıcı engelleme özelliği (`04-RISK-RAPORU.md` §6) | ✅ **Kod tarafı tamamlandı** — 25.07.2026. Migration 007 (`comment_reports` + `user_blocks`, ikisi de RLS'li), sunucu uçları (bildir / engelle / engel kaldır, hepsi idempotent), arayüz (yorum altında **Bildir** / **Engelle**, 7 sebepli bildirme penceresi, Profil → **Engellenen Kullanıcılar** ekranı). **Gerçek cihazda henüz denenmedi** — aşağıdaki F bölümüne bak |
| E16 | Topluluk Kuralları sayfası + operatör inceleme ekranı (`04-RISK-RAPORU.md` §6, üçüncü şart) | ✅ **Kod tarafı tamamlandı** — 25.07.2026. Herkese açık `/topluluk-kurallari` sayfası (uygulama kurulmadan açılır, Hakkında ekranından bağlantılı) + yalnız operatörün gördüğü **İnceleme** ekranı (gizle / geri al / yok say). Yetki `backend/.env` → `MODERATOR_EMAILS`; **uygulamaya kimlik gömülmez**. Aşağıdaki H bölümüne bak. **Sende kalan tek iş:** `MODERATOR_EMAILS` satırına kendi doğrulanmış e-postanı yazmak |
| E10 | Ekran görüntüleri + öne çıkan grafik (C7, C9) | **Onayınla ben** — gerçek veriyle üretilir |
| E11 | 512×512 mağaza simgesi (C8) | ✅ **Tamamlandı** — `yayin/play-icon-512.png` |
| E12 | Migration 006 (oturum + cihazlar + puan/başarı tabloları) | ✅ **Tamamlandı** — 25.07.2026, SQL Editor'da çalıştırıldı; 8 tablo, hepsinde RLS doğrulandı |
| E13 | Supabase "Confirm email" ayarı (e-posta doğrulama) | ✅ **Tamamlandı** — ayar panelde açık olarak doğrulandı; kayıt artık gerçek doğrulama e-postası gönderir |
| E14 | Biyometrik giriş (`expo-local-authentication`) | ✅ **Tamamlandı** — onayınla eklendi; kilit varsayılan kapalı, kullanıcı Güvenlik Ayarları'ndan açar |
| E15 | Telefon bildirimleri — gerçek cihaz doğrulaması (A17) | ✅ **Tamamlandı** — 25.07.2026, gerçek Android cihazda senin tarafından ölçüldü: açık / arka plan / tamamen kapalı üç durumda da bildirim geldi, dokununca doğru ekran açıldı, maç hatırlatması doğru maç detayına gitti |

**Ertelenen maddeler:** E1, E2, E3, E4, E6, E7, E8, E10 (alan adı, destek e-postası,
Play Console, imzalama anahtarı, applicationId, marka sorgusu, ad kararı, "kupon"
dili, mağaza görselleri) senin kararınla **uygulama özellikleri bitene kadar
ertelendi**. Bunlar yayın/mağaza işleri; kod tarafını engellemiyorlar.

---

## F. Teslim doğrulaması

| Madde | Sonuç |
|---|---|
| Uygulama testleri | ✅ **74 / 74** (8'i yeni marka yüzeyi testi) |
| Backend testleri — **bulut**, gerçek PostgreSQL 16 bağlıyken | ✅ **388 / 388**. Bu bir **bulut** ölçümüdür; cihaz başarısı sayılmaz |
| Backend testleri — **senin makinende** (ölçülen) | ✅ migration paketi **37 geçti / 0 kaldı / 12 ATLANDI** (canlı DB yok) · açılış kapısı **7 / 7** · `analysis` 13/13 · `account-deletion` 10/10 · `radar-api` 7/7 · `radar-empty-screen` 19/19 · `legacy-isolation` 13/13. Tüm paket tek seferde çalıştırılamadı: cihaz VM'inde ağ yok, Supabase'e uzanan testler asılı kalıyor |
| "Atlandı" uyarısı | ✅ 12 canlı migration testi bağlantısız ortamda ATLANIR ve çalıştırma ekrana **"atlandı geçti demek DEĞİLDİR"** yazar |
| **Canlı Supabase'e karşı otomatik migration** — *senin ölçümün* | ✅ `SUPABASE_DB_URL` tanımlandıktan sonra backend açılışında migration'lar uygulandı, veritabanı kontrolü geçti, arka plan servisleri kendiliğinden başladı. **Bunu sen ölçtün, ben doğrulamadım:** bulut kabı allowlist yüzünden (`Host not in allowlist`), cihaz VM'i ise ağı olmadığı için (`fetch failed`) Supabase'e ulaşamıyor |
| **Telefon bildirimleri** — *senin ölçümün* | ✅ gerçek Android cihazda üç uygulama durumu (açık / arka plan / tamamen kapalı) + dokunma yönlendirmesi + maç hatırlatması. **Bunu sen ölçtün**; telefona erişimim yok |
| Web derlemesi (`expo export --platform web`) | ✅ başarılı |
| Çalışan ekran — tarayıcı sekmesi | ✅ **Sportoto Master Analiz** (ölçüldü) |
| Çalışan ekran — Ana Sayfa sol üst | ✅ **Sportoto Master Analiz** (ölçüldü, ekran görüntüsüyle) |
| Kontrol deneyi (`documentTitle` kaldırılınca) | ✅ sekme **"Home"** oldu → kök neden kanıtlandı |
| Cihaza yazılan dosya (marka turu) | **283** dosya (25 eski + 5 eksik + 253 zaten aynı) |
| sha256 karşılaştırması (bulut ↔ cihaz) | ✅ **283 / 283 birebir aynı** |
| Cihazda çalıştırılan uygulama testleri | ✅ **73 pass / 0 fail** (1 test derleme çıktısı olmadığı için atlandı) |
| Cihaza yazılan dosya (migration turu) | **159** dosya (motor + testler + dokümanlar + `pg` paketi); ardından **7** düzeltme dosyası |
| md5 karşılaştırması (bulut ↔ cihaz, migration turu) | ✅ birebir aynı |
| Eski marka kalıntısı taraması (parçalı JSX dahil) | ✅ temiz |

---

## G. E9 — Yorum bildirme + kullanıcı engelleme (25.07.2026)

### Ne yapıldı

| Katman | İçerik |
|---|---|
| Veritabanı | `007_moderation_report_block.sql` — `comment_reports` (aynı kişi aynı yorumu bir kez bildirir) + `user_blocks` (çift yönlü tekillik), ikisinde de RLS açık; sebep alanı `CHECK` ile 7 değere kilitli |
| Sunucu | `POST /api/comments/:id/report` · `GET/POST /api/users/me/blocks` · `DELETE /api/users/me/blocks/:userId` — hepsi **idempotent** (ikinci istek hata değil, `already` döner) |
| Sunucu — okuma | Yorum listesi engel kümesine göre süzülür. Engel listesi **okunamazsa istek 503 döner**, süzgeçsiz liste **gösterilmez** (fail-closed) |
| Arayüz | Yorumun altında **Bildir** / **Engelle** (yalnız başkasının yorumunda, yalnız girişliyken) · 7 sebepli bildirme penceresi + 300 karakter açıklama · Profil → **Engellenen Kullanıcılar** ekranı (engel kaldırma dâhil) |
| Hesap silme | Silinen hesabın bildirimleri ve iki yöndeki engelleri de silinir; kendi yorumuna gelen bildirimler ayrıca temizlenir |

### Gizlilik kararları (bilerek verilmiş, testle korunuyor)

| Karar | Neden |
|---|---|
| Bildirim **sayısı** hiçbir yerde gösterilmez | Sayıyı gören kişi eşiğe ne kadar kaldığını ölçer |
| Bildirim yanıtı **sonuç açıklamaz** | Yorumun gizlenip gizlenmediği bildirene söylenmez; söylenirse yazar kimin bildirdiğini tahmin eder |
| Engelin **yönü** ilan edilmez | "Seni engelledi" bilgisi tacizin devamına yol açar; "beni kim engelledi" diye bir uç **yok** ve olmayacak |
| Gizlenen yorumun **sebebi yazarına gösterilir** | Gizliliği korumak, kullanıcıyı karanlıkta bırakmak anlamına gelmez |
| Bildirme penceresi **sonuç sözü vermez** | "Bu yorum kaldırılacak" tutulamayacak bir sözdür; karar moderasyona aittir |

### Doğrulama

| Madde | Sonuç |
|---|---|
| Backend testleri — **bulut**, gerçek PostgreSQL 16 bağlıyken | ✅ **426 / 426** (0 kaldı, 0 atlandı). Bu bir **bulut** ölçümüdür; cihaz başarısı sayılmaz |
| Uygulama testleri — **bulut** | ✅ **332 geçti / 0 kaldı / 1 atlandı** (333) |
| Yeni E9 testleri | `backend/test/moderation.test.mjs` **31** · `app/test/moderation-reasons.test.mjs` **19** · `account-deletion.test.mjs` **16** |
| Üç yerdeki sebep listesi (arayüz ↔ sunucu ↔ `CHECK` kısıtı) | ✅ artık **testle** eşleşiyor. Biri değişip diğeri unutulursa test kırılır — eskiden kullanıcı "Geçerli bir sebep seçilmeli." hatasını alırdı |
| Arayüz sızıntı taraması (kaynak kodu üzerinde) | ✅ bildirim sayısı / bildiren kimliği / engelin yönü hiçbir ekranda okunmuyor |
| Web derlemesi | ✅ `index.bundle` **HTTP 200** (6,2 MB); yeni ekran ve pencereler derlenmiş çıktının içinde |
| Cihaza yazılan dosya | **15** dosya (7 arayüz + 8 sunucu/test) |
| md5 karşılaştırması (bulut ↔ cihaz) | ✅ **15 / 15 birebir aynı** |
| Uygulama testleri — **senin makinende** (ölçüldü) | ✅ **332 geçti / 0 kaldı / 1 atlandı** — bulut sonucunun aynısı |
| Backend testleri — **senin makinende** (ölçüldü) | ✅ **368 test geçti / 0 kaldı**; E9 dosyaları dâhil (`moderation` + `account-deletion` + `migrate-plan` = 54 geçti, 11 canlı DB testi ATLANDI) |
| Cihazda çalıştırılamayan 4 dosya | `freeze` · `radar` · `results` · `scorecard-provenance` (**58 test**). Sebep **başarısızlık değil**: bu dosyalarda saniyelerce süren gerçek bekleme testleri var, cihaz köprüsünün **45 saniyelik** sınırını aşıyorlar. Dördü de E9 kodunun hiçbir parçasını çağırmıyor ve bulutta aynı dosyalar üzerinde geçiyor |
| **Gerçek telefonda bildir/engelle akışı** | ❌ **Henüz denenmedi.** Yukarıdakilerin hepsi kod ve birim testi ölçümüdür; gerçek cihaz başarısı **değildir** |


---

## H. E16 — Topluluk Kuralları + operatör inceleme ekranı (25.07.2026)

Google'ın kullanıcı içeriği için istediği **üçüncü** şart buydu: bildirimlere
karşılık veren, **yazılı** bir inceleme süreci. Bildirme (E9) ve engelleme (E9)
zaten vardı; eksik olan tek parça buydu ve artık kapandı.

### Ne yapıldı

| Katman | İçerik |
|---|---|
| Herkese açık sayfa | `backend/legal/topluluk-kurallari.html` → `/topluluk-kurallari` (ayrıca `/community-guidelines` ve `.html` biçimi). **Uygulama kurulmadan açılır** — mağaza incelemecisi doğrudan görebilir. Gizlilik ve hesap silme sayfalarıyla aynı sunucudan, aynı biçimde servis edilir |
| Uygulama içi bağlantı | Hakkında ekranı → **📋 Topluluk Kuralları**. Adres tek kaynaktan (`app/src/brand.js` → `COMMUNITY_RULES_PATH`) gelir; ekrana elle yazılmaz |
| Operatör kapısı | `backend/src/moderatorGate.js` — yetki **yalnız** `backend/.env` içindeki `MODERATOR_EMAILS` listesinden okunur. Liste tanımsız/boşsa **herkes reddedilir** (fail-closed). Eşleşme tamdır (alt-dize ile yetki alınamaz), büyük/küçük harf ayrımı yoktur, **e-postası doğrulanmamış** hesap listede olsa bile operatör sayılmaz |
| Sunucu uçları | `GET /api/moderation/access` (herkese 200 döner, cevabı `{operator:true|false}`) · `GET /api/moderation/reports` · `POST /api/moderation/comments/:id/hide` · `.../unhide` · `POST /api/moderation/reports/:id/dismiss` — sonuncular operatör olmayana **403** |
| İnceleme ekranı | `app/src/screens/ModerationScreen.js` — açık bildirimleri yoruma göre gruplayıp listeler; her yorum için **Yorumu Gizle** / **Gizlemeyi Geri Al** / bildirim başına **Yok say**. Profil'deki giriş yalnız operatöre görünür |

### Bilerek verilmiş kararlar (testle korunuyor)

| Karar | Neden |
|---|---|
| Operatör kimliği **uygulamaya gömülmez** | Android paketi açılıp okunabilen bir dosyadır; oraya yazılan liste herkese açık olurdu. Uygulama yalnız sunucunun cevabına bakar |
| Giriş **varsayılan olarak gizlidir** | Yetki cevabı gelene kadar (ve ağ hatasında) giriş görünmez; aksi hâlde giriş herkeste bir an belirirdi |
| Ekran **kendi yetkisini kendisi de sorar** | Girişi gizlemek tek başına yetmez: geri tuşu veya derin bağlantı kayıtlı bir ekrana ulaşabilir |
| Yetkisizken liste ucu **hiç çağrılmaz** | Reddedilecek isteği yollamak, sunucu kayıtlarını gereksiz 403'lerle doldurmaktan başka işe yaramaz |
| **Bildirenin kimliği operatöre de gösterilmez** | Bildiren kişiyi koruma sözü, panelde delinirse söz olmaktan çıkar. Operatöre yalnız **kaç kişi** bildirdiği gösterilir (otomatik gizleme eşiği üç **farklı** kişidir; bu sayı olmadan karar verilemez) |
| Gizlemenin **elle mi otomatik mi** olduğu ayrı rozetle söylenir | Otomatik gizleme, bildirimler geri çekilirse **kendiliğinden kalkabilir**; elle gizleme kalkmaz. İkisini tek rozette birleştirmek, operatöre kalıcı sandığı bir kararın geçici olduğunu gizlerdi |
| Gizli yorumdaki düğmenin adı **"Gizli Kalsın"** | O düğme gizlemez, gizlemeyi **mühürler** (sebebi "elle" yapar). "Gizle" demek yaptığı işi yanlış anlatırdı |
| **Yok say** iki adımlı onay ister | Gizleme ve geri alma aynı ekrandan döndürülebilir; **yok sayma dönmez**. Ekranda "bu adım geri alınamaz" yazar |
| Özet satırları **eksiği gizlemez** | "5 bildirim vardı, 4 gördüm" durumu açıkça yazılır; silinmiş yoruma ait bildirimler ayrıca sayılır. Sebep **uydurulmaz** (liste sınırı mı, silinmiş yorum mu — sunucu söylemiyor, ekran da söylemez) |

### Doğrulama

| Madde | Sonuç |
|---|---|
| Backend testleri — **bulut**, gerçek PostgreSQL 16 bağlıyken | ✅ **486 / 486** (0 kaldı, **0 atlandı** — canlı DB testleri gerçekten çalıştı). **Bulut** ölçümüdür; cihaz başarısı sayılmaz |
| Uygulama testleri — **bulut** | ✅ **376 geçti / 0 kaldı / 1 atlandı** (377). Atlanan test, derlenmiş web çıktısı olmadığında atlanan eski testtir |
| Yeni testler | `backend/test/moderation-ops.test.mjs` **52** (44–52 arası gerçek şemaya karşı) · `backend/test/legal-pages.test.mjs` **+6** · `app/test/moderation-panel.test.mjs` **44** |
| Yetki sızıntısı taraması | ✅ `MODERATOR_EMAILS` **hiçbir** uygulama dosyasında geçmiyor; moderasyon dosyalarında e-posta adresi yazılı değil; yetki kararı yerel karşılaştırmayla verilmiyor |
| Bildiren kimliği taraması | ✅ ne ekranda ne de görünüm mantığında `reporterId` / `reporters` benzeri bir alan okunuyor |
| Kurallar sayfası ↔ kod tutarlılığı | ✅ sayfadaki sebep başlıkları uygulamadaki sebep listesiyle **birebir**; otomatik gizleme eşiği ("üç farklı kişi") sayfada doğru anlatılıyor; sayfa bildirene **kimlik açıklama sözü vermiyor** |
| Web derlemesi | ✅ `index.bundle` **HTTP 200** (6.242.727 bayt); İnceleme ekranı, uçlar ve kurallar bağlantısı derlenmiş çıktının içinde |
| Cihaza yazılan dosya | **24** dosya (8 uygulama + 12 sunucu/sayfa/test + 4 belge) |
| md5 karşılaştırması (bulut ↔ cihaz) | ✅ **24 / 24 birebir aynı.** Ayrıca `backend/src` + `app/src` + `app/test` ağacının tamamı (**261** dosya) ve `backend/test` ağacının tamamı (**45** dosya) dosya dosya karşılaştırıldı: **hepsi birebir aynı**. Bu tarama, ilk denemede gözden kaçan **2 eksik yardımcı dosya** (`test/helpers/livePg.mjs`, `test/helpers/pgSupabase.mjs`) ile **2 eski test dosyasını** (`migrate-live`, `moderation`) ortaya çıkardı; dördü de gönderilip doğrulandı |
| Testler — **cihazda**, moderasyon dosyaları | ✅ `moderation-ops` + `legal-pages`: **66 test, 57 geçti, 0 kaldı, 9 atlandı.** Atlananlar canlı PostgreSQL isteyen testlerdir (cihazda `MIGRATION_TEST_DB_URL` yok) — **atlandı, geçti demek değildir** |
| Testler — **cihazda**, yeni gönderilen 2 dosya | ✅ `moderation` + `migrate-live`: **44 test, 21 geçti, 0 kaldı, 23 atlandı** (yine canlı DB testleri). Eşitlemeden önce bu dosyalar cihazda `ERR_MODULE_NOT_FOUND` ile **çöküyordu**; artık çökmüyor |
| Testler — **cihazda**, tam süit (486) | ⚠️ **Ölçülemedi.** Cihaz sanal makinesi ağ dokunan testlerde çok yavaş (`api.test.mjs`: cihazda **17,9 sn**, bulutta **0,43 sn** — ~42 kat) ve cihaza verilen her komutun **45 sn** üst sınırı var; arka planda çalıştırma da komutlar arasında yaşamıyor. Kod kusuru değil, ortam sınırı — **geçti diye yazılmadı** |
| **Gerçek telefonda inceleme akışı** | ❌ **Henüz denenmedi.** Yukarıdakilerin hepsi bulut, cihaz-bilgisayarı ve birim testi ölçümüdür |

### Sende kalan tek iş

`backend/.env` dosyasına şu satırı ekle (kendi **doğrulanmış** e-postanla):

```
MODERATOR_EMAILS=senin@eposta.adresin
```

Bu satır olmadan **hiç kimse** operatör değildir — İnceleme girişi kimsede
görünmez, uçlar herkese 403 döner. Birden fazla adres yazacaksan virgül,
noktalı virgül, boşluk veya satır sonu ile ayırabilirsin.

> **Süre sözü:** Topluluk Kuralları sayfası, bildirimlerin **en geç 7 gün
> içinde** inceleneceğini yazıyor. Bu, tutulabilir bir söz olmalı. Değiştirmek
> istersen tek yer: `backend/legal/topluluk-kurallari.html`.

---

## Yayın Stüdyosu (yayıncı modu) — 26 Temmuz 2026

Yayıncı alanı sıfırdan yeniden yazıldı. Eski "Sunum" ekranı (`BroadcastScreen`)
**silinmedi**; stüdyonun içinden erişilen ikincil ekran olarak duruyor ve
17 testi çalışmaya devam ediyor.

> **Not:** Aşağıdaki tablo ilk geçişin (üç ekran) kaydıdır. Aynı gün gelen
> yayıncı geri bildirimiyle stüdyo dördüncü ekranı, yeni yazı tipini ve resmî
> bülten görünümünü aldı — güncel durum için bu bölümün sonundaki
> **"Stüdyo ikinci geçişi"** başlığına bak.

| Katman | İçerik |
|---|---|
| Saf mantık | `app/src/broadcastStudio.js` — satır kurma, tek/çift/kapalı dağılımı, kolon sayısı, toplam risk, en riskli maçlar, hazırlık durumu. Ekran bileşeni içermez, doğrudan test edilir |
| Seçim deposu | `app/src/broadcastStudioStore.js` — seçimler ve yayıncı notları hafta bazında saklanır (`sportoto.broadcastStudio.v1`). Kupon taslağı deposuna **dokunmaz**; kaydedilen kuponun yalnız **kimliğini** hatırlar, içeriğini ikinci kez saklamaz |
| Ana bülten ekranı | `app/src/screens/StudioBulletinScreen.js` — 15 satır: sıra no, tarih, saat, maç adı, **1-0-2** kutuları, analiz alanı. Seçili kutu renklenir ve kalıcıdır |
| Maç detay ekranı | `app/src/screens/StudioMatchScreen.js` — **önce radarlar, sonra istatistikler**, ardından sistem önerisi, risk yorumu ve yayıncı notu. Buradaki 1-0-2 seçimi ana listeye anında yansır |
| Kupon kaydı | Ayrı bir final kupon ekranı **yoktur** (kaldırıldı — aşağıya bakınız). Kayıt bülten ekranının sağ özet panelinde durur: kupon adı, **"Kuponu Kaydet"** düğmesi, engel varsa sebebi, kaydedildikten sonra **"Arşivi aç ›"** ve ekran görseli paylaşımı. Kaydedilen kupon mevcut **Kuponlarım** arşivine gider |
| Yatay şerit | Tek satır, sola kaydırmalı: **Sportoto Liste · Rakip Gücü · xG · Oynanma Oranı · Oran · Bülten Sırası DNA · İstatistik** |
| Logo | Üç ekranın da tepesinde `StudioHeader` içinde **Sportoto Master Analiz** logosu |

### Bilerek verilmiş kararlar (testle korunuyor)

| Karar | Neden |
|---|---|
| Ekranda **1-0-2** yazar, depoda değer **`X`** kalır | Yayıncının gördüğü resmî gösterim 1-0-2'dir. Depodaki değeri değiştirmek, kuponları ve diğer bütün ekranları kırardı. Çeviri yalnız **gösterim** katmanında yapılır; seçim kutularında "X" görünmediği tarayıcıda denetlenir. Denetim **kutulara** bakar, tüm ekrana değil: özet panelindeki **"Kapalı (1X2)"** bir kolon yazımı değil, bir başlıktır |
| Arşiv düğmesi **mevcut "Kuponlarım" sekmesini** açar | İkinci bir arşiv ekranı yazmak, aynı kuponu iki ayrı yerde iki ayrı biçimde göstermek demekti |
| Hafta kilitlendikten sonra **seçim de not da** salt okunur | Kilit yalnız görsel olsaydı, geri tuşuyla ya da başka ekrandan girilince yazma yine mümkün olurdu. Kural **depoda** uygulanır, ekranda değil |
| Kupon, **ilk maç başlamadan** kaydedilir | Kupon deposu başlamış maçın seçimini zaten reddediyordu; eksik olan, yayıncıya bunun **önceden** söylenmesiydi |
| "Kuponu Kaydet" kaydedemeyeceği anda **gerçekten kapalıdır** | Sadece soluklaştırmak, basılabilen ama hiçbir şey yapmayan bir düğme bırakıyordu. Kapatmak ancak sebebin **ekranda yazılı** olmasıyla dürüst olur: **üç** sebebin (hafta kilidi · başlamış maç · eksik seçim) üçü de düğmenin hemen üstünde yazıyor |
| **Kolon sınırı stüdyoda engel değil, bilgidir** (senin isteğin) | Yayıncı 15 maçı da kapalı işaretleyip "bu hafta her şey açık" diyebilmeli; bu 14 milyondan fazla kolon eder, **oynanamaz ama anlatılabilir.** Sayı gizlenmiyor, yazılıyor — düğmeyi kapatmıyor. Resmî **2.500** sınırı oynanacak kupon akışında (`CouponEditorScreen`, `coupon/smart.js`) **aynen duruyor**, bunu ayrı bir test koruyor |
| `kayitKapali` ifadesi **teste sabitlendi** | Sebep listesi tek yerde (`studioCouponSave.js` → `saveBlockerOf`) durur, düğme de doğrudan ona bağlıdır (`kayitKapali = !!engel`). Dördüncü bir sebep eklenirse metni kendiliğinden ekrana çıkar. Sebepsiz kapalı düğme, sessiz düğmeden beterdir |
| **Final kupon ekranı kaldırıldı** (senin isteğin) | Kayıt, ad, engel uyarısı, arşiv ve görsel paylaşımı zaten bülten ekranındaydı; ikinci ekranın kendine ait tek paneli **"Tüm Maç Seçimleri"** idi, onu da tablonun kendisi gösteriyor. 15. maç işaretlenince ekran artık **hiçbir yere atlamıyor.** Ekranın geri gelmediği beş ayrı testle sınanıyor: dosya yok, rota yok, düğme yok, otomatik geçiş yok, `studio-coupon-*` kancaları `src/` içinde hiç geçmiyor |

### Doğrulama

| Madde | Sonuç |
|---|---|
| Uygulama testleri — **bulut** | ✅ **486 test · 485 geçti / 0 kaldı / 1 atlandı** (7,4 sn). Atlanan, derlenmiş web çıktısı olmadığında atlanan eski testtir |
| Uygulama testleri — **senin makinende** (ölçüldü) | ✅ **486 test · 485 geçti / 0 kaldı / 1 atlandı** (30,0 sn) — bulut sonucunun aynısı |
| Backend testleri — **bulut** | ✅ **486 test · 454 geçti / 0 kaldı / 32 atlandı.** Atlananlar canlı PostgreSQL isteyen testlerdir; bu kapta `SUPABASE_DB_URL` yok — **atlandı, geçti demek değildir** |
| Yeni testler | `app/test/broadcast-studio.test.mjs` · `broadcast-studio-store.test.mjs` (27) · `studio-screens.test.mjs` (22) |
| Web derlemesi | ✅ `index.bundle` **HTTP 200** (6.429.104 bayt); üç stüdyo ekranı da derlenmiş çıktının içinde |
| **Gerçek tarayıcıda çizim denetimi** (`npm run verify:render`) | ✅ **33 / 33 adım geçti · 0 kod hatası.** Chromium'da uçtan uca: bülten çizimi → seçim → kilitli satıra zorla dokunma → yatay şerit → detay ekranı → not → 15/15 → final kupon → kayıt kapısı → arşiv → 390 px dar ekran |
| Kilit — **gerçek saatle** | ✅ 1525. haftanın **4 maçı başlamış** (1, 6, 12, 13). Ekran kısmî kilit uyarısını bastı, başlamış satıra zorla dokunmak kaydı **değiştirmedi**, kupon ekranı başlamış maçları **isim isim** sayıp kaydı reddetti, reddedilen kupon arşive **yazılmadı** |
| Kayıt — **yayın öncesi saatte** | ✅ Tarayıcı saati, bültendeki **en erken maçtan 2 saat öncesine** alınarak (yayıncının kuponu doldurduğu gerçek an) başarı yolu da denendi: hiçbir maç kilitli değil, engel uyarısı yok, kupon kaydedildi ve arşive yazıldı. **Veri gerçektir; yalnız "şimdi" oynatılmıştır** |
| Dar ekran (390 px) | ✅ Şerit gerçekten kayıyor (içerik 762 px / görünen 390 px), kaydırma sonrası son sekme görünür oldu, **sayfada yatay taşma 0 px** |
| Erişilebilirlik | ✅ Kapalı kaydet düğmesi hem ekran okuyucuya (`aria-disabled`) hem tarayıcıya (`disabled`) kapalı. **Bu kusur tarayıcıda yakalandı**: `accessibilityState` react-native-web'de DOM'a yazılmıyor, ekran okuyucu düğmeyi "kullanılabilir" sanıyordu — 485 birim testinin hiçbiri göremezdi |
| Cihaza yazılan dosya | **14** dosya |
| md5 karşılaştırması (bulut ↔ cihaz) | ✅ **14 / 14 birebir aynı** |
| **Gerçek telefonda stüdyo akışı** | ❌ **Henüz denenmedi.** Yukarıdakilerin hepsi bulut, cihaz-bilgisayarı ve tarayıcı ölçümüdür — telefon başarısı **değildir** |

---

## Stüdyo ikinci geçişi — 26 Temmuz 2026 (yayıncı geri bildirimi)

İlk geçiş bittikten sonra ekranları canlı kullanıp beş noktada geri bildirim
verdin. Beşi de kapatıldı. Bu bölüm **ne değişti** ve **neden öyle karar
verildi** onu yazar; ölçüm sonuçları en altta, dürüst boşluklarıyla birlikte.

### Geri bildirim → ne yapıldı

| Söylediğin | Ne yapıldı |
|---|---|
| "sistem tahmin vermesin — eksik oyuncu ve teknik direktör verisi bulunamadığı için güven düşürüldü, bunu çıkaralım, elimizde veri yok" | Motor artık yayıncıya **1-0-2 önerisi vermiyor**. Panelin adı "Sistem Önerisi" değil **"Motor Okuması"**. `userMatchEngine.js` içinde her kriterin çıktısı ikiye ayrıldı: `fact` = ölçülen gözlem ("Hacken iç sahada fena değil (3G-2B-1M)"), `lean` = bunun 1-0-2'ye etkisi. Yayıncı modu **yalnız `fact`** gösterir. Birleşik `note` alanı harfi harfine eskisiyle aynı üretilir — bu yüzden Maç Detayı, Radar ve Master Analiz ekranları **hiç değişmedi** |
| "bunlar kafa karıştırıyor" (`Bülten sırası: 5` · `DİKKAT` · `Temkinli` rozet satırı) | Rozet satırı **kaldırıldı**. Üç ayrı ölçek (sıra numarası, uyarı, risk dili) yan yana durunca hangisinin neyi anlattığı okunmuyordu |
| "yayıncı ana sayfası bu şekilde olması lazım ve kayıtlı kalması lazım — bir sonraki hafta geçmiş haftaya bakacağım, kaç tuttu vs." | Ana sayfa **resmî sonuç tablosu** düzenine geçti: solda 15 satırlık tablo, sağda özet paneli (dar ekranda panel alta iner). Geçmiş hafta karnesi **kalıcı bir ekran** oldu (`StudioKarneScreen`, rota `StudioKarne`) ve dört bölümü birden taşır: **maç maç** (senin seçimin ↔ resmî sonuç) · **kaç tuttu** (15'te X) · **resmî ikramiye tablosu** · **haftalar arası birikimli karne** |
| "yayıncı stüdyo teması yapay zeka olduğu çok belli — her yapay zeka aynı temayı aynı fontu kullanıyor ve çok fazla büyük yazılar sıralıyor" | Dört ekranın tamamı **resmî bülten tablosu** görünümüne çevrildi: kağıt beyazı zemin, ince gri çizgiler, sıkışık satır, koyu lacivert başlık şeridi, turuncu vurgu, küçük punto. Yazı tipi uygulamaya **gömüldü** (Barlow Semi Condensed) |
| "takım logoları da olsun" | `TeamCrest` bileşeni: bülten tablosunda ve karnede takım arması; **arma yoksa ⚽** çizilir, uydurma logo konmaz |
| "bülten yeni açıklandı, takım logoları eşleşmeyenler var — eşleşmeyen logo takım isimleri için önlem almamız lazım" | **Arma kayıt defteri** (`backend/src/crestRegistry.js`). Arma artık fikstür eşleşmesinin yan ürünü değil: her yenilemede kaynağın sezon takım listelerindeki armalar kalıcı deftere işleniyor, maç eşleşmese de kulüp arması çiziliyor. Defter **varsayılan-ret** çalışır — aynı ada birden çok kulüp denk gelirse arma verilmez, ⚽ kalır |

### Tema kararları (kod yorumlarına da yazıldı)

| Karar | Neden |
|---|---|
| Yazı tipi **gömülü** (`@expo-google-fonts/barlow-semi-condensed`), uzaktan indirilmiyor | Yayın sırasında font indirmeyi beklemek kadrajı bozar; internet yokken de açılmalı |
| Font **çalışmanın önkoşulu değil** | Font yüklenene kadar uygulama beklemez: `fontOf()` boş stil döner, ekran sistem fontuyla çizilir, font hazır olunca kendiliğinden yeniden çizilir. Yükleme başarısız olursa stüdyo yine çalışır |
| Yalnız **dört kesim** kullanılıyor (400/500/600/700) | Kalınlığı el ile "sahte-kalın" yaptırmamak için her stilde `fontWeight: 'normal'` sıfırlaması var; tarayıcı harfleri şişirmiyor |
| **İtalik yok** | Gömülü ailenin eğik kesimi yok; tarayıcı harfleri yamultarak sahte-italik çizerdi. "Veri yok" bilgisi zaten soluk renkle ayrılıyor |
| Hap (pill) sekme yerine **köşeli sekme + turuncu alt çizgi** | Turuncu dolgu hap, her arayüzde görülen kalıp — "yapay zeka teması" hissinin büyük kısmı buradan geliyordu. Alt çizgi kadrajda daha az yer kaplar ve tabloyla aynı dili konuşur |
| Süs emoji (💬 📈 ⚠) **kaldırıldı**, anlam taşıyan 🔒 **kaldı** | Kilit işareti bir durum bildiriyor; diğerleri yalnız süstü |
| Rakamlar **eşit genişlikte** (`tabular-nums`) | Alt alta gelen sayılarda sütun kaymasın |
| Punto **tek kaynaktan** (`T(k)`), ekran genişliğine göre ölçekli | Ekranın içine serpiştirilmiş sabit puntolar "çok fazla büyük yazı" sorununun kaynağıydı; artık dosyaların hiçbirinde elle yazılmış punto yok |

### Değişen dosyalar

| Tür | Dosyalar |
|---|---|
| Yeni | `app/src/studioFonts.js` (font yükleyici + `fontOf`) · `app/src/studioKarne.js` (karne saf mantığı) · `app/src/screens/StudioKarneScreen.js` · `app/test/studio-karne.test.mjs` · `app/test/studio-fonts.test.mjs` |
| Düzenlenen | `app/src/studioTheme.js` · `app/src/screens/studioParts.js` · `StudioBulletinScreen.js` · `StudioMatchScreen.js` · `StudioCouponScreen.js` · `app/src/broadcastStudio.js` · `app/src/broadcastStudioStore.js` · `app/src/userMatchEngine.js` · `app/App.js` · `app/scripts/render-studio.mjs` · `app/test/broadcast-studio.test.mjs` · `app/test/studio-screens.test.mjs` · `app/package.json` · `app/package-lock.json` |
| Onayınla eklenen paket | `expo-font` + `@expo-google-fonts/barlow-semi-condensed` (başka paket eklenmedi) |

### Doğrulama

| Madde | Sonuç |
|---|---|
| Uygulama testleri — **bulut** | ✅ **521 test · 520 geçti / 0 kaldı / 1 atlandı** (6,9 sn) |
| Uygulama testleri — **senin bilgisayarındaki kopyada** (ölçüldü) | ✅ **521 test · 520 geçti / 0 kaldı / 1 atlandı** (22,5 sn) — bulut sonucunun aynısı, dosyalar yerine kopyalandıktan **sonra** çalıştırıldı |
| Stüdyo test dağılımı | `broadcast-studio` 61 · `broadcast-studio-store` 27 · `studio-screens` 26 · `studio-karne` 22 · `studio-fonts` 8 = **144 test** |
| Web derlemesi | ✅ `index.bundle` **HTTP 200** |
| **Android paketi** (`expo export --platform android`) | ✅ Derlendi. Paket içinde ölçüldü: "Motor Okuması" metni **var**, `StudioKarne` rotası **var**, dört font adı da **var** |
| Web paketi (`expo export --platform web`) | ✅ Derlendi |
| **Gerçek tarayıcıda çizim denetimi** (`npm run verify:render`) | ✅ **41 / 41 adım geçti · 0 kod hatası.** Ekran görüntüleri `app/.render/` altında (13 kare) |
| Cihaza yazılan dosya | **18** kaynak dosya + font paketi (**82** dosya); sonradan font düzeltmesiyle **2** dosya daha |
| md5 karşılaştırması (bulut ↔ cihaz) | ✅ **20 / 20 birebir aynı**; aktarım arşivinin md5'i de iki tarafta aynı |
| Font paketi kurulumu | ✅ `app/node_modules/@expo-google-fonts/barlow-semi-condensed` **0.4.1** yerine kondu (18 `.ttf`) — senin `npm install` çalıştırmana gerek yok |

#### Sonradan yakalanan: uygulamaya 18 font gömülüyordu

Android paketini **ölçtüğümde** çıktı: `@expo-google-fonts/barlow-semi-condensed`
paketinin **kökündeki** `index.js`, ailenin **18 kesiminin tamamını** modül
düzeyinde `require` ediyor. Kökten tek bir kesim istesen bile paketleyici 18
`.ttf` dosyasını da uygulamaya gömüyor. Biz **4 kesim** kullanıyoruz; kalan 14'ü
(italikler dâhil) hiç çizilmiyordu ama indirilen dosyanın içindeydi.

| Ölçüm | Önce | Sonra |
|---|---|---|
| Uygulamaya gömülen font kesimi | 18 / 18 | **4 / 4** |
| Font dosyalarının toplam boyutu | 1.877.196 bayt (**1.833 KB**) | 409.992 bayt (**400 KB**) |
| Paketteki toplam varlık sayısı | 65 | **51** |

Düzeltme tek dosyada: `studioFonts.js` artık paketin kökünden değil **kesim
başına alt yoldan** içe aktarıyor (`…/700Bold` gibi). Davranış değişmedi, aynı
dört kesim yükleniyor; sadece kullanılmayan 14 dosya artık uygulamaya girmiyor
— **yaklaşık 1,4 MB** daha küçük indirme.

Bu düzeltmeyi `app/test/studio-fonts.test.mjs` (**8 test**) kilitliyor: kökten
içe aktarma yeniden yazılırsa test **düşer**. Kilidin gerçekten tuttuğunu
ölçtüm — kaynağı bilerek eski hâline döndürdüğümde ilgili **3 test düştü**,
geri aldığımda **8/8** yeniden geçti. Test ayrıca yükleme haritası ile ağırlık
tablosunun harfi harfine örtüştüğünü de bekçiliyor (tek harflik fark, hata
vermeden fontun **hiç uygulanmaması** demek), fontun bir **önkoşul olmadığını**
ve onaysız paket girmediğini denetliyor.

### Dürüst boşluklar

| Boşluk | Açıklama |
|---|---|
| **Gerçek telefonda stüdyo akışı** | ❌ **Hâlâ denenmedi.** Yukarıdakilerin tamamı bulut, bilgisayarındaki kopya ve tarayıcı ölçümüdür — **telefon başarısı değildir** |
| Resmî sonuç ucu bu kapta kapalı | Bu ortamın dışarı çıkışı yok: `/api/history/:roundId` **502** dönüyor. Karne ekranının resmî sonuç yolu tarayıcı denetiminde **sahte cevapla** sınandı; bu sahte veri **uygulamaya, depoya ve cihaza hiç yazılmadı**, yalnız denetim adımında yaşadı. Gerçek veriyle ilk çalıştırma **senin makinende** olacak |
| `expo-font` sürüm farkı | Senin `node_modules` içinde **57.0.0**, yeni `package.json` **^57.0.1** istiyor. Kullanılan arayüz (`useFonts`) ikisinde de aynı, uygulama şu hâliyle çalışır; bir dahaki `npm install`'da 57.0.1'e çıkar. Bunu ben zorlamadım — çalışan bir paketi elle değiştirmek daha riskliydi |
| Aktarım artıkları | `_to_delete/studio-sync.zip` (2,9 MB) ve `_to_delete/x/` (4,5 MB) senin klasöründe duruyor. Cihazda **silme yetkim yok**; istediğinde `_to_delete` klasörünü sen silersin |
| Fontun **göründüğü** ölçülmedi | Testler fontun **doğru yüklendiğini** (harita/ağırlık tutarlılığı, doğru dosyaların gömüldüğü) bekçiliyor; harflerin ekranda gerçekten Barlow ile çizildiğini **kanıtlamaz**. Onu tarayıcı denetimindeki ekran görüntüleri ve senin telefon denemen gösterir |

## Stüdyo üçüncü geçişi — 26 Temmuz 2026 ("sistem güvenli riskli vs yazmasın")

Senin cümlen: **"sistem güvenli riskli vs yazmasın / yayıncı modu için."**
Sorduğumda kapsam olarak **"Tamamen kaldır"**ı seçtin: ölçüm kodda kalsın,
yayıncı ekranına **hiç çizilmesin**.

Bu, ikinci geçişteki "sistem tahmin vermesin" geri bildiriminin devamıdır.
Orada motorun **1-0-2 önerisi** susturulmuştu; burada motorun **maça/kupona not
verme** hakkı kaldırıldı. İkisinin ortak kuralı şu: **ekran gözlemi anlatır,
hükmü yayıncı verir.**

### Ne kaldırıldı

| Nerede | Ne gitti |
|---|---|
| Bülten ekranı | Özet panelindeki **risk satırı** · ANALİZ sütunundaki **seviye rozeti** ("Orta · 47") |
| Final kupon ekranı | **TOPLAM RİSK** kutusu, çubuğu ve rozeti · **"En Riskli Maçlar"** panelinin tamamı · satır başına risk puanı sütunu |
| Maç ekranı | **"Risk Yorumu"** panelinin tamamı · **"Risk sinyali"** çipi · **"Veri güveni: Düşük/Orta"** çipi |
| İkincil "Sunum" rotası | Aday çıkmadığında yazan **"Temkinli bir hafta."** cümlesi |
| Ortak bileşenler | **`LevelBadge`** bileşeni ve **`toneOfLevel` / `toneSoftOfLevel`** renk eşlemesi **kod tabanından silindi** |

Bileşeni "kullanmayı bırakmak" yerine **silmeyi** seçtim: ortada çağrılacak bir
rozet kalmazsa ileride bir ekrana kazara geri eklenemez. Renk eşlemesi de aynı
sebeple gitti — bir maçı yeşil-sarı-kırmızı boyamak, yazıyla "güvenli/riskli"
demenin sessiz hâliydi. Renk sözlüğünün kendisi (`good/warn/bad`) duruyor;
**kolon sınırı aşımı** gibi nesnel uyarılarda kullanılıyor.

### Hesap silinmedi

Ölçümün tamamı `app/src/broadcastStudio.js` içinde **61 testiyle birlikte**
duruyor: `uncertaintyOf`, `levelOf`, `rowRisk`, `totalRiskOf`, `riskiestOf`,
`riskCommentary`, seviye eşikleri ve kapsama katsayıları. Yalnız **yayıncı
modunda çizilmiyor**. Yarın "geri koyalım" dersen sıfırdan yazılmayacak.

### Dürüstlük nasıl korundu

Kaldırılan arayüz, "elimde ne var / ne yok" bilgisini de taşıyordu; onu
kaybetmemek gerekiyordu. Yapılanlar:

- Bültenin **ANALİZ** sütunu artık hüküm değil **sayım** yazıyor: o maç için
  **kaç veri kaynağı bulunduğu** (`3 kaynak`), hiç yoksa **`Veri yok`**. Sayı
  ekranda hesaplanmaz — bulunan kaynak listesinin uzunluğudur.
- Alt açıklama bunun ne **olmadığını** da söylüyor: *"ANALİZ sütunu o maç için
  kaç veri kaynağı bulunduğunu söyler — bir değerlendirme değildir; motor 1-0-2
  önermez."* Bir sayı gösterip ne olduğunu söylememek, yayıncıya "3 kaynak"ı
  "3 puan" diye okuturdu.
- Silinen panelin içindeki **nötr** bilgi (seçimin türü: Tek / Çift / Kapalı)
  kaybolmadı; maç ekranının başlık satırına taşındı. Bu bir değerlendirme
  değil, yayıncının kendi işaretinin adıdır.
- **Bilerek yapmadığım şey:** yerine "hangi kaynaklar bulundu" listesi koymak.
  O kaynakların kendi adları içinde "risk" geçiyor (ör. *"Radar · favorinin
  yanılma riski"*), listelemek kaldırılan dili geri getirirdi. Adları
  değiştirmek ise `broadcastStudio.js`'e dokunmak olurdu — senin seçtiğin
  kapsam hesabın **aynen kalmasını** söylüyordu.

### Geri sızmasın diye: iki katmanlı kilit

| Katman | Ne yakalar |
|---|---|
| **Kaynak taraması** — yeni `app/test/studio-no-verdict.test.mjs` (**13 test**) | Sekiz yayıncı dosyasını metin olarak tarar: silinen bileşenler yok · hüküm fonksiyonları çağrılmıyor **ve** içe aktarılmıyor · yasak sözcük yok · kaldırılan panellerin test kancaları da yok · ANALİZ sütunu hâlâ kaynak sayısı yazıyor · **ölçüm hâlâ yerinde** (biri "kullanılmıyor" diye silmeye kalkarsa burada durur) |
| **Canlı denetim** — `app/scripts/render-studio.mjs` | Gerçek Chromium'da **çizilmiş metni** tarar (bülten · maç · kupon · karne). Sözcük bir bileşenin içinden, bir **veri alanından** veya sonradan eklenen bir panelden gelirse kaynak taraması göremez, bu görür |

İki katmanın yasak sözcük listesi **aynı olmak zorunda**; ayrışırsa biri
yakalar öbürü kaçırır ve yeşil test yanlış güven verir. Bunu ayrı bir test
karşılaştırıyor.

**Kilit bilerek bozularak ölçüldü:** kupon ekranına `"Bu kupon güvenli
görünüyor"` satırı eklendi → test **düştü** (13'te 1 kırmızı), satır geri
alınınca **13/13** yeşile döndü. Kilidin gerçekten çalıştığını bu gösteriyor.

### Değişen dosyalar

| Tür | Dosyalar |
|---|---|
| Yeni | `app/test/studio-no-verdict.test.mjs` |
| Düzenlenen | `app/src/screens/StudioBulletinScreen.js` · `StudioMatchScreen.js` · `StudioCouponScreen.js` · `app/src/screens/studioParts.js` · `app/src/studioTheme.js` · `app/src/broadcast.js` · `app/scripts/render-studio.mjs` |
| Dokunulmayan | `app/src/broadcastStudio.js` (ölçüm + 61 test) · `broadcastStudioStore.js` · depolama anahtarları · uygulamanın geri kalanı |
| Paket | Hiçbir paket eklenmedi/çıkarılmadı |

### Doğrulama

| Madde | Sonuç |
|---|---|
| Uygulama testleri — **bulut** | ✅ **534 test · 533 geçti / 0 kaldı / 1 atlandı** (7,9 sn) |
| Uygulama testleri — **senin makinende** | ✅ **534 test · 533 geçti / 0 kaldı / 1 atlandı** (23,2 sn), çıkış kodu **0**. Aynı sonuç, senin dosyaların üzerinde ölçüldü. Atlanan tek test: "derlenmiş web çıktısı: sekme başlığı ve paket temiz" (hazır web derlemesi ister, tasarımı gereği atlanır) |
| Yeni kilit testi | ✅ **13 / 13** (bulut ve **senin makinende** ayrı ayrı ölçüldü); bilerek bozulduğunda **kırmızıya döndüğü ölçüldü** |
| Dosya eşitliği | ✅ 10 dosyanın **md5 özeti** iki tarafta da birebir aynı — kopyada bozulma yok |
| Web derlemesi | ✅ `index.bundle` **HTTP 200** |
| **Gerçek tarayıcıda çizim denetimi** | ✅ **47 / 47 adım geçti · "KOD HATASI: yok"** (önceki 41'e 6 yeni adım eklendi: dört ekranda canlı hüküm taraması + "En Riskli Maçlar" panelinin **yokluğu**) |
| **Android paketi** (`expo export --platform android`) | ✅ Derlendi (4,1 MB `.hbc`) |
| Derlenmiş paketin **içi** ölçüldü | ✅ Hermes dizeleri UTF-16 saklandığı için bayt düzeyinde arandı: "Toplam Risk" · "TOPLAM RİSK" · "En Riskli Maçlar" · "Risk Yorumu" · "Veri güveni" · "Temkinli bir hafta" → **hepsi 0 kez**. Kalması gerekenler yerinde: "bir değerlendirme değildir" · "motor 1-0-2 önermez" · "Kolon sayısı" · "Veri yok" |

> Not: `strings` komutu Türkçe harfleri (ı, ş, ğ, İ) olan dizeleri UTF-16
> paketten **göremiyor** ve "temiz" diye yanıltıyor. İlk ölçümde bu tuzağa
> düştüm; sonuç bayt düzeyinde yeniden alındı. Yukarıdaki sayılar doğru olan
> ikinci ölçümdür.

### Dürüst boşluklar

| Boşluk | Açıklama |
|---|---|
| **Gerçek telefonda denenmedi** | ❌ Bu değişiklik de bulut + tarayıcı ölçümüdür. Telefonda görülmeden "yayında böyle görünüyor" denmez |
| **Kapsam yalnız yayıncı modu** | ⚠️ Senin tarif ettiğin kapsam buydu. **Master Analiz / Karar Motoru** yolunda "Güvenli kupon", "Veri Güvenliği", "Risk sinyali", "🟡 Temkinli" ifadeleri **duruyor**: `decisionEngine.js` · `analysis/engine.js` · `analysis/criteria.js` · `components/DecisionEngineView.js` · `components/MasterAnalysisView.js` · `components/RadarCenterCards.js` · `screens/RadarScreen.js` · `screens/MatchDetailScreen.js` · `screens/WeekSummaryScreen.js` · `screens/LiveMatchDetailScreen.js` · `userMatchEngine.js`. Aynı temizliği orada da istersen ayrı bir iş olarak yapılır |
| Hesap ayarları kapsam dışı | ℹ️ `Güvenlik Ayarları`, `Son Güvenlik Olayları` gibi metinler **hesap güvenliğidir**, maç hükmü değil — bilerek dokunulmadı |
