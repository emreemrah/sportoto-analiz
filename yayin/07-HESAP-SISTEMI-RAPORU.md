# Hesap ve Profil Sistemi — Mimari ve Güvenlik Raporu

**Tarih:** 25 Temmuz 2026
**Kapsam:** Kullanıcı hesabı, kalıcı oturum, profil/ilerleme sistemi, güvenlik.

---

## 1. Sistem mimarisi

```
┌─────────────┐   HTTPS (yayında)   ┌──────────────┐   service role   ┌──────────┐
│  Uygulama    │ ──────────────────► │   Backend     │ ───────────────► │ Supabase │
│  (Expo RN)   │  Bearer / çerez     │  (Express)    │  tek yetkili     │ Auth+DB  │
└─────────────┘   + X-Session-Id     └──────────────┘                  └──────────┘
```

**Kimlik:** Supabase Auth. Şifre özetleri Supabase'te bcrypt ile, kullanıcı
başına ayrı salt'la saklanır — düz metin şifre hiçbir koda, veritabanı
tablomuza, loga veya cihaza yazılmaz. (İstenen Argon2id yerine bcrypt: mevcut
tüm hesapların özetleri Supabase'in yönetiminde; sağlayıcı değiştirmeden
algoritma seçilemez. Bcrypt, OWASP'ın kabul ettiği güvenli yöntemlerdendir ve
mevcut hesapları korumak bilinçli tercihtir.)

**Neden "sıfırdan" değil:** Mevcut sistemde gerçek hesaplar, kuponlar,
yorumlar ve test edilmiş hesap silme akışı var. Sıfırdan kurulum bu verileri
ve şifreleri (dışarı aktarılamaz) çöpe atardı. Onayınla mevcut sistem
güçlendirildi; istenen her özellik eklendi.

**Tablo eşlemesi:** İstenen `users` → `auth.users` (Supabase), `user_profiles`
→ mevcut `public.profiles`. Diğer 8 tablo migration 006 ile yeni oluşturuldu.

**Erişim modeli:** Uygulama Supabase'e ASLA doğrudan bağlanmaz; tek kapı
backend'dir. Yeni tabloların tümünde RLS açık ve HİÇBİR policy yok → anon
anahtarla erişim varsayılan olarak REDDEDİLİR. Kullanıcı kimliği her istekte
JWT'nin Supabase'e doğrulatılmasıyla belirlenir (`mw.js`) — istemcinin beyanına
asla güvenilmez; her uçta yetki denetimi `requireAuth` ile yapılır ve kullanıcı
yalnız kendi verisine erişebilir (`req.user.id` sorgu filtresidir).

## 2. Oturum modeli (süreli · yenilenebilir · iptal edilebilir)

- **Erişim belirteci (JWT):** kısa ömürlü (~1 saat). Mobilde
  **Keychain/Keystore** (expo-secure-store) içinde; webde üretimde **HttpOnly +
  Secure + SameSite çerezde** (JS okuyamaz), geliştirmede localStorage'da.
- **Yenileme anahtarı:** TEK KULLANIMLIK (rotasyon) — her yenilemede yenisi
  verilir. `POST /api/auth/refresh` sunucudaki oturum kaydı iptal edilmemişse
  çalışır.
- **Oturum kaydı (`sessions` + `devices`):** her giriş bir oturum satırı açar
  ve cihaza bağlanır. Kullanıcı **Bağlı Cihazlar** ekranında oturumlarını görür
  ve istediğini uzaktan kapatır. Şifre değişince **diğer tüm oturumlar
  sunucuda kapatılır**. 60 gün kullanılmayan oturum kendiliğinden düşer.
- **"Beni hatırla":** Uygulama açılışında `initAuth` kalıcı belirteci yükler;
  süresi dolmuşsa sessizce yeniler. Kullanıcıdan tekrar giriş istenmez.
  **Şifre cihazda hiçbir koşulda saklanmaz.**
- **CSRF (web çerez modu):** durum değiştiren isteklerde `X-Session-Id`
  başlığı zorunludur (çift-anahtar yöntemi); çerez `SameSite=Lax` + `Secure`.
- **Dürüst sınır:** oturumu uzaktan kapatılan kötü niyetli bir istemci,
  başlıkları hiç göndermezse elindeki erişim belirteci süresi dolana kadar
  (≤1 saat) salt-okuma uçlarına erişmeyi deneyebilir; yenileme kesinlikle
  reddedilir. Bu, kısa ömürlü JWT modelinin bilinen ve kabul edilen sınırıdır.

## 3. E-posta doğrulama ve şifre sıfırlama

- Kayıt artık `signUp` ile yapılır: Supabase panelinde **"Confirm email"**
  AÇIKSA gerçek doğrulama e-postası gönderilir, doğrulanana dek giriş
  yapılamaz; uygulama "yeniden gönder" seçeneği sunar. Ayar kapalıyken eski
  davranış (doğrudan giriş) korunur — kod iki durumu da destekler.
- Şifre sıfırlama Supabase'in e-postasıyla çalışır (mevcut akış korunur).
- Aynı e-postayla ikinci hesap: hem Supabase hem `profiles` benzersizliği
  engeller; kullanıcıya açık Türkçe mesaj verilir.
- E-posta değişikliği: mevcut şifre + yeni adrese doğrulama bağlantısı.

## 4. Puan / seviye / başarı / görev sistemi (tümü sunucu doğrulamalı)

- **Defter modeli:** `points_history` tek doğruluk kaynağıdır; toplam = SUM.
  `unique(user_id, kind, ref_id)` kısıtı sayesinde AYNI eylem AYNI puanı iki
  kez YAZAMAZ — istemci ne gönderirse göndersin veritabanı reddeder.
- **İstemciden puan yazdıran uç YOKTUR.** Katılım puanları sunucunun gördüğü
  gerçek eylemde (tahmin kilitleme, anket, kadro, kupon) verilir; isabet
  puanları YALNIZ resmî Spor Toto sonucu açıklanmış maçlardan, lider
  tablosuyla aynı kurallarla hesaplanır (tam skor 25 · doğru sonuç 10 ·
  anket 5-10). Canlı/geçici skor asla puanlanmaz.
- **Seviye:** tek formül — seviye n eşiği = 25·n·(n-1). Rozetler/görevler
  kod kataloğundan idempotent upsert ile tabloya eşitlenir.
- **Kupon puanı kasılamaz:** kupon başına bir kez ve ömür boyu en fazla 10
  kupon puanlanır. Doğrulanamayan koşullar ("ardışık hafta serisi" gibi)
  katalogda bilerek YOKTUR — dürüstlük kuralı.
- Başka kullanıcının puan/başarı verisini okuyan-yazan hiçbir uç yoktur.

## 5. Güvenlik önlemleri

| Tehdit | Önlem |
|---|---|
| Kaba kuvvet | Uç bazında oran sınırlama + geçici engel (giriş 10/15dk, kayıt 5/sa, hassas işlemler 5/15dk) |
| SQL injection | Ham SQL yok; tüm erişim Supabase istemcisinin parametreli sorgularıyla |
| XSS | RN metin bileşenleri kaçışlıdır; webde belirteçler HttpOnly çerezde (JS okuyamaz) |
| CSRF | SameSite çerez + zorunlu X-Session-Id çift-anahtarı |
| Oturum çalma | Kısa ömürlü JWT + rotasyonlu tek kullanımlık yenileme + sunucuda iptal edilebilir oturum kaydı + Keychain/Keystore |
| Yetkisiz erişim | Her uçta requireAuth; kimlik JWT'den, asla istemci beyanından; RLS default-deny |
| Hassas işlem | Şifre/e-posta değiştirme ve hesap silmede MEVCUT ŞİFRE ile yeniden doğrulama |
| Log sızıntısı | security_logs meta'sı beyaz listeyle süzülür; şifre/token/JWT görünümlü değer yazılamaz; e-posta maskelenir (a***@…) |
| Sahte puan | Sunucu doğrulamalı defter + unique kısıt (bkz. §4) |

## 6. Hesap silme

Mevcut gerçek silme akışına eklenenler: **mevcut şifreyle yeniden doğrulama**
(uygulama içi yolda) ve 6 yeni tablonun silme listesine eklenmesi
(`sessions`, `devices`, `user_achievements`, `user_tasks`, `points_history`,
`security_logs` — IP içerdiği için o da silinir). "Geri alınamaz" uyarısı,
kısmi başarısızlıkta "silindi" dememe kuralı ve korunan ortak veriler aynen
sürüyor.

## 7. Biyometrik giriş — TAMAMLANDI (onayınla)

`expo-local-authentication` (SDK 56 uyumlu 56.0.5) onayınla kuruldu.

- **Nasıl çalışır:** Kullanıcı **Güvenlik Ayarları → Biyometrik Kilit**'i
  açarsa uygulama her açılışta parmak izi / yüz tanıma ister (cihaz PIN'i
  cihazın kendi güvenli alternatifi olarak kalır). Varsayılan: **kapalı**.
- **Güvenli alternatif:** Doğrulama başarısız olursa kilit ekranında
  "Şifreyle giriş yap" her zaman vardır — oturum sunucuda kapatılır ve
  kullanıcı şifresiyle yeniden giriş yapar.
- **Veri:** Biyometrik veri uygulamaya ASLA girmez, kaydedilmez, ağa
  gönderilmez; cihazın güvenli doğrulama sistemi kullanılır ve uygulamaya
  yalnız başarılı/başarısız sonucu döner. Testle güvence altında: biyometrik
  modülün ağ erişimi ve veri yazımı olmadığı kaynak taramasıyla denetlenir.
- **Ayar değişikliği korumalı:** Kilidi açmak/kapatmak için de cihazın
  biyometrik doğrulaması gerekir.
- **İzinler:** Android'de kütüphanenin eklediği `USE_BIOMETRIC` /
  `USE_FINGERPRINT` normal izinlerdir (tehlikeli izin sınıfı değildir);
  iOS'te Face ID açıklaması `app.json`'a Türkçe olarak eklendi. Konum,
  kamera, mikrofon vb. engelli izin listesi aynen duruyor.
- Kilit yalnız destekleyen cihazlarda görünür; **web'de tümüyle kapalıdır**.

## 8. Test ve doğrulama

| Madde | Sonuç |
|---|---|
| Backend testleri | ✅ **327 / 327** (25'i yeni: oturum, oran sınırlama, log süzgeci, puan/başarı motoru) |
| Uygulama testleri | ✅ **89 / 89** (15'i yeni: şifre gücü, oturum durumu, "şifre depolanmaz" taraması, biyometrik kilit politikası) |
| Web derlemesi | ✅ başarılı; çalışan ekran doğrulaması (verify:screen) ✅ |
| Mükerrer ödül denemesi | ✅ testle kanıtlı: aynı eylem ikinci kez puan yazamıyor |
| Uzaktan oturum kapatma | ✅ testle kanıtlı: kapatılan oturum doğrulamadan geçemiyor |
| Migration yokken davranış | ✅ güvenli düşüş: uygulama çalışır, özellikler migration sonrası açılır |

## 9. KURULUM ADIMLARI — TAMAMLANDI (25.07.2026)

1. ✅ **Migration 006 uygulandı** — Supabase SQL Editor'da (Chrome köprüsü
   üzerinden, senin oturumunla) çalıştırıldı. Doğrulama sorgusu sonucu:
   8 tablo (`achievements, devices, points_history, security_logs, sessions,
   tasks, user_achievements, user_tasks`), hepsinde `relrowsecurity = true`.
2. ✅ **"Confirm email" ayarı açık** — panelde doğrulandı (zaten açıktı; eski
   kayıt kodu bunu admin yoluyla atlıyordu, yeni kod gerçek doğrulama ister).
   Not: Supabase'in yerleşik e-postası saatte az sayıda e-postayla sınırlıdır
   ve gönderen Supabase adresidir — yayın öncesi kendi SMTP'ni bağlaman
   önerilir (Authentication → Emails → SMTP Settings).
3. ✅ **Biyometrik giriş** — onayınla uygulandı (bkz. §7).

Ek dayanıklılık: backend migration'dan ÖNCE açılmış olsa bile yeniden
başlatma gerekmez — "tablo yok" durumu artık kalıcı ezberlenmiyor; katalog
eşitlemesi ve tablolar en geç 10 dakika içinde (ya da ilk profil
görüntülemede) kendiliğinden devreye girer.
