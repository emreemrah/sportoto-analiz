# DENETİM RAPORU — 16 Ağustos 2026

Kullanıcı 2-3 saatliğine ayrıldı ve dönene ("geldim") kadar sürekli, tekrarlayan
ve kapsamlı denetim istedi. Her tur aşağıya tarih/saat damgasıyla ve KANITLA
(ölçüm · uç yanıtı · ekran görüntüsü adı) yazılır.

Her turda bakılanlar:
1. `flutter analyze lib test` + `flutter test`
2. `backend npm test`
3. Yerel backend `/api/health` + kritik uçlar
4. Üretim (sportoto-analiz.onrender.com): health · bülten · radar uçları ·
   marka sızıntısı taraması
5. Emülatörde ekran gezintisi (Ana Sayfa · Bülten · Radar · Kuponlarım · Profil)
   ve görsel kusur incelemesi
6. Veri dürüstlüğü: armasız takım · bayraksız maç · uydurma sayı · iddialı dil

---

## TUR 1 — 16 Ağu, ~13:15

### Otomatik denetimler
| Kontrol | Sonuç |
|---|---|
| `flutter analyze lib test` | temiz |
| `flutter test` | **762 geçti**, 0 hata |
| `backend npm test` | **1083 geçti**, 0 hata |

### Yerel backend
- `/api/health` → 200 · `durum: saglikli` · `ok: true`
- `/api/bulletin` → 200 · 2. Hafta · 15 maç · **armasız taraf 0**
- Marka sızıntısı taraması (4 radar ucu) → **hepsi temiz**

### ✅ BULGU 1 — ÇÖZÜLDÜ (soğuk açılış, arıza değil)
90 sn sonra yeniden bakıldı: `durum: saglikli` · `/api/bulletin` → 200 · 15 maç.
Yani aşağıdaki gözlem Render ücretsiz planın bilinen uyanma penceresiydi.

#### (özgün gözlem)
`https://sportoto-analiz.onrender.com`
- `/api/health` → 200 ama **`durum: veri-yok`**
- `/api/bulletin` → **503**

Bir saat önce aynı adres `durum: saglikli` ve 15 maç dönüyordu. Render ücretsiz
planda servis uykuya dalıp uyandığında açılış yenilemesi bitene kadar bu durum
BEKLENİR (kayıtlı bilgi: uyanma sonrası ~72 sn boyunca 503). 90 sn sonra
yeniden bakılacak; kalıcıysa gerçek arıza olarak yükseltilecek.

**Kullanıcı etkisi:** bu pencerede uygulama üretim verisiyle açılırsa bülten
gelmez. Uygulama yerelde (10.0.2.2:4000) çalıştığı için emülatör etkilenmez.

### 🟡 BULGU 2 — Bültende ülkesi çıkmayan 1 maç
`/api/bulletin` → 10. maç `league: "Final"` (Dortmund–Bayern). Lig adından ülke
çıkmıyor; istemci kulüp armasının ülke ön ekinden ALMANYA türetiyor (bugün
eklenen yedek yol). Yani ekranda bayraksız kalmıyor — kayıt bilgi amaçlı.

### Not — commit'lenmemiş iş
Anlamsal rozet okunurluğu düzeltmesi (`on*Soft` token'ları) çalışma ağacında
duruyor, henüz commit edilmedi. Testleri geçiyor.

### 🔴 BULGU 3 — Durum göstergesi noktaları bazı temalarda GÖRÜNMÜYOR (ciddi)

`lib/widgets/score_legend.dart` — "🟢 Resmi sonuç · 🟡 Henüz resmi değil ·
🔴 Canlı" şeridi. Nokta 8×8 daire ve **ham anlamsal renkle** doğrudan SAYFA
ZEMİNİ üstüne çiziliyor. Yazı `onBackgroundMuted` ile uyarlanıyor ama NOKTA
uyarlanmıyor.

Ölçüm (kontrast oranı · grafik nesneler için WCAG eşiği **3:1**):

| Tema | zemin | 🟢 success | 🟡 warning | 🔴 canlı |
|---|---|---|---|---|
| Açık | `#F3F5F9` | 3.02 | **1.97** | 4.34 |
| Koyu | `#12161D` | 5.50 | 8.44 | 3.82 |
| **Galatasaray** | `#FDB912` | **1.90** | **1.24** | **2.74** |
| Fenerbahçe | `#00417F` | 3.09 | 4.74 | **2.15** |
| Beşiktaş | `#000000` | 6.37 | 9.78 | 4.43 |
| **Trabzonspor** | `#902F2F` | **2.42** | 3.71 | **1.68** |

Kart üstünde de aynı sorun var (aynı ham renkler skor/rozet yazısı olarak
kullanılıyor):

| Tema | kart | 🟢 | 🟡 | 🔴 |
|---|---|---|---|---|
| **Trabzonspor** | `#4FBFF0` | **1.58** | **1.03** | **2.27** |
| Fenerbahçe | `#FFED00` | 2.73 | **1.78** | 3.92 |
| Galatasaray | `#A90432` | 2.32 | 3.56 | **1.61** |
| Açık | `#FFFFFF` | 3.30 | **2.15** | 4.74 |

**Neden ciddi:** bu şerit, dosyanın kendi başlığında yazdığı gibi *"yalnız
resmi sonuç kesindir" kuralının GÖRSEL anahtarı*. Galatasaray temasında sarı
nokta sarı zeminde 1.24 — pratikte görünmez; kullanıcı "resmî" ile "henüz
resmî değil"i ayırt edemez. Bu kozmetik değil, VERİ DÜRÜSTLÜĞÜ sorunu
(CLAUDE.md: "renk: 🟢 resmî · 🟡 henüz resmî değil · 🔴 canlı").

**Önerilen düzeltme (hazır, uygulanmadı):** bugün rozetler için yapılanın
aynısı — `kimlikTonu(anlamsal, yüzey)` ile hue KORUNARAK ton itilir. Bu kez
yüzey `background` ve `card`. Yeni token'lar: `onBackgroundSuccess/Warning/
Live` ve kart karşılıkları. Yeşil yeşil, sarı sarı kalır; yalnız görünür olur.

**Neden kendiliğimden uygulamadım:** bu değişiklik belgelenmiş durum rengi
dilini ve tüm ekranlardaki anlamsal renk kullanımını etkiliyor; kullanıcı bu
konuda ayrıntılı kararlar vermiş durumda. Onayıyla hemen uygulanabilir.

### Ekran gezintisi (Galatasaray takım teması)
- **Ana Sayfa** (`t1_1.png`) — hero, ülke şeridi, Yaklaşan Maçlar, Öne Çıkan
  Analizler: hepsi temaya oturmuş, bayraklar ve armalar tam.
- **Bülten** (`t1_2.png`) — "✓ Resmi bülten teyit edildi" rozeti artık okunur
  koyu yeşil (bugünkü `onSuccessSoft` düzeltmesi canlı). 15 maç, armalar tam.
- **Kuponlarım** (`t1_4.png`) — boş durum temiz ve temaya uygun.
- Görsel kusur: aşağıdaki BULGU 4.

### 🟡 BULGU 4 — Takım temasında hafta rozeti "kirli kahverengi" görünüyor
Ana Sayfa · Yaklaşan Maçlar'daki "1. Hafta" rozeti Galatasaray temasında
koyu zeytin/kahverengi bir tona düşüyor (`warningSoft` = uyarı hue'su +
kartın parlaklık ailesi). Kontrast yeterli, kural ihlali yok — ama görsel
olarak çamurlu duruyor. Karar kullanıcıya ait: ya böyle kalır (tema içinde
kalma önceliği) ya da rozetler tema dışı sabit tonlara alınır.

---

## TUR 2 — 16 Ağu, ~14:35

### Otomatik denetimler
| Kontrol | Sonuç |
|---|---|
| `flutter analyze lib test` | temiz |
| `flutter test` | **762 geçti**, 0 hata |
| `backend npm test` | **1083 geçti**, 0 hata |
| Yerel backend | `saglikli` · 15 maç · armasız 0 |
| Marka sızıntısı (7 uç, yerel + üretim) | **yok** |

### 🟡 BULGU 5 — Üretim her boşta kalışta ~1 dakika 503 veriyor (ölçüldü)
Tur 1'de 503 görülmüş, 90 sn sonra toparlamıştı. Tur 2'de (25 dk sonra) **yine**
`durum: veri-yok` · `/api/bulletin` → 503. Toparlanma bu kez ölçüldü:
**61 saniye** (`updatedAt: 2026-08-16T11:35:35Z`).

Yani Render ücretsiz planda servis trafik olmayınca uyuyor ve her uyanışta
~60-90 sn boyunca bülten uçları 503 dönüyor. Bu bilinen/kayıtlı davranış ama
artık iki ölçümle sabit: **gerçek bir kullanıcı uygulamayı bir süre sonra
açtığında ilk dakika veri göremez.**

Seçenekler (karar kullanıcıya ait): (a) ücretli plana geçmek, (b) dışarıdan
periyodik ping ile uyanık tutmak, (c) uygulamada "sunucu uyanıyor, ~1 dk"
diye açık bir bekleme durumu göstermek — şu an genel hata metni çıkıyor.

### 🟡 BULGU 6 — Güvenlik Ayarları'nda tek alan farklı görünüyor
`lib/features/profile/security_settings_screen.dart:245`
Ekran görüntüsü: `t2_macdetay.png` (dosya adı yanıltıcı — gezinti oraya düştü)

"Yeni e-posta" alanı ekrandaki TEK dolgulu giriş kutusu:
`filled: true, fillColor: AppColors.cardAlt`. Aynı ekrandaki "Mevcut şifre" ve
"Yeni şifre" alanları dolgusuz (yalnız kenarlık). Takım temasında `cardAlt`
parlak kırmızıya döndüğü için fark iyice göze batıyor: üç kutudan biri farklı
bir bileşenmiş gibi duruyor.

Düzeltme küçük: ya dolguyu kaldırmak ya da diğer iki alana da aynı dolguyu
vermek. Hangisi olduğu tasarım tercihi — bu yüzden uygulamadım.

### 🟡 BULGU 7 — "VERİ YOK" rozeti zeminde soluk kalıyor (BULGU 3 ailesi)
Maç detayı · Özet (`t2_b.png`, Erzurumspor–Galatasaray). "VERİ YOK" çipi KART
DIŞINDA, doğrudan sayfa zemininde duruyor ve rengi `AppColors.gray`
(`match_detail_text.dart:119` → `kPredMetaBos`). `gray` takım temasında
KART metninden türetiliyor (`takim_gorunumu.dart` → `kartSoluk`), ama bu çip
zeminde. Galatasaray sarısı üstünde soluk gri okunması zor.

Bu, BULGU 3 ile AYNI SINIF: anlamsal/soluk renk, bulunduğu yüzeye göre
türetilmiyor. Aynı düzeltme (yüzey bazlı `kimlikTonu`) ikisini birden çözer;
zeminde duran öğeler `onBackground*` ailesini kullanmalı.

### Maç detayı incelemesi — kusur yok
Erzurumspor–Galatasaray: armalar, lig, tarih, hava (19°C), stadyum tam.
"Bu maç için yeterli veri yok (oran da, form da yok)" dürüst; skor yerine "-"
basılmış (uydurma yok). Kupona İşle, Maç Sonucu Anketi düzgün çiziliyor.
Sekmeler: Özet · Analiz · İstatistik · Oynanma Yüzdeleri · Oran(lar).

---

## TUR 3 — 16 Ağu, ~14:55 · BULGU 3 ve 7 DÜZELTİLDİ (kullanıcı onayıyla)

### Kök neden (ikisi de aynı)
Renkler bulundukları YÜZEYE göre türetilmiyordu:
- Gösterge noktaları ham `success/warning/live` ile doğrudan ZEMİNE çiziliyordu.
- `SurpriseBadge`in dolgusu %13 saydam — yani fiilen ZEMİN üstünde — ama
  yazı/kenarlık rengi KART türevi (`AppColors.gray`) idi.

### Çözüm — token çoğaltmak değil, yüzeyi çağırana sordurmak
`AppColors.anlamsalTon(renk, yüzey)` eklendi: `kimlikTonu` ile hue ve doygunluk
KORUNARAK ton okunana dek itilir. Aynı rozet iki farklı yüzeyde çizilebildiği
için (maç detayında zemin, radar kartında kart) sabit token doğru cevap
veremezdi; `SurpriseBadge` artık `zeminde` parametresi alıyor.

Değişenler:
- `core/theme/tokens.dart` → `anlamsalTon` yardımcısı
- `widgets/score_legend.dart` → noktalar zemine göre tonlanıyor
- `widgets/tabs.dart` → `SurpriseBadge.zeminde`
- `features/match_detail/match_detail_screen.dart` → `zeminde: true`

### Doğrulama
- `test/durum_gostergesi_gorunurlugu_test.dart` (5 test): kusur kaydı ·
  zeminde 3:1 · kartta 3:1 · **kimlik korunur (hue sapması < 1°)** · aynı ham
  rengin zemin/kart için FARKLI ton üretmesi. 6 tema süpürülüyor
  (açık · koyu · GS · FB · BJK · TS).
- `flutter analyze lib test` temiz · **767 test** geçti.
- Emülatörde gözle: `t3_b.png` — Galatasaray temasında "● Resmi sonuç ·
  ● Henüz resmi değil · ● Canlı" üç nokta da sarı zeminde ayırt ediliyor;
  önceki turun `t1_2.png` karesinde sarı nokta görünmüyordu.

### Bu turun diğer denetimleri
| Kontrol | Sonuç |
|---|---|
| `flutter analyze lib test` | temiz |
| `flutter test` | **767 geçti** (5 yeni) |
| Yerel backend | `saglikli` · 15 maç · armasız 0 |

**Kalan açık bulgular:** 4 (hafta rozeti tonu — zevk kararı), 5 (üretim
uyanma gecikmesi — plan kararı), 6 (Güvenlik Ayarları'nda tek dolgulu alan —
tasarım tercihi). Üçü de kullanıcı kararı beklediği için uygulanmadı.

---

## TUR 3b — BULGU 6 DÜZELTİLDİ (kullanıcı onayıyla)

### Ölçüm önce yapıldı — aykırı olan sandığım alan değilmiş
İlk teşhiste "e-posta alanı dolgulu, şifre alanları dolgusuz" demiştim. Kaynağa
bakınca **ikisi de dolguluydu**; fark dolgu RENGİNDEYDİ:

| Yer | Dolgu | Durum |
|---|---|---|
| `auth_screens.dart` `girdiSusu` (giriş + tüm `PasswordField`ler) | `AppColors.card` | kalıp |
| `coupon_editor_screen.dart` | `AppColors.card` | kalıp |
| `team_picker_screen.dart` | `AppColors.card` | kalıp |
| `security_settings_screen.dart` (e-posta) | **`cardAlt`** | aykırı |
| `premium_code_screen.dart` | **`surfaceSoft`** | aykırı |

Takım temasında `cardAlt` parlak kırmızıya döndüğü için o tek kutu başka bir
bileşen gibi duruyordu. (`surfaceSoft` ile `cardAlt` takım temasında AYNI
değere düşüyor — yani iki aykırı, tek sınıf.)

### Düzeltme
- `girdiSusu` ortak yardımcısı dışa açıldı (`_girdiSusu` → `girdiSusu`).
- Güvenlik Ayarları'ndaki e-posta alanının KOPYA `InputDecoration`ı silindi;
  artık üç girdi de tek tanımdan besleniyor.
- `premium_code` yalnız dolgu rengi kalıba çekildi (sayaç gizleme ve dar
  yarıçap gibi kendi gereksinimleri korundu).

### Sınıf koruması
`test/gorsel_kurallar_test.dart` → yeni kural: `lib/` genelinde `fillColor:`
yalnız `AppColors.card` olabilir. Yeni bir ekran üçüncü bir girdi görünümü
getiremez.

`flutter analyze lib test` temiz · **768 test** geçti.

---

## TUR 4 — 16 Ağu, ~15:10 · BULGU 4 DÜZELTİLDİ (kullanıcı onayıyla)

### Ölçüm, bildirilenden DAHA CİDDİ bir sorun gösterdi
Kullanıcı "çamurlu görünüyor" demişti. Galatasaray temasında ölçüldü:

| Değer | Renk | hue | doygunluk | parlaklık |
|---|---|---|---|---|
| `warning` (ham) | `#F59E0B` | 38 | %92 | %50 |
| `warningSoft` (geçen hafta) | `#56411C` | 38 | **%51** | **%22** |
| `primarySoft` (güncel hafta) | `#573E01` | **43** | %98 | %17 |

İki şey birden:
1. **Çamur:** `_anlamsalYuzey` doygunluğu %92→%51, parlaklığı %50→%22 çekiyor
   → amber kahverengiye düşüyor.
2. **DAHA ÖNEMLİSİ — ayrım kayboluyor:** geçen hafta `#56411C` (hue 38) ile
   güncel hafta `#573E01` (hue 43) neredeyse AYNI renk. Yani bu temada iki
   hafta rozeti birbirinden ayırt edilemiyordu; sabah eklenen hafta ayrımı
   Galatasaray'da çalışmıyordu.

### Düzeltme — ayrım renge değil BİÇİME bağlandı
- Güncel hafta: **DOLGULU** (`accent` zemin + `onAccent` yazı)
- Geçen hafta: **ÇERÇEVELİ** (dolgu yok, kenarlık + yazı `anlamsalTon(warning, kart)`)

Palet ne olursa olsun iki rozet ayırt edilir; dolgu kalkınca çamurlu blok da
ortadan kalkar. Renk yine bilgi taşır ama TEK taşıyıcı değildir — renk körlüğü
için de daha iyi.

### Doğrulama
- 3 yeni test (6 tema süpürülüyor): çerçeve kartta ≥3:1 · dolgu yazısı ≥4.5 ·
  **ayrımın tek taşıyıcısının renk olmadığı**.
- `flutter analyze lib test` temiz · **771 test** geçti.
- Emülatörde `t4_h2.png`: "1. Hafta" çerçeveli, "2. Hafta" dolgulu sarı —
  ikisi bir bakışta ayrılıyor, kahverengi blok yok.

**Kalan tek açık bulgu:** BULGU 5 (üretim uyanma gecikmesi ~61 sn) — altyapı
kararı olduğu için kullanıcıya bırakıldı.

---

## TUR 5 — 16 Ağu, ~15:30 · BULGU 5 için BEKLEME DURUMU eklendi (kullanıcı kararı)

Kullanıcı üç seçenekten "uygulamada bekleme durumu göster"i seçti.

### Durum ayırt edilebilir — tahmin gerekmedi
Backend bu pencerede kendi açıklamasıyla yanıtlıyor:
`503` + `{"error":"Veri henüz hazır değil, birkaç saniye sonra tekrar dene."}`
`ApiException` zaten `status` taşıdığı için istemci bunu 5xx arızalarından
ayırabiliyor.

### Eklenenler
- `widgets/states.dart` → `HazirlaniyorState` (hata değil, BEKLEME) +
  `sunucuHazirlaniyor(hata)` dedektörü.
- `bulletin_screen.dart` → 503'te kırmızı hata kartı yerine bekleme ekranı.
  Bu ekranda zaten 15 sn'lik otomatik yenileme var, o yüzden kullanıcıya
  "bir şey yapmana gerek yok" DENEBİLİYOR.
- `home_screen.dart` → aynı durum, ama orada zamanlayıcı YOK; bu yüzden
  otomatik yenileme SÖZ VERİLMİYOR (`otomatikYenileme: false`) — yalnız
  düğme ve aşağı çekme.

### Dürüstlük kuralları
- Yalnız **503** bekleme sayılır. 500/502/504/400/401/404 ve ağ hatası HÂLÂ
  hata olarak gösterilir — gerçek arıza gizlenmez (teste bağlandı).
- Süre "genelde bir dakika" diye verilir, söz verilmez.
- Veri varmış gibi gösterilmez; sayı uydurulmaz.

### Doğrulama — UÇTAN UCA, gerçek 503 ile
Yerel bülten önbelleği geçici olarak kenara alındı → uç gerçekten 503 döndü:
1. `t5_bekleme.png` (ESKİ derleme, karşılaştırma): kırmızı ünlem +
   "Güncel başlamamış haftalık program alınamadı" + ham hata metni.
2. `t5_b2.png` (YENİ derleme): ⚽ + **"Sunucu uyanıyor"** + "Bülten
   hazırlanıyor — genelde bir dakika sürer. Ekran kendiliğinden yenilenecek,
   bir şey yapmana gerek yok." + "Şimdi dene". Kırmızı hata dili YOK.
3. Önbellek geri konduktan **~18 sn** sonra `t5_toparlandi.png`: bülten
   kullanıcı hiçbir şeye dokunmadan geldi — yani mesajdaki söz doğru.
Önbellek geri yüklendi ve doğrulandı (200 · 2. Hafta · 15 maç); geçici
dosyalar silindi.

4 yeni test · `flutter analyze lib test` temiz · **775 test** geçti.

### 🟡 BULGU 8 — Kesinti sırasında takım teması varsayılana düşüyor (yeni)
503 penceresinde uygulama Galatasaray temasından **varsayılan açık temaya**
düştü (`t5_b2.png`) ve veri geldikten sonra da açık temada kaldı
(`t5_toparlandi.png`). Favori takım profil/sunucu verisinden okunduğu için
kesintide palet kurulamıyor; toparlanınca yeniden uygulanmıyor.

Kullanıcı etkisi: sunucu uyandıktan sonra tema elle düzeltilene (ya da
uygulama yeniden açılana) dek yanlış kalıyor. Bir sonraki turda kök nedeni
araştırılacak.

---

## 16 Ağustos 2026 — BULGU 8 kapandı (teşhis DÜZELTİLDİ)

### Yukarıdaki teşhis YANLIŞTI
"Kesintide palet kurulamıyor" dedim; ölçüm bunu çürüttü. Cihazdaki kayıt
okundu — `gorunumModu` diskte **`sistem`** idi. Yani uygulama o an zaten takım
temasında DEĞİLDİ; düşen bir tema yoktu. Ekran görüntüsü doğruydu, sebebi
yanlış okumuştum.

### Gerçek kök neden: tercih kaybı (daha ağır bir hata)
"Seçtiğim tema nasıl `sistem` olur?" sorusunun izi asıl kusura çıktı.

`flutter/lib/core/prefs.dart` — bütün tercihler **TEK JSON blob'unda**
(`sportoto.prefs`) tutuluyor ve `setPref` blob'un **tamamını** yazıyor.
Açılışta disk henüz yüklenmemişken `_cache` yalnız VARSAYILANLARDIR. O
pencerede herhangi bir ekran bir tercih yazarsa (liste sıralaması, kupon
ayarı, filtre hatırlama…) diskteki **kayıtlı tercihlerin hepsi** varsayılanlarla
eziliyordu. Yükleme yönü zaten korunuyordu (`_degistirilenler` — geç gelen disk
taze seçimi ezmiyor); eksik olan **yazma yönüydü**.

### Kanıt (mutasyon testi çıktısı)
Koruma kaldırılınca diske yazılan blob:
`{"liveStatView":"table",…,"gorunumModu":"sistem"}` — kullanıcının
`"gorunumModu":"takim"` ve `"histSort":"resolvedTop"` kayıtları YOK. Bildirilen
belirtinin birebir aynısı.

### Düzeltme
- `setPref`: `if (!_diskYuklendi) return;` — değişiklik bellekte ve
  `_degistirilenler`de durur, diske yazılmaz. Yazma `_diskeYaz()`'a ayrıldı.
- `prefsYukle` `finally`: bekleyen değişiklik varsa, diskle **birleşmiş** blob
  yazılır. Böylece ne kayıtlı tercih ezilir ne de erken seçim kaybolur.

### Ders — test önce yük taşımıyordu
İlk yazdığım test yeşil geçiyordu ama mutasyonda da yeşil kaldı: erken yazma
"ateşle-unut" olduğu için yükleme sonrası doğru yazma ezilmiş kaydı
düzeltiyor ve hatayı gizliyordu. Test **kritik ana** (yazmadan sonra, yükleme
öncesi diski okumak) taşındı; ancak o zaman mutasyonu yakaladı.

`tercih_kaybi_test.dart` (2 test) · `flutter analyze lib test` temiz ·
**777 test** geçti.

---

## 16 Ağustos 2026, 13:0x — 9. tur denetimi

Koşulan: `flutter analyze lib test` temiz · **783 Flutter testi** · backend
**1089 test** (hem TSİ hem `TZ=UTC` altında) · üretim uçları · emülatörde
Ana Sayfa / Bülten / Radar taraması (`t9_*.png`).

### 🔴 BULGU 9 — ÜRETİMDE BÜTÜN MAÇ ANLARI 3 SAAT İLERİ (en ağır bulgu · DÜZELTİLDİ)

**Belirti (ekran):** aynı maç bültende **21:30**, radarda **18:30**
(`t9_a.png` / `t9_d_radar.png`).

**Ölçüm:**

| kaynak | `kickoffAt` |
|---|---|
| yerel backend (geliştirme, TSİ) | `2026-08-21T18:30:00.000Z` ✅ |
| **üretim** (Render, UTC) | `2026-08-21T21:30:00.000Z` ❌ |

**Kök neden:** resmî bülten saati saat dilimi EKSİZ gelir
(`"2026-08-21T21:30:00"` = Türkiye duvar saati). Ham `new Date(...)` bunu
SUNUCUNUN yerel diliminde yorumlar:

```
TZ=Europe/Istanbul → 2026-08-21T18:30:00.000Z   (doğru)
TZ=UTC             → 2026-08-21T21:30:00.000Z   (3 saat ileri)
```

Geliştirme makinesi TSİ olduğu için hata **hiç görünmüyordu**; üretim UTC.

**Neden ağır (kodda tek tek doğrulandı):**

1. `src/security/tahminKapisi.js` — kapı `now >= kickoff − KILIT_ONCESI_MS`
   ile kapanıyor. Kickoff 3 saat ileri olduğu için üretimde kapı **3 saat
   fazladan AÇIK** kalıyordu: maç başladıktan sonra bile tahmin kabul
   edilebilirdi. Projenin "başlamış maça tahmin üretilmez" kuralının ihlali.
2. `src/server.js:620` — `started` bayrağı canlı skorun maça iliştirilmesini
   yönetiyor. Kickoff ileri kaydığı için üretimde canlı skor maçın ilk **3
   saati boyunca hiç bağlanmıyordu**.
3. `/api/radar/current` → `kickoffAt` doğrudan 3 saat ileri (ölçüldü).

**Aşırı yorumlanmasın — ölçülen sınır:** üretimdeki `archive.freezeAt`
`2026-08-21T18:25:00+00:00` yani **DOĞRU** (21:25 TSİ). Mühür zamanlaması bu
hatadan etkilenmiş DEĞİL; kayıt saklanan değerden geliyor. Mühürlü geçmiş
haftalar da değiştirilemez olduğu için oldukları gibi kalır.

**Düzeltme:** `backend/src/time/turkiyeSaati.js` — TEK TANIM. Saat dilimi ekli
değerler olduğu gibi; eksiz olanlar Türkiye duvar saati (+03:00). 10 çağrı yeri
+ `snapshotService.iso()` buna bağlandı. Üç yerde ayrı ayrı yazılmış
`TR_OFFSET_MS` de tek tanıma indirildi.

**Kanıt (gerçek önbellek, `TZ=UTC`):**
```
1 Erzurumspor FK  ham: 2026-08-21T21:30:00 | YENİ: 18:30Z ✅ | ESKİ: 21:30Z ❌
2 Çaykur Rizespor ham: 2026-08-22T19:00:00 | YENİ: 16:00Z ✅ | ESKİ: 19:00Z ❌
```
Yerel (TSİ) uç değişmedi: `18:30:00.000Z` — regresyon yok.

**Koruma:** `backend/test/turkiye-saati.test.mjs` (6 test) süreci **UTC,
Europe/Istanbul, America/New_York, Asia/Tokyo** altında ayrı ayrı koşturur;
ayrıca ham `new Date()`'in hâlâ saat dilimine bağlı olduğunu doğrulayarak
korumanın gerçekten gerekli olduğunu kanıtlar. Tam takım `TZ=UTC` ile de
koşuldu: 1089/1089.

> ⚠ **Üretim hâlâ eski kodu çalıştırıyor.** Düzeltme yalnız depodadır; deploy
> istenmedi ve yapılmadı.

### 🟡 BULGU 10 — "Öne Çıkan 0" yazan sayacın altında "Öne Çıkan Analizler" başlıklı 2 kart (AÇIK)
`t9_c_ana.png`: üst sayaç **Öne Çıkan 0**, hemen altında **"Öne Çıkan
Analizler"** başlığı ve iki kart.

Kaynak: `home_screen.dart:420` sayacı eşikle sayıyor
(`puan >= _oneCikanEsik` = 45), ama bölüm `displayAnalysis =
siraliAnaliz.take(2)` (satır 136) — **eşiğe bakmadan** en yüksek 2 analizi
gösteriyor. Kartların kendi etiketi dürüst ("DENGELİ"); yanlış olan yalnız
BÖLÜM BAŞLIĞI.

Dosyanın 41-43. satırındaki yorum tam bu hataya karşı uyarıyor ("ekran yalan
söyler") — sayaç kuralına uyulmuş, başlık kuralın dışında kalmış.

**Öneri (uygulanmadı — ürün kararı):** eşiği aşan yoksa başlık "Analiz Edilen
Maçlar" olsun; kartlar kalsın. İçerik kaybolmaz, başlık doğru olur.

### 🟢 BULGU 11 — İLK TEŞHİS YANLIŞTI; gerçek kusur bunun TERSİYMİŞ (DÜZELTİLDİ)

**İlk (yanlış) teşhis:** "`t9_c_ana.png`'de ilk çip ekranın soluna yapışık ve
bayrağı kırpık; lig şeridine yatay boşluk eklenmeli." Bu gerekçeyle
`lig_seridi.dart`'a `horizontal: Spacing.md` eklendi.

**Ölçüm çürüttü:** `lib/widgets/kayan_serit.dart` — `KayanSerit` sabit bir
satır değil, KENDİ KENDİNE AKAN bir şerittir. İçeriğin **iki kopyasını** yan
yana koyar ve bir kopya genişliği kadar kayınca başa döner:

```dart
if (_offset >= _kopyaGenislik) _offset -= _kopyaGenislik;
```

Yani ilk çipin kesik görünmesi **kusur değil, hareketin bir anıdır** — üç
ekran görüntüsünde şerit üç farklı yerdeydi (`t9_c` / `t9_e` / `t9_g`).

**Dahası, eklediğim boşluk kusur ÜRETİYORDU.** `_kopyaGenislik` yalnız
kopyanın genişliğini ölçer; şeridin `padding`'i ölçünün DIŞINDADIR. Başa
dönüşte ekranın solunda, kopyanın son kısmı yerine boşluk gelir — yani her
döngüde boşluk kadar bir SIÇRAMA. Değişiklik geri alındı.

**Gerçek kusur:** aynı hata "Yaklaşan Maçlar" şeridinde ZATEN vardı —
`home_screen.dart` o `KayanSerit`'e `horizontal: Spacing.md` veriyordu.
Kaldırıldı.

**Koruma:** hiçbir `KayanSerit` çağrısının yatay boşluk almadığını tarayan
test. Mutasyonla doğrulandı: ilk yazdığım tarama sabit 400 karakterlik pencere
kullandığı için uzun yorum bloğunun ardındaki `padding`'i KAÇIRIYORDU ve
mutasyonda yeşil kalmıştı; tarama `children:` argümanına kadar gövdeyi okuyacak
şekilde düzeltilince mutasyonu yakaladı.

### 🟢 BULGU 12 — Geri sayım ham dakika basıyordu (DÜZELTİLDİ)
`t9_d_radar.png`: **"Mühürlenmeye 7538 dk kaldı."** Aynı an bültende
"kalan 5 gün 8 sa" yazıyor. `snapshot_seal_banner.dart` içindeki özel
`_remainingText` **tek tanım** olarak `kalanSureMetni` adıyla açıldı ve radar
onu kullanıyor; ikinci bir biçimlendirici YAZILMADI.

**Cihazda doğrulandı** (`t9_f_radar_duzeltilmis.png`): "🔒 Mühürlenmeye
**5 gün 5 sa** kaldı." — bültendeki "kalan 5 gün 5 sa" ile aynı ölçek.

**Koruma:** `flutter/test/kalan_sure_ve_serit_test.dart` (6 test) — biçim
doğrulaması + radarın ham "dk" basmadığı + biçimin tek tanımlı kaldığı +
hiçbir `KayanSerit`'in yatay boşluk almadığı taranıyor.

### Sağlıklı görülenler (bu turda)
- Armasız takım / bayraksız maç YOK (`t9_a.png`, `t9_c_ana.png`).
- Dürüstlük dili yerinde: "7 veri alanı eksik — detayda listeli",
  "geçmiş örneklem 6 maç (Yetersiz) — bant istatistiği karara katılmadı",
  "Favori '2' (%54) önde ama tartışmalı". İddialı dil yok.
- Marka sızıntısı yok.
- Tercih kalıcılığı (BULGU 8) cihazda doğrulandı: tema `takim`, kapat-aç
  sonrası hem diskte hem ekranda korundu; takip listesi (3 maç) da duruyor.

---

## 16 Ağustos 2026, ~13:15 — BULGU 10 kapandı (kapsam GENİŞLEDİ)

### Aynı hata İKİ yerdeydi
Rapora yalnız "Öne Çıkan" başlığını yazmıştım. Düzeltmeye başlayınca aynı
kusurun ikinci ve daha iddialı bir örneği çıktı:

| sayaç (hero) | hemen altındaki bölüm başlığı | gösterilen |
|---|---|---|
| Öne Çıkan **0** | "Öne Çıkan Analizler" | 2 kart |
| Sürpriz Adayı **0** | "**Sürpriz İhtimali Yüksek**" | 3 kart |

İkincisi daha ağır: "sürpriz ihtimali yüksek" maçlar hakkında bir İDDİADIR ve
o an eşiği (65) geçen tek maç yoktu. Yalnız birini düzeltmek ekranı yalan
söylemeye devam ettirirdi.

### Kök neden
Sayaçlar eşiğe bakıyordu (`_oneCikanEsik` 45, `_surprizEsik` 65); bölümler
eşiğe BAKMADAN en yüksek 2-3 maçı basıyordu (`displayAnalysis` /
`displaySurprise`). Kartların kendi etiketi ("DENGELİ") dürüsttü — yalan
söyleyen BAŞLIKTI. Üstelik dosyanın 40-43. satırındaki kendi kuralı tam bunu
yasaklıyor: eşikler tek kaynaktır, yoksa "ekran yalan söyler".

### Düzeltme — sayaç ve başlık AYNI hesaptan
`home_screen.dart`'a `_sayimYap()` eklendi (analizli / oneCikan / surpriz).
Hem hero sayaçları hem bölüm başlıkları artık bunu okuyor:

* **Analiz bölümü:** eşiği geçen varsa "Öne Çıkan Analizler"; yoksa ama analiz
  varsa "Analiz Edilen Maçlar"; hiç analiz yoksa "Bültenden Maçlar".
* **Sürpriz şeridi:** eşiği geçen varsa "Sürpriz İhtimali Yüksek"; yoksa
  "Sürpriz Puanına Göre Sıralı" (iddia değil, sıralama tarifi).
* **Hiç analiz yokken sürpriz şeridi maç DİZMEZ**, mevcut "Sürpriz analizi
  için veri bekleniyor." metnini yazar — puanı olmayan maçları sürpriz
  sıralaması gibi göstermek, olmayan veriyi varmış gibi göstermek olurdu.

Sürpriz puanının iki ayrı tanımı vardı (`HomeScreen._puan` + `_HeroCard`
içindeki yerel `puan`); tek dosya düzeyi tanıma indirildi.

### Kanıt
`t10_ana_baslik.png` — gerçek veriyle (2/15 analizli, eşiği geçen yok) başlık
artık **"Analiz Edilen Maçlar"**; sayaçtaki "Öne Çıkan 0" ile tutarlı.

**Koruma:** `flutter/test/bolum_basliklari_test.dart` (6 test) ekranı gerçekten
çizip altı durumu doğruluyor. Mutasyonla kanıtlandı: başlık sabitlenince iki
test düştü. `flutter analyze lib test` temiz · **789 test** geçti.

### Kayda geçsin — tema değişimi BENİM kör dokunuşumdu
Doğrulama sırasında uygulama koyu temada açıldı. Ölçüm: disk blob'u SAĞLAM
(18 anahtar, veri kaybı yok) ama `gorunumModu` açıkça `"koyu"` yazılmıştı.
Kodda bu anahtarı yazan TEK yer var: `gorunum_secim_screen.dart:51`
(kullanıcının görünüm ekranındaki seçimi) — otomatik yazan hiçbir yol yok.
Yani bunu, ekran gezinirken attığım kör `input tap`'lerden biri yapmış.
Uygulama hatası DEĞİL. `takim`'e geri alındı ve kapat-aç sonrası kalıcılığı
yeniden doğrulandı (`t10_tema_geri.png`).

---

## 16 Ağustos 2026, ~13:40 — DEPLOY SONRASI ÜRETİM KONTROLÜ

Saat dilimi düzeltmesi main'e merge edildi ve Render deploy'u indi.

### ✅ BULGU 9 üretimde DOĞRULANDI
`/api/radar/current` → `kickoffAt`:

| maç | deploy ÖNCESİ | deploy SONRASI | TSİ |
|---|---|---|---|
| Erzurumspor–Galatasaray | `21:30:00.000Z` ❌ | `18:30:00.000Z` ✅ | 21:30 |
| Ç.Rizespor–Samsunspor | `19:00:00.000Z` ❌ | `16:00:00.000Z` ✅ | 19:00 |

Üç saatlik kayma kalktı. Tahmin kapısı ve canlı skor bağlama artık gerçek maç
anını kullanıyor.

### Sağlıklı görülenler
- `/api/health` → 200 · `saglikli` · `hasData: true`
- `/api/bulletin` → 200 · 15 maç · teyit `confirmed` · **armasız 0** · tarihsiz 0
- 7 uç (rounds, radar/weeks, radar/current, daily-played, daily-odds,
  position-dna, surprise-radar) → hepsi **200**

### 🟡 BULGU 13 — API yanıtında marka adı geçiyor (arayüzde GÖRÜNMÜYOR)
`/api/radar/current` gövdesinde 29 yerde `"FootyStats (maç-öncesi istatistik)"`:
`matches[].radars.performance.sources[].name` ve `activeSignals[].source`.
Kaynak: `analysis/criterionCatalog.js:325`, `radar/performanceRadar.js:16`,
`archive/snapshotService.js:431`.

**Aşırı yorumlanmasın:** uygulama bu alanları EKRANA BASMIYOR — kaynak adlarını
kendi `_dataSourceLabels` eşlemesinden alıyor (`radar_center_cards.dart:71`),
payload'daki `name`/`source` hiç okunmuyor. Bahis sitesi adları için zaten
maskeleme var (`provider_labels.dart`: tanınmayan her değer "Kaynak" olur).
Yani CLAUDE.md'nin "arayüzde marka adı yok" kuralı ŞU AN ihlal edilmiyor.

**Risk:** yanıt herkese açık ve ileride bu alanı çizen bir ekran eklenirse
marka sessizce sızar — `provider_labels.dart`'ın kendi yorumunun anlattığı
başarısızlığın aynısı. Ayrıca mühürlü snapshot'lar bu metni içeriyor, o yüzden
değiştirmek geçmiş mühürlerle kıyası etkiler. **Karar kullanıcıya ait.**

### 🔴 BULGU 14 — GEÇMİŞ HAFTADA HİÇBİR TAKIMIN ARMASI YOK (DÜZELTİLDİ)

Ölçüm — aynı uç, aynı hafta (1. Hafta, roundId 1528):

| ortam | armasız taraf içeren maç |
|---|---|
| yerel | **0** / 15 |
| **üretim** | **15** / 15 (Galatasaray dahil) |

**Kök neden:** arma kayıt defteri (`crestRegistry.js`) `cache.js` üzerinden
DOSYA ÖNBELLEĞİNDE tutuluyor; Render'ın diski kalıcı değil ve her deploy
defteri siliyor. Güncel hafta açılış yenilemesinde armalarını yeniden topluyor
(bu yüzden `/api/bulletin` 0 eksik), GEÇMİŞ hafta toplamıyor — resmî Spor Toto
geçmiş bülteni arma vermez. Yani **her deploy geçmiş haftanın armalarını
siliyordu** ve bugünkü deploy bunu tazeledi.

**Düzeltme:** mühürlü arşiv snapshot'ı armaları ZATEN taşıyor
(`snapshotService.js` → `home.logo` / `away.logo`) ve arşiv veritabanında
durduğu için deploy'dan etkilenmiyor. Bugün eklenen lig-adı tamamlama zaten
aynı kaydı okuyordu; arma da AYNI okumaya eklendi (ikinci arşiv turu açılmadı).
Mantık `archive/gecmisTamamlama.js` içine SAF fonksiyon olarak çıkarıldı — uç
gövdesinde test edilemiyordu.

Kurallar korundu: arşive yazılmaz, yalnız okunur; uydurma yok (arşivde arma
yoksa alan boş kalır); sıra kayması korumalı (ev sahibi adı tutmuyorsa hiçbir
şey taşınmaz — yanlış maça yanlış arma yazmak armasız bırakmaktan kötüdür);
canlı yanıtta zaten olan arma EZİLMEZ.

**Koruma:** `test/gecmis-tamamlama.test.mjs` (7 test), mutasyonla doğrulandı.
Backend **1096 test** geçiyor (hem TSİ hem `TZ=UTC`).

> Düzeltme deploy EDİLMEDİ — üretimde geçmiş hafta hâlâ armasız.

---

## TUR 11 — 16 Ağu, ~13:55

| Kontrol | Sonuç |
|---|---|
| `flutter analyze lib test` | temiz |
| `flutter test` | **789** geçti |
| `backend npm test` | **1101** geçti (TSİ ve `TZ=UTC`) |
| Yerel uçlar (health/bulletin/radar) | 200 |
| Üretim 8 uç | hepsi **200** |

### 🔴 BULGU 15 — BÜLTEN YANITINDA BAHİS SİTESİ ADI (DÜZELTİLDİ)

Marka taraması üretimde yakaladı — **15 yerde** (her maçta bir):
`radarCenter.matches[].radars.publicBetting.details.providers[].providerId = "nesine"`

Karşılaştırma aynı alanı iki uçta ölçtü:

| uç | `providerId` |
|---|---|
| `/api/radar/current` | `k1` ✅ maskeli |
| `/api/bulletin` | `nesine` ❌ HAM |

**Kök neden:** `radarKaynaklariniKodla` RADAR ROTALARINDA uygulanıyor; bülten
`radarCenter`'ı taşıdığı hâlde o rotadan geçmiyor (`refresh.js:864` ham hâlini
bültene iliştiriyor). Yani maskeleme sınırı eksikti — fonksiyonun kendi
yorumunun söylediği "nötrleme yalnız HTTP sınırında" kuralı bir sınırda
uygulanmamış.

Marka adı yasal/mağaza kısıtı; yanıt herkese açık.

**Aşırı yorumlanmasın:** ARAYÜZDE görünmüyordu — `provider_labels.dart` ham
kimliği istemcide de koda çeviriyor ("nesine" → k1 → "Sarı kaynak"). Ama o
katman kendi yorumunda "ESKİ SUNUCU KORUMASI" diye tanımlanmış, yani yedek;
asıl sınır sunucu olmalı.

**Düzeltme:** AYNI fonksiyon bülten yanıt sınırında da uygulandı; ikinci bir
maskeleme tanımı YAZILMADI. İç hesap ve MÜHÜRLÜ snapshot ham kimliği
kullanmaya devam ediyor (benzer-DNA eşleşmesi ona bağlı, geçmiş mühürler
değiştirilemez).

**Kanıt (yerel, uçtan uca):** bülten yanıtında bahis-marka geçişi **0**,
`providerId: k1`, 15 maç yerinde.
**Koruma:** `test/bulten-marka-sizintisi.test.mjs` (5 test) — maskeleme,
`id`/`name` düşürme, tanınmayan kimlik → k0, bülten ucunun aynı fonksiyonu
çağırdığı ve ikinci tanım olmadığı.

### ⚠ Kayda geçsin — "Profil ekranı yarı kaymış" TEŞHİSİ YANLIŞTI
Profil'e dokununca ekranın %20'si solda açıkta kalıyor, alt menünün 5
öğesinden 4'ü kırpık görünüyordu (`t11_profil.png`, `t11_profil3.png`) ve iki
ölçümde de aynı kaldığı için "oturmuş kusur" sandım.

Kodda ölçtüm: `app.dart:495` → `endDrawer: const KullaniciPaneli()`. Gördüğüm
şey bir YAN PANEL (drawer) ve altındaki ekranı kısmen açıkta bırakması
tasarımın kendisi. Gerçek Profil sayfası tam genişlikte ve alt menüsü eksiksiz
(`t11_profil4.png`). **Kusur yok.**

### 🟡 BULGU 16 — Kuponlarım boş durumu kendi düğmesini anmıyor (küçük)
Boş durum: *"Maç detayındaki 'KUPONA İŞLE' bloğundan seçim yapıp Kupon Oluştur
ile kaydedebilirsin."* Ama hemen ÜSTÜNDE **"+ Yeni Kupon"** düğmesi var ve
doğrudan kupon editörünü açıyor
(`coupon_center_screen.dart:275` → `/kuponlarim/kupon-editor/...`).

Metin yanlış değil (o yol da çalışıyor) ama kullanıcıyı bir tık ötedeki kısa
yoldan haberdar etmiyor. Metin kararı kullanıcıya ait — değiştirmedim.

### Cihazda doğrulanan düzeltmeler
- **BULGU 7** — maç detayındaki "VERİ YOK" çipi artık zeminde okunur
  (`t11_macdetay.png`).
- **Tema** — "Takım teması · birinci renk" seçili ve uygulanmış
  (`t11_gorunum.png`).
- Maç saati 21:30 (doğru TSİ), armalar tam, "Bu maç için yeterli veri yok
  (oran da, form da yok)" dürüst dil.

### Açık kalan (yeni değil)
Bülten `date` alanı saat dilimi EKSİZ olduğu için istemcide cihaz-yerel
sayılıyor; radar ise gerçek anı çeviriyor. Türkiye'deki cihazda ikisi de 21:30
gösterir, GMT emülatöründe bülten 21:30 / radar 18:30 çıkar. Gerçek kullanıcı
kitlesi TSİ olduğu için görünür etkisi yok; kayıt için.

---

## TUR 13 — 16 Ağu, ~14:35

| Kontrol | Sonuç |
|---|---|
| `flutter analyze lib test` | temiz |
| `flutter test` | **796** geçti |
| `backend npm test` | **1107** geçti (`TZ=UTC` dahil) |
| Üretim 7 uç | 6× 200 · `/api/bulletin` **503** (bilinen soğuk açılış, BULGU 5) |

### 🟡 BULGU 17 — Haftalık Başarı'da iki yazı okunmuyordu (DÜZELTİLDİ)
`t13_haftalik_basari.png` (takım teması):

1. **"🏁 Bu Haftanın Kapanışı · Sen vs Sistem"** şeridi KOYU zeminde KOYU
   yazıyla çıkıyor, pratikte okunmuyordu. Kodda doğrulandı: şeridin yüzeyi
   `AppColors.darkCard`, yazısı `AppColors.onPrimary` — yani **başka bir yüzey
   için türetilmiş** renk.
2. **Sayfa başlığı "Haftalık Başarı"** sayfa zemininde `AppColors.text` (KART
   yazı rengi) kullanıyor ve sarı zeminde siliniyordu.

İkisi de bugün kapatılan **BULGU 3/7 ile aynı sınıf**: bir yüzey için türetilen
renk başka yüzeyde kullanılıyor. Düzeltme aynı ilkeyle: şerit yazısı
`okunurMetin(AppColors.darkCard)`, başlık `AppColors.onBackground`.

**Kanıt:** `t13_duzeltilmis.png` — başlık koyu bordo/sarı zeminde net, şerit
krem/bordo okunur.
**Koruma:** `flutter/test/haftalik_basari_okunurluk_test.dart` (3 test) —
dört takım temasında türetilen yazının WCAG 4.5:1 tutturduğu + kaynakta
`onPrimary`/`text` kullanılmadığı taranıyor. Testler yazıldığında ÖNCE düştü
(kusuru gösterdi), düzeltmeden sonra geçti.

### ⚠ Kendi gözlemimi düzeltiyorum — mavi dişli kusur DEĞİL
"Teknik bilgiler" satırındaki parlak mavi ⚙ için "tema dışı ikon" demiştim.
Kodda `Icon` değil, metnin içindeki EMOJİ: `'⚙ Teknik bilgiler'`. Rengini
uygulama belirlemiyor (sistem emoji fontu) ve uygulama başka yerlerde de emoji
kullanıyor (🏁 🔒 🔏 ⚽). Kusur saymıyorum.

### Marka taraması — iki kayıt
- `/api/history/1528` → "footystats" geçiyor ama **yalnız arma görsel
  adresinde** (`cdn.footystats.org/img/teams/...`). Kullanıcıya gösterilen
  metin değil; bulgu değil.
- `/api/analysis/criteria` → "FootyStats" **etiket metni** olarak geçiyor —
  bilinen **BULGU 13** (arayüzde görünmüyor, karar kullanıcıya ait).
- Bahis sitesi adı **hiçbir uçta yok** (BULGU 15 düzeltmesi üretimde tutuyor).

### 🟢 BULGU 18 — "Resmi sonuçlar kontrol ediliyor" yazısı 15 sn'de bir parlıyordu (DÜZELTİLDİ)
Kullanıcı bildirdi. `bulletin_screen.dart:80` geçmiş hafta için 15 sn'lik
otomatik kontrol kuruyor; döngü yalnız **15/15 sonuç + ikramiye** gelince
duruyor. 1. Haftada o an 6/15 sonuç vardı (kalan maçlar aynı gün 17:00–21:45),
yani koşul saatlerce sağlanmayacaktı.

Asıl kusur: arka plan yoklaması, kullanıcının BAŞLATTIĞI kontrolle aynı
`checking` bayrağını yakıyordu. `checkOfficial(..., sessiz: true)` eklendi —
veri yine tazeleniyor, gerçek değişiklik (yeni sonuç / düzeltme) yine
bildiriliyor, ama gösterge yanmıyor. Elle yenilemede gösterge KORUNDU.

**Koruma:** `flutter/test/sessiz_yoklama_test.dart` (4 test), mutasyonla
doğrulandı (sessiz çağrı geri alınınca tarama testi düşüyor).

### 🟢 BULGU 14 devamı — arşivi olmayan haftalar için ad eşleştirmesi (DÜZELTİLDİ)
Kullanıcı isteğiyle. Arşivde yalnız 6 bülten var; daha eski haftalarda mühür
olmadığı için arşiv tamamlaması hiçbir şey bulamıyordu.

`defterdenArmaTamamla` eklendi: BOŞ kalan arma yerleri arma kayıt defterinden
(`lookupCrest`) çözülür. Ölçüm — 48. Hafta (1520, arşivde YOK):

| | önce | sonra |
|---|---|---|
| armasız maç | 15/15 | **2/15** |
| defterden çözülen arma | 0 | **28** |

Kalan iki takım BİLEREK boş: "Malmö" defterde iki farklı kulüple eşleşiyor
(Malmö FF · IFK Malmö), "AIK Stockholm" güvenli eşleşme bulamıyor (AIK
Fotboll · Oskarshamns AIK). `lookupCrest` default-deny çalışıyor; gevşetmek
yanlış kulübün armasını basma riski açardı. Boş kalan yerde baş harf rozeti
çizilir.

Arşivden gelen arma defter tarafından EZİLMEZ — mutasyonla doğrulandı
(ezme koruması kaldırılınca test düşüyor). `test/gecmis-tamamlama.test.mjs`
13 test.

### 🟡 BULGU 19 — Hafta seçici ve SEÇİLİ sekme kartı görünmüyordu (kullanıcı bulgusu · DÜZELTİLDİ)

Kullanıcı bildirdi: "1. Hafta yazısının arka plan kartı yok, Özet'te de
görünmüyor" (`t13_duzeltilmis.png`).

**Kök neden (kodda doğrulandı):** ikisi de yüzeyi düz `AppColors.primary` ile
boyuyordu —
`user_dashboard_screen.dart` hafta seçici `Container` ve `_cip(secili: true)`.
Takım temasının **"birinci renk"** modunda SAYFA ZEMİNİ de primary'dir; yüzey
zeminle aynı renge düşünce kart görünmez oluyor. Yazı okunuyordu (onPrimary
zaten o renge göre türetiliyor), kaybolan yalnız YÜZEYDİ.

Bu, BULGU 3/7/17 ailesinin dördüncü örneği ama farklı yönü: orada YAZI yanlış
yüzeyden türetiliyordu, burada YÜZEY zeminden ayrışmıyor.

**Düzeltme:** bugün eklenen `ayrisanYuzey(primary, background)` kullanıldı —
hue korunur, yalnız zeminden ayrışacak kadar ton itilir. Yüzey TEK yerde
(`_haftaYuzeyi`) tanımlandı ki seçici ile sekme aynı tonu paylaşsın; yazı da
`okunurMetin(_haftaYuzeyi)` ile o yüzeyden türetildi.

**Kural DAR tutuldu:** `primary` bir KART üstünde yüzey olarak meşrudur (orada
zeminden farklıdır) ve yazı rengi olarak da kullanılır — ilk yazdığım tarama
bunları da yasaklıyordu ve üç meşru kullanımı yanlış işaretledi; tarama
yalnız ZEMİNDE duran iki yüzeyi denetleyecek şekilde daraltıldı.

**Kanıt:** `t14_yuzey.png` — hafta kartı ve seçili sekme sarı zeminden ayrışan
amber tonda, "1. Hafta" okunur.
**Koruma:** `haftalik_basari_okunurluk_test.dart`'a 2 test eklendi (dört takım
temasında yüzey/zemin ayrımı + yazı okunurluğu, ve iki yüzeyin ayrışan tonu
kullandığı). Mutasyonla doğrulandı: düz primary'ye dönünce test düşüyor.

**Aynı taramada bir kusur daha:** "Kupon yok — Doğru/Yanlış filtresi sistem
tahminine göredir." açıklaması sayfa zemininde `textMuted` (KART soluk tonu)
kullanıyordu ve sarıda siliniyordu → `onBackgroundMuted`.

`flutter analyze` temiz · **798 test** geçti.

## TUR 20 — 16 Ağu, ~15:25

| Kontrol | Sonuç |
|---|---|
| `flutter analyze lib test` | temiz |
| `flutter test` | **798** geçti |
| `backend npm test` | **1107** geçti |
| Üretim | health 200 · radar 200 · `/api/bulletin` **503** (bilinen soğuk açılış) |

Bu tur rastgele ekran gezmek yerine, bugün ortaya çıkan **en ciddi kusur
sınıfını** sistematik kovaladı: *sayfa zemininde `primary` kullanımı*.

### Kök kural (paletten okundu)
`takim_paleti.dart`: `vurgu` (→ `AppColors.primary`) **KART yüzeyi için**
türetiliyor — kendi yorumu: *"VURGU: kart ÜSTÜNDE duran buton/rozet zemini"*.
Zemin karşılığı ayrı bir token: `onBackgroundAccent` (`p.secili`).
Yani bugünkü görünmez-düğme kusuru, var olan bir kuralın ihlaliydi.

### 🟡 BULGU 20 — Sistem Karnesi hero başlığı okunmuyordu (DÜZELTİLDİ)
`t18_sistem_karnesi.png`: "ANALIZ MERKEZİ…", "Sistem Master Analiz Karnesi" ve
alt satırı silik.

**Kök neden:** tema hero için AYRI bir yüzey tanımlıyor (`heroZemin = p.yuzey`)
ve hero yazıları (`onHero`/`onHeroSoft`) tam O YÜZEYE göre türetiliyor. Ama
`DashboardHero` yüzeyi `AppColors.primary` ile boyuyordu — yazılar başka bir
yüzeyin renginden geliyordu. **Ana sayfadaki hero zaten `heroZemin`
kullanıyor**; iki hero ayrışmıştı.

**Düzeltme:** `DashboardHero` → `color: AppColors.heroZemin`. Tek token; her
`DashboardHero` kullanan ekran birlikte düzeldi.

### 🟡 BULGU 21 — Sistem Karnesi'nde SEÇİLİ sekme çipi görünmüyordu (DÜZELTİLDİ)
Aynı ekranda "Özet" çipsiz, yalın yazı gibi duruyordu; diğer sekmeler pill.
Dolgu `AppColors.primary` ve çip ZEMİNDE — takım temasında kayboluyor.
BULGU 19'un aynısı, farklı dosyada (`widgets/dashboard_ui.dart`).

**Düzeltme:** kullanıcı kararıyla aynı dil — KART dolgusu + SARI (`primary`)
çerçeve ve yazı.

**Kanıt:** `t19_karne.png` — hero kırmızı kartta sarı yazı, "Özet" çipi sarı
çerçeveyle görünür.

Ayrıca aynı ekranın alt açıklaması zeminde `textMuted` (kart soluğu)
kullanıyordu → `onBackgroundMuted`.

### Not — bu sınıf henüz tükenmedi
`AppColors.primary` kodda **175 yerde** kullanılıyor. Çoğu meşru (kart üstünde
yüzey ya da yazı). Statik olarak "bu öğe zeminde mi?" demek güvenilir değil;
bu yüzden tarama yerine ekran ekran ölçüm sürüyor. Şu ana kadar bu sınıftan
**5 kusur** bulundu (BULGU 17, 19, 20, 21 + geçmiş hafta başlığındaki görünmez
düğme).
