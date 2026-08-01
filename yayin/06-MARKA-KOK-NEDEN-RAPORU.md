# Marka Kök Neden Raporu

**Konu:** Ana Sayfa sol üst başlığında "Spor Toto Analiz", tarayıcı sekmesinde "Home" görünmesi
**Tarih:** 25 Temmuz 2026

---

## 1. İki ayrı kök neden

Bunlar tek bir hata değil, birbirinden bağımsız iki hataydı. Biri düzeltilse diğeri kalırdı.

### Kök neden 1 — Ana Sayfa başlığı: `app/src/screens/HomeScreen.js`, satır 37

Senin bilgisayarındaki dosyada başlık şöyleydi:

```jsx
Spor Toto <Text style={styles.brandAccent}>Analiz</Text>
```

Metin **tek bir dizge değil, iki parçaydı**: dışarıda `"Spor Toto "`, içeride ayrı bir
`<Text>` bileşeninin içinde `"Analiz"`. Aralarında yaklaşık 38 karakterlik JSX
işaretlemesi vardı. Ekranda birleşip "Spor Toto Analiz" okunuyordu, ama dosyada
böyle bir dizge hiç yoktu.

Bulutta düzeltilmiş hâli zaten şuydu:

```jsx
{BRAND_LINE_1} <Text style={styles.brandAccent}>{BRAND_LINE_2}</Text>
```

Yani düzeltme yapılmıştı — **ama bu dosya senin diskine hiç yazılmamıştı.**

### Kök neden 2 — Tarayıcı sekmesi: `app/App.js`, satır 301

`NavigationContainer` bileşenine `documentTitle` verilmemişti:

```jsx
<NavigationContainer theme={navTheme}>
```

React Navigation, web'de bu ayar verilmediğinde **odaktaki route'un ADINI**
`document.title` alanına yazar. Ana Sayfa `Stack.Screen name="Home"` olarak
kayıtlı ve `title` seçeneği yok → sekmede **"Home"** yazıyordu.

Kritik ayrıntı: `app.json` içindeki `web.name` doğruydu ve `index.html`
başlığını doğru üretiyordu. Ancak uygulama açıldıktan sonra React Navigation bu
başlığı **eziyor**. Bu yüzden derleme çıktısı doğru görünürken çalışan ekran
yanlıştı.

---

## 2. Önceki tarama neden kaçırdı — üç ayrı kör nokta

1. **Yanlış dosya sistemi.** "Kalıntı yok" taraması **bulut çalışma kopyasında**
   çalıştırıldı. Bulut kopyası zaten düzeltilmişti. Senin diskindeki eski dosya
   hiç taranmadı.
2. **Yapısal olarak kör arama kalıbı.** Kullanılan kalıplar tam dizge arıyordu:
   `Spor Toto Analiz`, `Spor Toto Master`, `SporToto Analiz`. Parçalı JSX metni
   bu kalıpların hiçbiriyle eşleşemez — kelimeler arasında etiket var.
   Aşağıdaki iki satır ekranda **aynı** görünür, ama aramaya göre biri "temiz"dir:

   | Ekranda görünen | Dosyadaki metin | `"Spor Toto Analiz"` araması |
   |---|---|---|
   | Spor Toto Analiz | `Spor Toto Analiz` | bulur |
   | Spor Toto Analiz | `Spor Toto <Text style={styles.brandAccent}>Analiz</Text>` | **bulamaz** |

3. **Ürün yerine ara ürün doğrulandı.** Sekme başlığı için derlenmiş
   `index.html` dosyasının `<title>` etiketi okundu. O etiket doğruydu. Ama
   kullanıcının gördüğü değer, uygulama çalıştıktan **sonra** oluşuyor. Çalışan
   ekran hiç ölçülmemişti.

**Not (dürüstlük):** Bu bir Metro/Expo önbellek sorunu **değildi**. Diskteki
dosya gerçekten eskiydi; önbellek temizlense de aynı eski metin derlenecekti.
Yine de aynı şüphenin bir daha doğmaması için önbellek konusu (§4) kapatıldı.

---

## 3. Yapılan düzeltmeler

| Dosya | Değişiklik | Amaç |
|---|---|---|
| `app/src/brand.js` | `BRAND_LINE_1` / `BRAND_LINE_2` artık elle yazılmıyor, `APP_NAME`'den türetiliyor (`APP_NAME.split(' ')`) | Parçalı gösterim ile tam ad **ayrışamaz** hâle geldi. Ad değişirse iki satır da otomatik değişir |
| `app/App.js` | `documentTitle={{ formatter: () => APP_NAME }}` eklendi; `APP_NAME` merkezî kaynaktan alınıyor | Sekme başlığı artık route adından değil, tek marka kaynağından geliyor. Biçimlendirici **parametre almıyor** → hiçbir route adı sızamaz |
| `app/src/screens/HomeScreen.js` | (Bulutta zaten doğruydu) diske yazıldı | Ana Sayfa başlığı merkezî kaynaktan besleniyor |
| `app/test/brand-surfaces.test.mjs` | **YENİ** — 8 test | Aşağıda §5 |
| `app/scripts/verify-brand-screen.mjs` | **YENİ** — çalışan ekran ölçümü | Aşağıda §4 |
| `app/package.json` | `start` / `web` / `android` / `ios` artık `--clear` ile; `verify:screen` betiği eklendi | Elle önbellek temizliği gerekmiyor |

Ana Sayfa tasarımı, renkler, yerleşim ve responsive yapı **değiştirilmedi** —
başlık zaten metin olarak çiziliyordu, sadece metnin kaynağı değişti. Bülten,
Radar, analiz motorları, arşiv, snapshot, karneler ve kupon sistemi
**hiç açılmadı**. Depolama anahtarları (`sportoto.token`, `sportoto.prefs`,
`sportoto.couponCenter.v1`, `sportoto.analysisProfiles.v2`,
`sportoto.analysisProfile.v1`) **aynen korundu**.

Marka metni hiçbir yerde görsele veya SVG'ye gömülü değil — Ana Sayfa başlığı
ve splash ekranı metin olarak çiziliyor, `AnimatedLogo` bileşeni ise yalnız üç
animasyonlu çubuktan oluşuyor, içinde hiç yazı yok. Bu yüzden görsel değiştirme
gerekmedi ve tasarım aynı kaldı.

---

## 4. Çalışan ekranda nasıl doğrulandı

Kaynak kodu değil, **gerçek çıktı** ölçüldü:

1. `npx expo export --platform web` ile uygulama derlendi.
2. Derlenen çıktı yerel bir sunucuyla servis edildi (`Cache-Control: no-store` —
   eski paket servis edilemesin).
3. Ortamda hazır bulunan Chromium **gerçek tarayıcı olarak** açıldı, uygulamanın
   açılış animasyonu ve veri yüklemesi bitene kadar beklendi, sonra çalışan
   sayfanın DOM'u ve ekran görüntüsü alındı.

**Ölçüm sonucu:**

```
Sekme başlığı  : "Sportoto Master Analiz"
Ekran ilk metin: "… Sportoto Master Analiz ⌕ ⚽ — Bu Haftanın Bülteni …"
```

Ekran görüntüsü: `app/brand-screen.png` — sol üstte **Sportoto** (koyu) +
**Master Analiz** (vurgu rengi), alt sekmeler Türkçe (Ana Sayfa, Bülten, Radar,
Kuponlarım, Profil).

**Kontrol deneyi (kök nedenin kanıtı):** `documentTitle` satırı geçici olarak
kaldırılıp uygulama yeniden derlendi. Aynı ölçüm şu sonucu verdi:

```
Sekme başlığı  : "Home"      ← senin bildirdiğin belirtinin birebir aynısı
```

Satır geri konunca sekme yeniden `Sportoto Master Analiz` oldu. Yani kök neden
tahmin değil, **deneyle doğrulandı**.

Bu ölçüm artık tek komutla tekrarlanabilir:

```
cd app && npm run verify:screen
```

Çalışan geliştirme sunucusunu ölçmek için:

```
cd app && npm run verify:screen -- --url http://localhost:8081
```

---

## 5. Marka testi nasıl güçlendirildi

Yeni dosya: `app/test/brand-surfaces.test.mjs` (8 test). Artık düz metin
araması yapmıyor; kaynağı önce **düzleştiriyor** (yorumları ve JSX etiketlerini
boşluğa çeviriyor), sonra arıyor. Böylece parçalı metin de yakalanıyor.

| Test | Neyi korur |
|---|---|
| Marka kaynağı bütünlüğü | `BRAND_LINE_1 + " " + BRAND_LINE_2 === APP_NAME`; satırların elle yazılmadığını da denetler |
| **Dedektörün kendi kendini sınaması** | Cihazdaki hatalı satırın birebir kopyasını dedektöre verir: düz aramanın **bulamadığını**, düzleştirilmiş aramanın **bulduğunu** kanıtlar. Dedektör bir gün işlevsizleşirse bu test önce kırılır |
| Parçalı JSX taraması | `src/` + `App.js` + `app.json` — 113 dosyada eski marka adı yok |
| Ana Sayfa başlığı | Başlık `BRAND_LINE_1`/`BRAND_LINE_2` kullanmalı; içinde `<Image>` veya `<Svg>` **olmamalı** (marka görsele gömülürse metin taraması bir daha göremez) |
| Tarayıcı sekmesi | `documentTitle` var mı, `APP_NAME`'den mi besleniyor, biçimlendirici **parametresiz** mi (route bilgisi alırsa ad sızabilir) |
| Route/sekme adı sızıntısı | Kullanıcıya görünen hiçbir başlık `Home`, `AnalizTab` gibi teknik adlarla aynı olamaz |
| Görsel/SVG denetimi | Varlık dosyalarında ve `react-native-svg` bileşenlerinde eski marka metni aranır |
| Derlenmiş web paketi | `dist/index.html` başlığı ve JS paketi denetlenir (derleme yoksa atlanır) |

**Yasak olan, izinli olan.** Test tek başına "Spor Toto" ifadesini yasaklamıyor;
resmî bültene ve resmî sonuca yapılan dürüst atıflar korunuyor ("yalnız resmî
Spor Toto 90 dk sonucu kesindir"). Yasaklanan, bu ifadenin **uygulama adı gibi**
kullanılması: `Spor Toto Analiz`, `Spor Toto Master Analiz`, `Sportoto Analiz`.

**Testin gerçekten koruduğu doğrulandı.** İki hata da geçici olarak geri
konuldu ve testler çalıştırıldı:

```
not ok 3 - parçalı JSX dahil: hiçbir kullanıcı yüzeyinde eski marka adı yok
not ok 4 - Ana Sayfa başlığı merkezî kaynaktan gelir, sabit metin veya görsel değildir
not ok 5 - tarayıcı sekmesi: NavigationContainer başlığı merkezî kaynaktan yazar
# pass 5 · fail 3
```

Hatalar geri alınınca: `pass 8 · fail 0`. Yani bu iki görünüm geri gelirse test
**başarısız olur**.

---

## 6. Diske yazma — ikinci boşluk da kapatıldı

Asıl sorun bir kod hatası kadar bir **teslim** hatasıydı: düzeltme bulutta
vardı, sende yoktu. Bu yüzden bu kez tek tek dosya değil, **bütün kaynak ağacı**
karşılaştırıldı ve eşitlendi.

| | |
|---|---|
| Karşılaştırılan dosya | **283** |
| Zaten aynı | 253 |
| Eski (üzerine yazıldı) | **25** |
| Hiç yoktu (eklendi) | **5** — `apiBase.js`, `labels.js`, `verify-brand-screen.mjs`, `brand-surfaces.test.mjs`, `release-config.test.mjs` |
| Yazma sonrası sha256 doğrulaması | ✅ **283 / 283 birebir aynı** |

Eksik olan iki dosya sessiz ama önemliydi: `apiBase.js` yayın güvenlik
denetimini (localhost/HTTP engeli), `labels.js` ise "Güçlü Aday" /
"Tahminimi Kilitle" dilini taşıyor.

Veri klasörleri (`backend/data`, `backend/cache`, `backend/public`,
`legacy_archive`, `.env`, `node_modules`) eşitlemeye **dahil edilmedi** —
bülten arşivi, mühürlü analizler, resmî sonuçlar, Radar ve Sistem Karnesi
verilerine dokunulmadı.

---

## 7. Önbellek: bir daha elle temizlik yok

`app/package.json` başlatma komutları artık önbelleği kendisi temizliyor:

```
npm start        → expo start --clear
npm run web      → expo start --web --clear
```

Hızlı açılış isteyen için `npm run start:cache` ve `npm run web:cache`
seçenekleri duruyor. Ayrıca doğrulama betiğinin sunucusu `Cache-Control:
no-store` gönderiyor, yani ölçüm hiçbir zaman eski paketi okumuyor.

---

## 8. Test ve derleme sonuçları

| | Sonuç |
|---|---|
| Uygulama testleri (bulut) | ✅ **74 / 74** (önceki 66 + 8 yeni marka testi) |
| Backend testleri | ✅ **302 / 302** |
| Uygulama testleri (**senin diskinde**) | ✅ **73 pass / 0 fail** (1 test derleme çıktısı olmadığı için atlandı) |
| Web derlemesi | ✅ başarılı (`dist`, 2.2 MB paket) |
| Çalışan ekran — sekme | ✅ `Sportoto Master Analiz` |
| Çalışan ekran — Ana Sayfa sol üst | ✅ `Sportoto Master Analiz` |
| Kontrol deneyi | ✅ düzeltme kaldırılınca sekme "Home" oldu |

---

## 9. Değişmeyen kararlar

Bu çalışmada karar gerektiren hiçbir konuya el atılmadı. `04-RISK-RAPORU.md`
içindeki üç karar hâlâ seni bekliyor: uygulama adı hakkındaki karar (§1),
"Kupon" dili hakkındaki karar (§2), yorum bildirme + kullanıcı engelleme
özelliğinin yapılıp yapılmayacağı (§6). Uygulama adı **senin onayın olmadan
değiştirilmedi**.
