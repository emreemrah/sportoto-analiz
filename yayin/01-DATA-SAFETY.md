# Data Safety (Veri Güvenliği) Formu — Cevap Anahtarı

**Uygulama:** Sportoto Master Analiz
**Hazırlanma tarihi:** 24 Temmuz 2026
**Kaynak:** Bu cevaplar tahmin değildir; koddan doğrulanmıştır. Doğrulama
dosyaları her maddenin altında verilmiştir.

> **KESİN KURAL:** Bu formdaki her cevap `backend/legal/gizlilik.html` ile
> BİREBİR aynı olmalıdır. Google, formu gerçek veri akışıyla ve gizlilik
> politikasıyla karşılaştırır; uyuşmazlık yayından kaldırma sebebidir.
> Kodda veri akışı değişirse **önce bu dosya, sonra gizlilik metni, sonra
> Play Console formu** güncellenir.

---

## Bölüm 1 — Veri toplama ve paylaşma (genel)

| Soru | Cevap | Dayanak |
|---|---|---|
| Uygulamanız kullanıcı verisi topluyor veya paylaşıyor mu? | **Evet, topluyor** | Hesap açma zorunlu değil ama mümkün; e-posta ve kullanıcı adı toplanır |
| Toplanan verilerin tamamı aktarım sırasında şifreleniyor mu? | **Evet** | `app/src/apiBase.js` — yayın derlemesinde HTTPS dışı adres **hata verir**, sessizce yerele düşmez |
| Kullanıcıların verilerinin silinmesini talep etmesi için bir yol sunuyor musunuz? | **Evet** | Uygulama içi: `app/src/screens/DeleteAccountScreen.js` · Kurulum gerektirmeyen web: `backend/legal/hesap-silme.html` |
| Verileriniz bağımsız bir güvenlik incelemesinden geçti mi? | **Hayır** | Bağımsız denetim yaptırılmadı — dürüst cevap budur, "evet" işaretlenmemelidir |

---

## Bölüm 2 — Veri türleri

Aşağıdaki tablo **işaretlenecek** olan her veri türünü, neden toplandığını ve
zorunlu olup olmadığını gösterir.

### 2.1 Kişisel bilgiler

| Veri türü | Toplanır? | Paylaşılır? | Zorunlu? | Amaç | Dayanak |
|---|---|---|---|---|---|
| E-posta adresi | **Evet** | Hayır | Hesap açan kullanıcı için zorunlu | Hesap yönetimi (giriş, şifre sıfırlama) | `backend/src/routes/auth.js` |
| Kullanıcı adı | **Evet** | Hayır | Hesap açan için zorunlu | Uygulama işlevselliği (yorumlarda görünen ad) | `profiles` tablosu |
| Ad, soyad, adres, telefon, kimlik no | **Hayır** | — | — | Hiç sorulmaz | Kayıt formunda alan yok |
| Irk/etnik köken, siyasi görüş, cinsel yönelim, din, sağlık | **Hayır** | — | — | Hiç sorulmaz | — |
| Diğer kişisel bilgiler | **Hayır** | — | — | — | — |

> **Şifre notu:** Şifre Play formunda ayrı bir veri türü değildir; kimlik
> doğrulama sağlayıcısında **karma (hash)** olarak saklanır, düz metin olarak
> hiçbir yerde tutulmaz ve loglanmaz.

### 2.2 Fotoğraf ve video

| Veri türü | Toplanır? | Paylaşılır? | Zorunlu? | Amaç | Dayanak |
|---|---|---|---|---|---|
| Fotoğraflar (profil fotoğrafı) | **Evet** | Hayır | **İsteğe bağlı** | Uygulama işlevselliği (avatar) | `avatars` deposu — `backend/src/accountDeletion.js` `AVATAR_BUCKET` |
| Videolar | **Hayır** | — | — | — | — |

### 2.3 Uygulama içi kullanıcı içeriği

| Veri türü | Toplanır? | Paylaşılır? | Zorunlu? | Amaç | Dayanak |
|---|---|---|---|---|---|
| Diğer kullanıcı tarafından oluşturulan içerik | **Evet** | Hayır | İsteğe bağlı | Uygulama işlevselliği | `comments`, `comment_likes`, `community_poll_votes`, `player_votes`, `score_predictions`, `lineup_predictions`, `analysis_profiles`, `user_analysis_snapshots` |

Bu başlık altında toplananlar: yorumlar, beğeniler, anket ve oyuncu oyları,
skor ve kadro tahminleri, kaydedilen kuponlar, analiz profilleri.

### 2.4 Toplanmayan veri türleri — hepsi "Hayır" işaretlenir

| Veri türü | Cevap | Dayanak |
|---|---|---|
| Yaklaşık konum / Kesin konum | **Hayır** | `app.json` → `blockedPermissions` konum izinlerini engeller |
| Kişiler / Rehber | **Hayır** | `READ_CONTACTS` engellendi |
| Takvim | **Hayır** | İzin yok |
| Ses kaydı / Mikrofon | **Hayır** | `RECORD_AUDIO` engellendi |
| Kamera | **Hayır** | `CAMERA` engellendi |
| SMS / Telefon araması / Arama geçmişi | **Hayır** | İzin yok |
| Sağlık ve fitness | **Hayır** | — |
| Finansal bilgi (ödeme, satın alma geçmişi, kredi puanı) | **Hayır** | Uygulamada ödeme, satın alma ve para akışı **yoktur** |
| Cihaz veya diğer kimlikler (reklam kimliği dâhil) | **Hayır** | Reklam SDK'sı yok — `app/package.json` içinde reklam/analitik/izleme paketi bulunmuyor |
| Uygulama etkinliği / uygulama içi arama geçmişi | **Hayır** | Analitik SDK'sı yok |
| Web tarama geçmişi | **Hayır** | — |
| Uygulama performansı / çökme günlükleri / tanılama | **Hayır** | Crashlytics veya benzeri **yoktur** |
| Dosyalar ve belgeler | **Hayır** | Depolama izinleri engellendi |
| Kişisel olmayan diğer veriler | **Hayır** | — |

**Bağımlılık denetimi (24 Temmuz 2026):** `app/package.json` içindeki 17
bağımlılığın tamamı tarandı; `admob, firebase, analytics, sentry, crashlytics,
amplitude, mixpanel, segment, appsflyer, facebook, branch, onesignal, adjust`
kalıplarının **hiçbiri bulunmadı.**

---

## Bölüm 3 — Her veri türü için ayrıntı soruları

Play Console, işaretlenen her tür için aynı üç soruyu sorar. Cevaplar:

| Soru | E-posta | Kullanıcı adı | Profil fotoğrafı | Kullanıcı içeriği |
|---|---|---|---|---|
| Toplanıyor mu? | Evet | Evet | Evet | Evet |
| **Paylaşılıyor mu?** (üçüncü tarafa aktarım) | **Hayır** | **Hayır** | **Hayır** | **Hayır** |
| İşlenmiş/geçici mi, kalıcı mı? | Kalıcı | Kalıcı | Kalıcı | Kalıcı |
| Zorunlu mu, isteğe bağlı mı? | Hesap açarsa zorunlu | Hesap açarsa zorunlu | İsteğe bağlı | İsteğe bağlı |
| Amaç | Hesap yönetimi | Uygulama işlevselliği | Uygulama işlevselliği | Uygulama işlevselliği |

**"Paylaşılıyor mu?" neden "Hayır":** Google'ın tanımında *paylaşma*, veriyi
**başka bir şirkete/kuruluşa aktarmaktır.** Uygulamanın kullandığı barındırma
ve kimlik doğrulama sağlayıcıları Google'ın tanımıyla **hizmet sağlayıcıdır
(service provider)**, "paylaşım" değildir — bu sağlayıcılar veriyi yalnızca
uygulama adına işler. Gizlilik politikasının §3 bölümü bu sağlayıcıları
şeffaf biçimde listeler.

**Amaç listesinde İŞARETLENMEYECEKLER:** Reklamcılık veya pazarlama ·
Kişiselleştirme · Analiz · Dolandırıcılık önleme (ayrı bir SDK ile
yapılmıyor) · Geliştirici iletişimi (pazarlama e-postası gönderilmiyor).

---

## Bölüm 4 — Veri saklama ve silme

| Soru | Cevap |
|---|---|
| Kullanıcılar verilerinin silinmesini talep edebilir mi? | **Evet** |
| Uygulama içi silme yolu var mı? | **Evet** — Profil → Hesabımı Sil |
| Kurulum gerektirmeyen web bağlantısı var mı? | **Evet** — `https://<alan-adı>/hesap-silme` |
| Silme gerçek mi, pasife alma mı? | **Gerçek silme.** Satırlar veritabanından, avatar dosyaları depodan, kimlik kaydı kimlik doğrulama sağlayıcısından **kalıcı olarak** silinir |
| Kısmi başarısızlıkta ne olur? | "Silindi" **denmez**; hata dürüstçe bildirilir, hesap silinmez, kullanıcı tekrar deneyebilir |

**Silinmeyen ve neden:** Bülten arşivi, mühürlü analiz kayıtları, resmî maç
sonuçları, Radar ve Sistem Karnesi verileri kullanıcıya ait **değildir**; hiçbir
kullanıcı kimliğiyle ilişkilendirilmez. Bunlar herkese açık spor verisi ve
uygulamanın kendi ölçüm kayıtlarıdır. Bu ayrım hem hesap silme ekranında hem
web sayfasında kullanıcıya **açıkça yazılır.**

**Kanıt testleri:** `backend/test/account-deletion.test.mjs` (10 test) —
korunan 9 tablonun hiçbirine dokunulmadığını, `profiles` tablosunun en sonda
silindiğini, herhangi bir adım başarısız olursa kimlik kaydının **silinmediğini**
ve raporda e-posta/token/şifre geçmediğini kanıtlar.

---

## Bölüm 5 — Formu doldururken dikkat

1. Gizlilik politikası URL'si alanına **kurulum gerektirmeden açılan** adres
   yazılır: `https://<alan-adı>/gizlilik`
2. Hesap silme URL'si: `https://<alan-adı>/hesap-silme`
3. Her iki adres de Play incelemesi sırasında **çalışır durumda** olmalıdır;
   erişilemeyen bağlantı doğrudan ret sebebidir.
4. Form kaydedildikten sonra mağaza sayfasındaki "Veri güvenliği" bölümü
   ekran görüntüsü alınarak bu klasöre konulmalıdır (kayıt için).
