# Mağaza Derlemesi — Adım Adım (kod bilgisi gerektirmez)

Bu dosya uygulamayı **Google Play**'e (ve sonra App Store'a) göndermek için
izlenecek yolu anlatır. Komutlar `app/` klasöründe çalıştırılır.

> Bu rehber 1 Ağustos 2026 araştırmasına dayanır (kaynaklar: Expo, Google Play,
> Apple resmî dokümanları). Mağaza kuralları değişebilir — yayın gününde
> Play Console'daki uyarıları okuyun.

---

## 0. Önce bunlar hazır olmalı (kod dışı işler)

| # | İş | Neden |
|---|---|---|
| 1 | **Uygulama adı kararı** | "Sportoto" ibaresi marka riski taşıyor (bkz. `yayin/04-RISK-RAPORU.md`). Ad değişecekse **derlemeden önce** değişmeli: `app.json` içindeki `name`, `slug`, `scheme` ve `app/src/brand.js`. |
| 2 | **Alan adı + HTTPS backend** | Yayın derlemesi HTTPS zorunlu tutar; `http://` veya yerel IP verilirse uygulama **açılışta hata verir** (bilinçli: `src/apiBase.js`). |
| 3 | **Play Console hesabı** | 25 $ tek seferlik. play.google.com/console |
| 4 | **Destek e-postası** | `backend/.env` içindeki `SUPPORT_EMAIL` — yasal sayfalarda ve mağaza listesinde görünür. |
| 5 | **Expo hesabı** | expo.dev — ücretsiz. |

---

## 1. Kurulum (bir kez)

```bash
npm install -g eas-cli
eas login
eas init
```

`eas init` proje kimliğini `app.json` içine yazar ve expo.dev panelinde projeyi
oluşturur. `eas.json` **zaten hazır** (bu depoda) — `eas build:configure`
çalıştırmanıza gerek yok.

### Profiller (eas.json)

| Profil | Ne üretir | Ne zaman |
|---|---|---|
| `development` | APK (geliştirici istemcili) | Cihazda geliştirme. **`expo-dev-client` paketi gerekir** — kullanacaksanız: `npx expo install expo-dev-client` |
| `preview` | APK | Kendinize/test kullanıcılarına link ile göndermek |
| `production` | **AAB** | Google Play'e yükleme |

`production` profilinde `autoIncrement: true` açık: her derlemede `versionCode`
EAS tarafında otomatik artar, elle takip gerekmez (`appVersionSource: remote`).

---

## 2. Sunucu adresini tanımlayın (derlemeden önce ŞART)

```bash
eas env:set --name EXPO_PUBLIC_API_BASE --value https://SIZIN-BACKEND-ADRESINIZ --environment production --visibility plaintext
eas env:set --name EXPO_PUBLIC_API_BASE --value https://SIZIN-BACKEND-ADRESINIZ --environment preview --visibility plaintext
```

`https://` ile başlamalı. Yerel adres (localhost, 192.168.x.x) verilirse
uygulama yayın derlemesinde **açık hata verir**, sessizce yerele düşmez.

---

## 3. Derleme

```bash
# Test APK'sı (kendi telefonunuza kurmak için)
eas build --platform android --profile preview

# Play Console'a yüklenecek AAB
eas build --platform android --profile production
```

Derleme bulutta yapılır; bitince indirme linki verilir.
Ücretsiz katman: ayda 15 Android + 15 iOS derleme, tek eşzamanlı iş.

---

## 4. Play Console'a ilk yükleme

1. Play Console → **Create app** → ad, dil, "App", "Free" seçin.
2. **Play App Signing**: ilk AAB'yi yüklediğinizde Google imzalama anahtarını
   kendisi üretir ve saklar. Acemi için **önerilen ve varsayılan yol budur** —
   kendi anahtarınızı yönetmeniz gerekmez, kaybetme riski olmaz.
3. **Internal testing** parçasına AAB'yi yükleyin (inceleme yok, anında).
4. Zorunlu formlar (bunlar hazır, `yayin/` klasöründen kopyalanır):
   - Gizlilik politikası URL'si → `https://<backend>/gizlilik`
   - **Data Safety** formu → `yayin/01-DATA-SAFETY.md`
   - İçerik derecelendirme anketi → `yayin/03-ICERIK-DERECELENDIRME.md`
     (18+ bekleniyor; anketi **dürüst** doldurun)
   - Mağaza metinleri → `yayin/02-MAGAZA-METINLERI.md`
5. **Closed testing** → asıl kapı. Bireysel geliştirici hesapları için
   **en az 12 test kullanıcısı, 14 kesintisiz gün** şartı vardır (2026'da
   geçerli). Kurumsal hesaplar muaftır. Bu süre bitmeden Production açılmaz.
6. **Production** → yayın.

### Sık ret sebepleri (önceden kapatın)

- Gizlilik politikası erişilemiyor veya Data Safety formuyla çelişiyor
- İçerik derecelendirme anketi eksik/yanlış
- İzin kullanımının açıklanmaması (bu uygulamada yalnız bildirim izni var,
  8 izin `app.json` içinde açıkça bloklu)
- Test talimatı yetersiz ("more information needed")

---

## 5. iOS (sonraki aşama)

- **Apple Developer Program**: 99 $/yıl.
- 28 Nisan 2026'dan itibaren gönderimler Xcode 26 / iOS 26 SDK ile derlenmiş
  olmalı — EAS varsayılan derleme imajı bunu zaten karşılıyor, ek ayar yok.
- `eas build --platform ios --profile production` → `eas submit -p ios`
- İmzalama sertifikalarını EAS otomatik yönetir (`eas credentials`).

---

## 6. İsteğe bağlı: yalnız gerekirse yapılacaklar

### Android hedef API sürümü uyarısı gelirse

Google, 31 Ağustos 2026'dan itibaren yeni uygulamalarda `targetSdkVersion 36`
istiyor. Expo SDK 56 (React Native 0.85) bunu büyük olasılıkla zaten
karşılıyor — **derleme ya da Play Console hedef API için uyarı verirse**:

```bash
npx expo install expo-build-properties
```

sonra `app.json` içindeki `plugins` dizisine ekleyin:

```json
[
  "expo-build-properties",
  { "android": { "compileSdkVersion": 36, "targetSdkVersion": 36, "buildToolsVersion": "36.0.0" } }
]
```

> Paket kurulmadan bu satırı eklemeyin — derleme kırılır.

### Özel açılış (splash) ekranı isterseniz

Şu an Expo varsayılanı kullanılıyor. Özel görsel için:

```bash
npx expo install expo-splash-screen
```

sonra `app.json` → `plugins` dizisine:

```json
[
  "expo-splash-screen",
  { "image": "./assets/splash-icon.png", "backgroundColor": "#0B1B3A", "imageWidth": 200 }
]
```

`assets/splash-icon.png` depoda hazır bekliyor.

---

---

## Bağımlılık sağlığı (önemli — bir kez düzeltildi)

Paket sürümleri **Expo SDK 56'nın beklediği** aralıklara hizalandı
(1 Ağustos 2026). Öncesinde `expo-font` ve `expo-sharing` SDK 57 aralığıyla
yazılmıştı; bu, `node_modules` içinde **aynı native modülün iki sürümünü**
oluşturuyordu (`expo-font@57` + `expo-font@56`) ve native derlemeyi kıracak
bir durumdu. `npx expo install --fix` ile giderildi, `npx expo-doctor`
**21/21 temiz**.

Bundan sonra paket eklerken:

```bash
npx expo install <paket-adi>     # ✅ SDK ile uyumlu sürümü seçer
npm install <paket-adi>          # ❌ en son sürümü çeker, SDK'yı bozabilir
```

Derleme öncesi her zaman:

```bash
npx expo-doctor
```

---

## Kontrol listesi (derlemeden önce)

- [ ] Uygulama adı kesinleşti (marka riski değerlendirildi)
- [ ] Backend HTTPS adresinde çalışıyor ve `/gizlilik` açılıyor
- [ ] `backend/.env` içinde `SUPPORT_EMAIL` ve `MODERATOR_EMAILS` dolu
- [ ] `eas env:set` ile `EXPO_PUBLIC_API_BASE` tanımlandı
- [ ] `npx expo-doctor` temiz
- [ ] `npm test` (app) ve `npm test` (backend) geçiyor
- [ ] Mağaza görselleri hazır (ekran görüntüleri + öne çıkan görsel)
