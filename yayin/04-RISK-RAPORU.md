# Yayın Risk Raporu — Dürüst Değerlendirme

**Uygulama:** Sportoto Master Analiz
**Rapor tarihi:** 24 Temmuz 2026
**Hazırlayan:** Kod ve politika denetimi

> Bu rapor, istediğin gibi **hiçbir riski gizlemeden** yazılmıştır. İyi haber
> ve kötü haber aynı yerde durur. Kaynaklar güncel resmî sayfalardan
> alınmıştır ve bağlantıları verilmiştir.
>
> **Adı değiştirmedim.** Talimatın gereği uygulamanın adı her yüzeyde
> "Sportoto Master Analiz" olarak uygulandı. Aşağıdaki 1. ve 2. maddeler,
> bu adla ve bu işlevle yayına çıkmanın **gerçek** risklerini anlatır.
> Karar senindir; benim işim durumu net göstermek.

---

## Özet tablo

| # | Risk | Seviye | Yayını engeller mi? |
|---|---|---|---|
| 1 | Uygulama adındaki "Sportoto" ibaresi | **YÜKSEK** | Muhtemelen — inceleme aşamasında ret veya sonradan kaldırma |
| 2 | Kumar "yardımcı uygulama" (companion) politikası | **YÜKSEK** | Muhtemelen — politikanın lafzı bu işlevi doğrudan sayıyor |
| 3 | TÜRKPATENT marka tescili doğrulanamadı | **BİLİNMİYOR** | Doğrulanana kadar 1. maddenin boyutu ölçülemez |
| 4 | 7258 sayılı Kanun — tanıtım dili | ORTA | Hayır, ama dil kontrolü sürekli olmalı |
| 5 | İçerik derecelendirmesinde yanlış beyan | ORTA | Evet, yanlış doldurulursa |
| 6 | Kullanıcı yorumları için moderasyon aracı | ~~ORTA~~ **KAPANDI** | Hayır — 25.07.2026: bildirme + engelleme + inceleme süreci tamam (E9) |
| 7 | Görsel kimlik (simge, logo, renkler) | **DÜŞÜK** | Hayır — özgün, sorun görünmüyor |

---

## 1. Uygulama adındaki "Sportoto" ibaresi — YÜKSEK RİSK

### Durum

"Spor Toto", Türkiye'de bir **devlet kuruluşunun** adıdır: Spor Toto Teşkilat
Başkanlığı, resmî sitesi `sportoto.gov.tr`. Yani bu ibare hayalî bir kelime
değil, faal bir kamu kurumunun ve onun yürüttüğü bahis ürününün adıdır.

Uygulamanın adı "Sportoto Master Analiz" bu ibareyi **başa** alır ve
bitişik yazım (`Sportoto`) kurumun kendi alan adındaki yazımla aynıdır.

### Google Play açısından

Google Play'in **Yanıltıcı Davranış / Kimliğe Bürünme** politikası şunu
söylüyor: uygulamanın, ilgisi olmayan biriyle ilişkili veya onun tarafından
yetkilendirilmiş olduğu **ima edilemez.** Politika, uygulama simgesi, adı,
açıklaması ve uygulama içi öğelerin, uygulamanın bir başkasıyla ilişkisi
konusunda kullanıcıyı yanıltmaması gerektiğini belirtiyor.

**En önemli nokta:** Politika metninde *"resmî değildir"*, *"bağımsızdır"*
gibi bir açıklama koymanın kuralı sağladığına dair **hiçbir istisna yok.**
Yani uygulamanın içine ve mağaza açıklamasına koyduğumuz bağımsızlık
bildirimi — ki bu doğru ve gerekli bir şeydir — **tek başına** bu riski
ortadan kaldırmaz. Ölçüt, kullanıcının adı gördüğünde ne düşündüğüdür.

Ayrıca **Fikrî Mülkiyet** politikası, başka bir tarafın ticari markalarının
(logo veya marka adı) izinsiz ya da kullanıcıyı yanıltabilecek şekilde
kullanılmasını yasaklıyor.

### Türk hukuku açısından

- 6769 sayılı Sınai Mülkiyet Kanunu m. 7/5-b'deki "dürüst kullanım"
  istisnası, bir markayı **uygulamanın başlığı olarak** kullanmayı
  kapsamaz; istisna, ürünü tanımlamak için gereken kullanımı hedefler.
- Bitişik yazım (`Sportoto` yerine `Spor Toto`) hukuken **ayırt edici bir
  fark değildir.** Marka hukukunda benzerlik, görsel ve işitsel algıya
  bakılarak değerlendirilir; iki yazım da aynı okunur.
- 7405 sayılı Kanun (2022) ile Spor Toto Teşkilat Başkanlığı'na, ilgili
  ihlallerde doğrudan savcılığa başvurma yetkisi tanınmıştır. Yani muhatap
  yalnız Google değil, kurumun kendisi de olabilir.

### Ne yapılabilir (karar senin)

| Seçenek | Risk | Not |
|---|---|---|
| **A)** Adı aynen bırak | Yüksek | Ret veya sonradan kaldırma ihtimali gerçek. Uygulama emeğinin tamamı bu ada bağlanır |
| **B)** Kuruma yazılı izin/muvafakat için başvur | Riski gerçekten çözer | Süre alır, sonucu belirsiz. **Bu senin yapman gereken bir adımdır** |
| **C)** "Sportoto" ibaresi olmadan bir ad seç | Riski büyük ölçüde kaldırır | **Onayın olmadan yapmadım ve yapmayacağım** |

> **Karar bekliyorum:** Bu üç seçenekten hangisini istediğini söylemeden adı
> değiştirmem. Talimatın açıktı: *"Benim onayım olmadan uygulamanın adını
> başka bir markaya dönüştürme."*

---

## 2. Kumar "yardımcı uygulama" politikası — YÜKSEK RİSK

Bu, ad riskinden **bağımsız** ve en az onun kadar ciddi bir konudur; adı
değiştirsen bile ortadan kalkmaz.

### Durum

Google Play'in gerçek para kumarı politikası, kumar ürününe **yardımcı /
tamamlayıcı işlev** sunan uygulamaları yasaklıyor ve bu işleve örnek olarak
açıkça **"spor skoru/oran/performans takibi"** ile bahis desteğini sayıyor.
Politikada verilen somut ihlal örneği, entegre kumar reklamı taşıyan bir
spor oran takip uygulamasıdır.

### Uygulamanın lehine olan gerçekler

Bunlar önemlidir ve inceleme sırasında işe yarayabilir:

- Uygulamada **ödeme, cüzdan, bakiye, para yatırma/çekme yoktur.**
- Hiçbir operatöre **bağlantı, yönlendirme, üyelik çağrısı veya reklam yoktur.**
- **Hiçbir reklam yoktur** — politikanın verdiği somut ihlal örneğinin ana
  unsuru bizde yok.
- **Bahis oranı gösterilmez.** Uygulama, oran değil istatistik ve kriter
  analizi sunar.
- Dil, kazanç vaadi içermez; "Güçlü Aday" gibi ölçülü ifadeler kullanılır.
- "Oynadım" gibi ifadeler yerine "Tahminimi Kilitle" / "Kuponu Kaydet"
  kullanılır — kullanıcı bir şey oynamamıştır, tercihini kaydetmiştir.

### Uygulamanın aleyhine olan gerçekler

Bunları da saklamıyorum:

- Uygulama, **gerçek parayla oynanan resmî bir bültenin** maçlarını
  merkezine alır ve bu bültene göre "kupon" kaydettirir.
- "Kupon" kelimesi, kaydedilen tercihler ve sonuçlarının resmî sonuçlarla
  değerlendirilmesi, incelemeciye **companion** izlenimi verebilir.
- Politikanın lafzı ("skor/performans takibi") geniştir; yorum incelemeciye
  kalır ve incelemeci kararı öngörülebilir değildir.

### Ne yapılabilir

Bu risk **tamamen** sıfırlanamaz, ama düşürülebilir. Senin onayınla
yapılabilecekler:

1. "Kupon" kelimesini kullanıcı arayüzünde "Tahmin Listem" / "Haftalık
   Tercihlerim" gibi bir karşılıkla değiştirmek. *(Depolama anahtarları
   değişmez — mevcut kullanıcı verisi korunur.)*
2. Mağaza açıklamasında analiz ve istatistik yönünü öne çıkarmak — bu
   zaten yapıldı.
3. İncelemeye, uygulamanın ödeme ve operatör bağlantısı içermediğini
   anlatan bir açıklama notu eklemek.

> **Karar bekliyorum:** 1. maddeyi uygulamamı ister misin? Kelime değişikliği
> kullanıcıya görünen bir dil değişikliğidir, onayın olmadan yapmam.

---

## 3. TÜRKPATENT marka tescili — DOĞRULANAMADI

**Bu, raporun en büyük bilgi boşluğudur ve bir yayın engelidir.**

"SPOR TOTO" ve "SPORTOTO" ibarelerinin TÜRKPATENT nezdinde tescilli marka
olup olmadığını, hangi sınıflarda (özellikle **9. sınıf — yazılım** ve
**41. sınıf — spor/eğlence hizmetleri**) tescilli olduğunu **doğrulayamadım.**

- TÜRKPATENT'in marka araştırma veritabanı, genel web araması ile sorgulanan
  bir kaynak değildir; sorgunun kurumun kendi sisteminden yapılması gerekir.
- Bu bilgi olmadan 1. maddedeki hukuki riskin **boyutu** ölçülemez. Tescil
  9. sınıfı kapsıyorsa risk belirgin biçimde artar.

**Uydurma cevap üretmedim.** Bunu senin bir **marka vekiline** sorman
gerekiyor; bir marka vekili bu sorguyu birkaç gün içinde ve düşük maliyetle
yapar ve ayrıca 1. maddedeki B seçeneği (izin başvurusu) için de doğru
muhataptır.

---

## 4. 7258 sayılı Kanun — tanıtım dili — ORTA

7258 sayılı Kanun'un 5. maddesi, yasa dışı bahis oynatma ve **buna
teşvik/reklam** fiillerini cezalandırır. Uygulama bahis oynatmadığı ve
hiçbir operatöre yönlendirmediği için ana fiil kapsamında değildir.

Riskin bulunduğu yer **dil**dir: kazanç vaadi, "kesin kazandırır" tarzı
ifadeler veya bir operatöre örtülü yönlendirme, tanıtım/teşvik olarak
değerlendirilebilir. Bu yüzden:

- Kod tabanında iddialı dil yasağı **otomatik testlerle** korunuyor.
- Mağaza metinleri de aynı testle denetleniyor
  (`backend/test/store-listing.test.mjs`).
- Bu koruma **kalıcı olmalıdır**; ileride pazarlama metni yazarken de
  aynı kurallar geçerlidir.

---

## 5. İçerik derecelendirmesinde yanlış beyan — ORTA

IARC anketini "daha geniş kitleye ulaşayım" diye yanlış doldurmak,
yayından kaldırma ve hesap askıya alma sebebidir. `03-ICERIK-DERECELENDIRME.md`
dosyasındaki cevaplar **dürüst** cevaplardır ve büyük olasılıkla **18+**
derecelendirmesi üretecektir. Bu sonucu değiştirmeye çalışmak, uygulamayı
kaybetmenin en hızlı yoludur.

---

## 6. Kullanıcı yorumları için moderasyon aracı — ORTA

Uygulamada kullanıcı yorumu ve beğeni vardır. Google, kullanıcı içeriği
barındıran uygulamalarda:

- uygunsuz içeriği **bildirme** yolu,
- rahatsız eden kullanıcıyı **engelleme** yolu,
- ve bildirimlere makul sürede yanıt verecek bir **moderasyon süreci**
  ister.

> **KARAR VERİLDİ — 25.07.2026:** Onay verildi, özellik ekleniyor (kontrol
> listesi E9). Kapsam: yoruma **Bildir** (sebep seçimli), kullanıcıya
> **Engelle**, Profil altında **Engellenen kullanıcılar** ekranı ve engeli
> kaldırma, arka tarafta bildirim kaydı tutan iki yeni tablo ve eşiği aşan
> yorumu otomatik gizleyen bir kural. Yeni veri tabloları migration
> `007` ile **kendiliğinden** kurulur; elle SQL çalıştırılmaz.

> **TAMAMLANDI — 25.07.2026:** Üç şartın üçü de kod tarafında kapatıldı.
>
> 1. **Bildirme** — yorum menüsünde "Bildir", altı yayımlanmış sebepten biri
>    seçilir. Aynı kişi aynı yorumu bir kez bildirir.
> 2. **Engelleme** — "Engelle" ve Profil altında **Engellenen kullanıcılar**
>    ekranı; engel iki yönlüdür ve engellenenin yorumları görünmez.
> 3. **İnceleme süreci** — herkese açık **Topluluk Kuralları** sayfası
>    (`/topluluk-kurallari`, uygulama kurulmadan da açılır; Hakkında
>    ekranından bağlantılıdır) ve yalnız operatörün görebildiği **İnceleme**
>    ekranı: açık bildirimleri listeler, yorumu **gizle / geri al /
>    bildirimi yok say**. Operatör kimliği `backend/.env` içindeki
>    `MODERATOR_EMAILS` listesinden gelir; **uygulamaya hiçbir kimlik
>    gömülmez**, kararı sunucu verir ve liste tanımsızken kapı herkese
>    kapalıdır.
>
> Sayfada verilen söz: bildirimler **en geç 7 gün içinde** incelenir. Bu süre
> tutulabilir bir söz olmalıdır — değiştirmek istersen tek yer
> `backend/legal/topluluk-kurallari.html`.
>
> **Ölçüldü (bulut):** backend 486 test, uygulama 377 test, web paketi 200.
> Gerçek telefonda Bildir/Engelle akışı **henüz denenmedi** (kontrol listesi
> §G).

---

## 7. Görsel kimlik — DÜŞÜK RİSK

Uygulama simgesi denetlendi: lacivert zemin üzerine **kırmızı ve beyaz üç
soyut yuvarlak çubuk** (bir grafik/istatistik sembolü). Değerlendirme:

- Hiçbir kurum logosu, amblemi, arması veya bayrağı **yok.**
- Başka bir uygulamanın simgesine benzerlik **yok.**
- Tamamen geometrik ve özgün; telif veya marka sorunu **görünmüyor.**
- Renkler (kırmızı-beyaz-lacivert) genel renklerdir; bayrak veya amblem
  taklidi değildir.

Marka metni de tek bir kaynaktan (`app/src/brand.js`) okunur; hiçbir ekranda
elle yazılmış marka metni yoktur ve bu bir testle korunmaktadır.

**Sonuç:** Görsel kimlik tarafında yayına engel bir durum görmüyorum.

---

## Senden alınması gerekenler (uyduramayacağım şeyler)

Bunlar teknik olarak çözülebilecek şeyler değildir; sende olan bilgiler
veya senin vermen gereken kararlardır.

| # | Gereken | Neden |
|---|---|---|
| 1 | **Alan adı (HTTPS)** | `EXPO_PUBLIC_API_BASE` ve yasal sayfaların adresi. Play, gizlilik ve hesap silme sayfalarının **kurulum gerektirmeden** açılmasını şart koşar |
| 2 | **Destek e-posta adresi** | Yasal sayfalarda ve Play iletişim alanında görünecek. Sahte adres yazmadım; `SUPPORT_EMAIL` ortam değişkeninden okunuyor |
| 3 | **Play Console erişimi** | Uygulamayı ben yükleyemem; hesap, kimlik doğrulama ve 25 USD kayıt ücreti sana ait |
| 4 | **Uygulama imzalama anahtarı** | Anahtar üretimi ve saklanması sana ait. Anahtarı kaybetmek, uygulamayı güncelleyememek demektir |
| 5 | **`com.emrahanlar.masteranaliz` onayı** | Uygulama kimliği ilk yüklemeden sonra **asla değişmez.** Bu kimliği onaylaman gerekiyor |
| 6 | **Marka vekili sorgusu** | 3. maddedeki TÜRKPATENT boşluğu |
| 7 | **1. ve 2. maddedeki kararlar** | Ad ve "kupon" dili hakkındaki üç soru |
| 8 | **Migration 005** | Supabase SQL Editor'da senin çalıştırman gerekiyor |
| 9 | **Kupon birim bedeli** | `backend/data/coupon-pricing.json` içindeki resmî bedel ve kaynak tarihi — uydurulmadı, boş bırakıldı |

---

## Kaynaklar

- [Yanıltıcı davranış / kimliğe bürünme politikası — Google Play](https://support.google.com/googleplay/android-developer/answer/9888374)
- [Fikrî mülkiyet politikası — Google Play](https://support.google.com/googleplay/android-developer/answer/9888072)
- [Gerçek para kumarı, oyunlar ve yarışmalar politikası — Google Play](https://support.google.com/googleplay/android-developer/answer/9877032)
- [Hedef API düzeyi gereksinimleri — Google Play Console Yardım](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Spor Toto Teşkilat Başkanlığı — resmî site](https://www.sportoto.gov.tr/)
