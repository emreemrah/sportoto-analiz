# Yayın Denetimi ve Özellik Önerileri

**Tarih:** 25 Temmuz 2026
**Yöntem:** Uygulama, canlı yayın yapan bir analiz yorumcusunun gözüyle,
çalışan hâliyle (localhost:8081, gerçek 51. Hafta verisi) baştan sona
GERÇEKTEN KULLANILARAK denetlendi. Her bulgu ekranda bizzat yaşandı;
varsayım yok.

---

## A. KRİTİK EKSİKLER — canlı yayında takıldığım yerler

### A1. Kupon, bülten mühürlenince TAMAMEN kilitleniyor ⛔ (en kritik)

**Yaşanan:** 13/15 maç henüz başlamamışken Kupon Merkezi → Kupon Hazırla
ekranı kırmızı uyarı veriyor: *"Bülten kilitlendi — bu hafta kupon
oluşturulamaz/değiştirilemez."* Tüm 1/X/2 düğmeleri pasif. Maç detayındaki
"KUPONA İŞLE" paneli de aynı sebeple kapalı.

**Neden yanlış:** İki farklı kilit birbirine karışmış. Sistem ANALİZİNİN
mühürlenmesi doğru ve gerekli (dürüstlük garantisi). Ama KULLANICININ kupon
tercihi, kendi kuralımıza göre *"maç başlamadan önce kaydedilmiş tercihle
değerlendirilir"* — yani kilit MAÇ BAZINDA olmalı: başlamamış maça seçim
serbest, başlamış maça kilitli. Bugünkü hâliyle yayıncı perşembe akşamından
sonra hafta boyunca kupon KURAMAZ; izleyiciye gösterilecek en önemli akış ölü.

**Öneri:** Maç bazlı kilit + her seçime kayıt zaman damgası; başlamış maç
satırında "🔒 başladı" rozeti. Mühür bilgisi analiz tarafında aynen kalır.

### A2. "Bülteni Aç" ve sekmeler son kalınan ekrana götürüyor

**Yaşanan:** Ana Sayfa'daki "Bülteni Aç" düğmesi beni bültene değil, daha
önce gezdiğim Aarhus–Brondby maçının İSTATİSTİK sekmesine götürdü. İlk
denemede de (girişsiz hâldeyken) kendimi Avatar Seçme ekranında buldum.

**Neden:** Sekme yığınları (stack) son ekranı geri getiriyor; ana CTA'lar
hedef ekrana sıfırlamıyor. Yayında "bülteni açıyorum" deyip başka ekrana
düşmek güven bozar.

**Öneri:** Ana CTA'lar (Bülteni Aç, Kupon Oluştur, alt sekmeye ikinci tık)
hedef ekrana `popToTop`/reset ile gitsin.

### A3. Maç Analiz sekmesi ilk kullanıcıya BOŞ geliyor

**Yaşanan:** Maç detayı → Analiz: "Analiz profili oluşturulmadı" + üst üste
İKİ tane neredeyse aynı "Analiz Kriterlerini Seç" düğmesi. İzleyici "analiz
uygulaması" diye açıp analiz göremiyor.

**Öneri:** Kurulum gerektirmeyen **hazır varsayılan profil** ("Önerilen
kriter seti") ile analiz anında dolu gelsin; kişiselleştirme isteğe bağlı
kalsın. Çift düğme teke insin.

### A4. Bülten maç kartı hiçbir analiz sinyali taşımıyor

**Yaşanan:** Bülten kartında yalnız takımlar + saat + iki tarafta "0G 0B 0M"
rozetleri (hepsi sıfır — bozuk izlenimi). Ana seçim, favori yüzdesi, sürpriz
etiketi kartta yok. Oysa Radar kartında hepsi var (Ana:1 · Favori %73 ·
güven/uzlaşma) — iki ekran arasında tutarsızlık.

**Öneri:** Bülten kartına tek satır analiz özeti (Ana seçim + favori % +
sürpriz/temkin etiketi) ve form şeridi; sıfır dolu rozetler veri yokken
gizlensin.

### A5. Sayaçlar tutarsız

**Yaşanan:** Başlık "13/15 maç başlamadı" derken sayaç şeridi Canlı 0 ·
Başlamadı 13 · Biten 0 gösteriyor — dünkü 2 maç hiçbir kategoride değil
(13+0+0 ≠ 15).

**Öneri:** Başlayan-ama-resmî-sonucu-gelmemiş maçlar için ayrı durum
("Sonuç bekleniyor") ya da Biten'e sarı rozetle dahil.

### A6. Sezon başında karne bölümü ölü alan

**Yaşanan:** İstatistik → Karne: "Aarhus 0 · Brondby 0 maç — karne
gösterilmez, uydurma hesap yapılmaz." Dürüstlük doğru; ama bölüm bomboş.

**Öneri:** Otomatik olarak "Son 15 (geçen sezon dahil)" kesitine düşsün ve
bunu açıkça etiketlesin — uydurma yok, veri kaynağı belli.

### A7. Kupon maliyeti "—" (bilinen, senden bekleyen madde)

"Birim kolon bedeli verisi yok — maliyet gösterilmiyor (uydurma fiyat
kullanılmaz)" davranışı doğru; resmî birim bedel gelince kapanacak (E listesi).

---

## B. YAYIN GÖRSELLİĞİ — 50-60 bin izleyicinin gözüyle

1. **Geniş ekranda aşırı yayvan düzen:** 1568px'te kartlar uçtan uca
   yayılıyor, orta bölge bomboş — 1080p yayında "boş uygulama" izlenimi.
   Öneri: web'de içerik azami genişliği (~1140px) + ortalama.
2. **Radar'daki 1/X/2 "kupona işle" düğmeleri minicik ve soluk** — yayında
   okunmaz. Büyük, dolgulu seçim pilleri (seçili olan renkli) olmalı.
3. **"Sürpriz İhtimali Yüksek" mini kartlarında takım adı yok** — yalnız
   arma; izleyici armadan takımı tanımaz. Kısaltılmış ad eklensin.
4. **Yayın Modu (tek düğme):** daha büyük punto, yüksek kontrast, alt
   sekme gizleme — OBS kadrajı için temiz ekran. Yayıncı segmenti
   ("bugün 3 güçlü aday var") tek ekranda gösterilebilmeli. — ✅ **yapıldı (Ek 5)**
5. **Koyu tema:** yayıncı stüdyolarında beyaz ekran patlar; koyu tema hem
   şık hem göz yormaz (izleyici tarafında da gece kullanımının standardı).
   — ✅ **yayın yüzeyi için yapıldı (Ek 5)**; uygulamanın tamamı için koyu tema
   ayrı bir iş (bkz. Ek 5 notu).
6. **Form şeritleri ve yüzde çubukları karta gelsin** (renkli G/B/M
   kutucukları) — bir bakışta hikâye anlatır, ekranda hareket hissi verir.

---

## C. RAKİPLERDEN ALINABİLECEK ÖZELLİKLER (bahis/ödeme İÇERMEZ)

| # | Özellik | Esin | Bizde ne gerekir |
|---|---|---|---|
| C1 | **Kupon stüdyo kartı**: 15 maçlık seçimi tek şık görselde dışa aktar (story/tweet formatı, marka logolu) | Genel yayıncı pratiği | CouponShare ekranı var; görsel şablon + paylaş |
| C2 | **Topluluk yüzdeleri maç kartında** ("Topluluk: %62 → 1") | Sofascore "who will win" | Anket verisi zaten toplanıyor; karta bağlanacak |
| C3 | **Takım karşılaştırma (radar grafiği)**: iki takımın hücum/savunma/form/xG karşılaştırması tek görselde | Sofascore/FotMob compare | Veriler mevcut; react-native-svg ile çizim |
| C4 | **Haftanın Özeti açılış kartı**: 3 Güçlü Aday + 2 sürpriz + zorluk puanı tek ekranda — yayın açılış segmenti | — | Veriler hazır (Radar + zorluk); tek ekran |
| C5 | **Hafta kapanış "recap"i**: resmî sonuçlar gelince sistem karnesi + kullanıcı karnesi yan yana | FotMob maç sonu özetleri | Karne verileri hazır; karşılaştırma ekranı |
| C6 | **Favori takım vurgusu**: profildeki favori takımın maçı bülten/radar'da işaretli | FotMob favori takip | favorite_team alanı zaten var |
| C7 | **Canlı maç merkezini zenginleştirme**: olay şeridi (gol/kart dakikaları), canlı istatistik çubukları | Flashscore/Sofascore | LiveMatchDetail mevcut; API-Football olay verisi |
| C8 | **Lider tablosunda seviye/rozet gösterimi** + "haftanın isabet kralı" kartı | Oyunlaştırma standartları | Puan/seviye sistemi dün kuruldu; UI bağlanacak |
| C9 | **Bildirimler**: maç başlıyor / resmî sonuç açıklandı / puan kazandın | FotMob | `expo-notifications` — YENİ PAKET, onayın gerekir |

Bahis oranları gösterimi, canlı bahis, para/ödeme akışları bilinçli olarak
LİSTEDE YOK — uygulama kuralı gereği (analiz ve karar desteği).

---

## D. UYGULAMA DURUMU (25.07.2026 — onayınla "Kritik + görsellik" paketi)

| Madde | Durum |
|---|---|
| A1 Kupon kilidi maç bazına indi | ✅ Canlıda doğrulandı: "2 maç başladı — kalan 13 serbest", seçim + çifte çalışıyor; kilitli maç gri ve korunuyor. Dürüstlük kuralı: kilitli maçın seçimi değişemez (testli) |
| A2 Gezinme sıfırlama | ✅ Sekmeden ayrılınca yığın köke döner; "Bülteni Aç" hep bültene gider |
| A3 Varsayılan analiz profili | ✅ "Önerilen Kriter Seti" (7 yüksek etkili kriter) kurulum istemeden çalışır; bilerek tümü kapatılmışsa dokunulmaz |
| A4+B6 Kart zenginleştirme | ✅ Güçlü Aday/Dikkat etiketi + favori % + sürpriz puanı + form şeritleri kartta; sıfır rozetler gizli; "Sistem 0" → "X" diliyle |
| A5 Sayaçlar | ✅ "Sonuç Bekleniyor" durumu eklendi — kaybolan maç kalmadı |
| A6 Karne kesiti | ✅ Sezon 0 maçsa açık etiketle "Son 15 (geçen sezon dahil)" kesitine düşer |
| B1 İçerik genişliği | ✅ Web'de ~1140px ortalanmış içerik (canlıda doğrulandı) |
| B2 Radar seçim pilleri | ✅ Büyük, çerçeveli, okunur |
| B3 Sürpriz kartı takım adları | ✅ Canlıda doğrulandı |

Testler: uygulama **95/95** (6'sı yeni maç-bazlı kilit testi) · backend 327/327 ·
web derlemesi + çalışan ekran doğrulaması ✅ · dosyalar cihazda sha256 doğrulandı.

**Ek (aynı gün, "devam" onayıyla):**

| Madde | Durum |
|---|---|
| C4 Haftanın Özeti açılış kartı | ✅ Canlıda doğrulandı: marka başlıklı koyu kart — zorluk çubuğu (Kolay 28/100), 15 Maç · 3 Güçlü Aday · 3 Sürpriz Adayı · 5 Denk Güç, yeşil/kırmızı pilli aday listeleri, "başlamış maç aday gösterilmez" kuralı ve 18+ notu. Ana Sayfa kahraman kartındaki "📺 Haftanın Özeti" düğmesinden açılır; satıra dokununca maç analizine gider |
| C1 Kupon stüdyo kartı | ✅ Paylaşım görseli stüdyo kalitesine çıkarıldı: iki tonlu marka + vurgu şeridi + dönüşümlü satır zeminleri + seçimler turuncu pillerde; web'de **Story (9:16, 1080×1920)** formatı eklendi. Kişisel veri yok + "kesin sonuç vaadi değildir" notu görselde sabit |

Yeni testler: hafta özeti seçim mantığı 6 test (aday uydurulmaz, başlamış maç
listelenmez, sıralama gerçek veriyle) — uygulama toplamı **101/101**.

**Ek 2 (aynı gün, ikinci "devam"):**

| Madde | Durum |
|---|---|
| C3 Takım güç karşılaştırma radarı | ✅ Canlıda doğrulandı (KFUM–Molde): 6 gerçek eksen (Puan/Maç, Gol/Maç, Savunma, xG, Temiz Kale, Form), iki renkli çokgen + altta ham değerler. Eksik eksen uydurulmaz; 3'ten az eksen varsa grafik hiç çizilmez (testli) |
| C2 Topluluk yüzdeleri kartlarda | ✅ Toplu `ms-summary` ucu (15 maç tek istekte, anonim sayımlar); kartta "Topluluk %62 → 1 (N oy)" — en az 5 oy şartıyla (küçük örneklem yanıltıcı gösterilmez) |
| C6 Favori takım vurgusu | ✅ Profildeki favori takımın maçı kartlarda ⭐ ile işaretli (temkinli eşleşme, testli) |
| C8 Lider tablosu | ✅ Ekran statik iskeletmiş — sahte rozet vitrini ve örnek puan metniyle; GERÇEK uca bağlandı: 👑 Haftanın İsabet Kralı kartı, podyum + seviye rozetleri (sunucudaki kalıcı puan defterinden), "senin sıran" satırı. Resmî sonuç yokken dürüst boş durum |

Ayrıca canlıda doğrulanan: maç detayındaki KUPONA İŞLE bloğu kilitsiz maçta
yeniden aktif (A1'in detay ekranı ayağı). Testler: uygulama **107/107** ·
backend **327/327**.

**Ek 3 (aynı gün, üçüncü "devam"):**

| Madde | Durum |
|---|---|
| C7 Canlı maç olay şeridi | ✅ 0–90' zaman şeridi: ev takımı üstte, deplasman altta, devre çizgisi ve canlı dakika işareti. Yalnız **gol ve kırmızı kart** işaretlenir. VAR ile iptal edilen gol şeride yazılmaz (resmî skorla çelişmesin), dakikası olmayan olay hiç gösterilmez, takımı eşleşmeyen olay şeritten çıkarılıp sayısı açıkça yazılır |
| C7 Baskı göstergesi | ✅ Şut / isabetli şut / korner / topla oynama / tehlikeli atak paylarından ağırlıklı baskı çubuğu; hangi ölçülere dayandığı altında yazılı ve "Sonuç tahmini değildir" notu sabit. **İki ölçüden az gerçek veri varsa gösterge hiç çizilmez** (testli) |
| C7 Gol akışı | ✅ Olaylar sekmesinde koşan skor pilleri; kendi kalesine gol rakibe yazılır, takımı belirsiz gol skora hiç işlenmez |
| C7 **Sahte "Kupon yok" bloğu kaldırıldı** | ✅ Canlı maç detayındaki Kupon/Sistem sekmesi sabit metinmiş — kullanıcının kayıtlı kuponu olsa bile "Kupon yok" ve "Kupon Riskte: —" yazıyordu. Artık o haftanın **gerçek** kuponları okunuyor: kupon numarası, dereceli işareti, seçim ve anlık/kesin isabet durumu. "Kupon Riskte" satırı dereceli kupondan hesaplanıyor; kupon yoksa "Kupon Oluştur" düğmesi doğrudan kupon ekranına gidiyor |
| C5 Hafta kapanışı ekranı | ✅ Yeni ekran: hafta gezme (‹ ›, varsayılan bir önceki hafta), resmî sonuç ilerleme çubuğu, **SEN vs SİSTEM** yan yana karne, "Haftanın Anları" (🔥 sen bildin / 🤖 sistem bildi / 💥 ikiniz de bilemediniz) ve tüm resmî sonuç tablosu. Ana Sayfa'daki "🏁 Geçen Haftanın Kapanışı" düğmesinden ve Başarı Panelim'den açılır |
| C5 Adil karşılaştırma | ✅ Sen ve sistem **yalnız ikisinin de tahmin yaptığı maçlarda** karşılaştırılır. Yalnız resmî sonuç (hem `result` hem `score`) sayılır — canlı skor karneye yazılmaz. Kayıtlı kupon yoksa kullanıcı karnesi **üretilmez**, sistemin ıskaları yine listelenir. Hiç resmî sonuç yoksa sayı yerine "açıklandıkça oluşur" denir (hepsi testli) |
| Ölü gezinme düğmeleri | ✅ Başarı Panelim'deki "Kuponlarım" ve "Diğer Kuponlar" satırları var olmayan bir `Coupons` ekranına gitmeye çalışıyordu (hiçbir şey olmuyordu). Gerçek hedeflere bağlandı: Kuponlarım sekmesi ve o kuponun sonuç ekranı |

Yeni testler: canlı olay/baskı 11 test + hafta kapanışı 9 test →
uygulama **127/127** · backend **327/327** · web derlemesi ✅ ·
yeni `scripts/verify-week-recap.mjs` düğmeyi gerçek tarayıcıda tıklayıp
ekranın açıldığını ve iddialı dil içermediğini ölçüyor.

**Ek 4 (aynı gün, dördüncü "devam"):**

| Madde | Durum |
|---|---|
| C9 Bildirim merkezi (uygulama içi) | ✅ Yeni ekran + Ana Sayfa'daki zil. Dört gerçek olay türü: yeni bülten yayınlandı, **kuponundaki** maç 1 saat içinde başlıyor, resmî sonuçlar açıklandı/hafta kapandı, sunucunun doğruladığı puan ve başarı. Her satır dokunulunca gerçek hedefe gider (bülten / canlı maç / hafta kapanışı / profil) |
| C9 **Sahte zil rozeti kaldırıldı** | ✅ Ana Sayfa'daki zil **hiçbir yere gitmiyordu** ve yanında **her zaman görünen** kırmızı bir süs noktası vardı. Artık zil bildirim merkezini açıyor; kırmızı sayı yalnız GERÇEK okunmamış bildirim varsa çıkıyor, sayı da gerçek |
| C9 Dürüstlük kuralları | ✅ Veri yoksa bildirim üretilmez (boş liste dürüst sonuçtur). Yalnız **resmî** sonuç (`result` + `score`) "açıklandı" sayılır; canlı skor sayılmaz. Kısmî sonuçta "2/3" yazılır, "bitti" denmez. Puan/başarı **yalnız sunucudan** gelen toplamla karşılaştırılır — istemci puan üretemez. İlk kurulumda geçmişe dönük bildirim yağmuru olmaz |
| C9 Telefon bildirimi | ⏸️ → ✅ **Onayın geldi, yapıldı — bkz. Ek 7.** O günkü durum: `expo-notifications` YENİ PAKET olduğu için bekliyordu. Uygulama içi kısım pakete gerek olmadan zaten çalışıyordu |
| Ana Sayfa kahraman kartı düzeni | ✅ Sayaçlar ile düğmeler aynı satırdaydı; telefon genişliğinde sütunlar eziliyor ve "Öne Çıkan Analiz" etiketi **harf harf alt alta** düşüyordu. Sayaçlar ve düğmeler ayrı satırlara alındı, düğmeler eşit genişlikte |
| Gizlilik | ✅ Bildirim durumu yeni `sportoto.notifications.v1` anahtarında (mevcut hiçbir anahtarın adı değişmedi); içinde kişisel veri yok. Hesap silme temizlik listesine eklendi — silinen hesaptan cihazda iz kalmaz |

Yeni testler: bildirim mantığı 15 test (uydurma bildirim yok, resmî olmayan sonuç
sayılmaz, ilk kurulumda yağmur yok, iddialı dil yok) → uygulama **142/142** ·
backend **327/327** · web derlemesi ✅ · yeni `scripts/verify-notifications.mjs`
zile gerçek tarayıcıda tıklayıp hem boş hem dolu hâli ölçüyor.

**Ek 5 (aynı gün, beşinci "devam") — B listesinin kalan iki maddesi:**

| Madde | Durum |
|---|---|
| B4 Yayın Modu | ✅ Ana Sayfa'daki **📺** düğmesiyle açılan tam ekran sunum yüzeyi. 5 slayt: **Haftaya Bakış** (maç / güçlü aday / sürpriz adayı / denk güç sayaçları + bülten zorluk çubuğu) → **Güçlü Adaylar** → **Sürprize Açık Maçlar** → **Denk Güç** (yalnız varsa) → **Kapanış**. Alt sekme çubuğu bu ekranda gizleniyor, başlık çubuğu yok, gövde uçtan uca — OBS kadrajında yanlarda açık şerit kalmıyor |
| B4 Yayında sürüş | ✅ Klavye/sunum kumandası ile ilerleme (← → slayt, +/− punto, Esc çıkış, Home/End uçlar), üç kademeli punto ölçeği (**A− / A+**), slayt noktaları ve `3/5` sayacı. Satırlar **bilerek tıklanamaz**: yayında kazara dokunup başka ekrana düşmek kadrajı bozar |
| B5 Koyu tema (yayın yüzeyi) | ✅ Ayrı koyu palet (`#05070D` zemin, yüksek kontrast beyaz/kehribar/yeşil/kırmızı) yalnız bu ekranda yaşıyor. **Not:** uygulamanın tamamını çalışma anında koyu temaya çevirmek `theme.js`'in ~60 dosyada modül yüklenirken okunması yüzünden geniş bir yeniden yapılandırma gerektiriyor; yayın için asıl gereken stüdyo ekranıydı, o yüzden riskli global değişiklik yapılmadı — istersen ayrı iş olarak planlanır |
| B4 Dürüstlük | ✅ Tüm sayı ve satırlar **gerçek bültenden**; hafta özetiyle **aynı** kaynaktan okunuyor (denk güç eşiği tek yerde durur, ekranla sayaç asla çelişmez). Analizli maç yoksa slayt **üretilmiyor** — "Gösterilecek analiz yok" deniyor. Başlamış maç aday listelerinde yok ama toplam sayıda var, bu da ekranda yazıyor. Ham `BANKO` etiketi yayına çıkmıyor, yerine **GÜÇLÜ ADAY**; 18+ ve "kesin sonuç vaadi değildir" şeridi her slaytta sabit |
| B4 **Gizlilik (yayına özel)** | ✅ Bu ekranı on binlerce kişi görüyor: kullanıcı adı, e-posta, telefon, belirteç, kupon ve puan bu ekrana **hiçbir yoldan giremiyor** — slayt üreten fonksiyon yalnız bülteni alıyor. Ayrıca kasten "kirli" bülten verilip hiçbirinin sızmadığı test ediliyor; tarayıcı denetimi de ekran metnini e-posta/belirteç/telefon kalıplarına karşı tarıyor |
| Dar ekran düzeltmesi | ✅ 360px telefonda yayın puntosu taşıyordu (takım adı ikiye bölünüyordu); dar ekranda taban ölçek küçültüldü, satır dolguları kısıldı. Ayrıca Ana Sayfa kahraman kartının tebeşir **X** süsü dar ekranda kartın ortasına, düğmelerin üstüne düşüp yanlışlıkla konmuş bir "kapat" simgesi gibi görünüyordu — hizalama düzeltildi, geniş ekranda hiçbir şey değişmedi |

Yeni testler: yayın slayt mantığı **17 test** (veri yoksa slayt yok, kişisel veri
sızmaz, slayt sırası sabit, başlamış maç aday değil, iddialı dil yok, ham etiket
yok) → uygulama **159/159** · backend **327/327** · web derlemesi ✅ ·
yeni `scripts/verify-broadcast.mjs` 📺 düğmesini gerçek tarayıcıda tıklayıp
**iki kadrajda** (1280 yayın · 360 telefon) ve **iki veri hâlinde** (dolu · boş)
ölçüyor: sekme gizlenmesi, uçtan uca kadraj, ileri/geri, punto büyütme,
Esc ile çıkış ve çıkışta sekmenin geri gelmesi.

**Ek 6 (aynı gün, altıncı "devam") — dar ekran taraması, dürüstlük kusurları, cihaz eşitlemesi:**

| Madde | Durum |
|---|---|
| Dar ekran denetim betiği | ✅ Yeni `scripts/verify-narrow.mjs`: 360×740 kadrajda uygulamayı baştan sona geziyor. **Yeni paket kurulmadı** — betik `dist/` üzerinde kendi node http sunucusunu açıyor (`npx serve` gerekmiyor). Ayarlar: `--url`, `--genislik`, `--yukseklik`, `--durak`, `--api`. **20 durak tanımlı, 18'i ölçüldü** (kalan ikisi aşağıda). Tıklanacak şey bulunamazsa durak "atlandı" diye raporlanıyor — veri yokken açılmayan ekran kusur sayılmıyor |
| Dar ekran düzen kusuru | ✅ **0 kusur** — ölçülen 18 durakta taşma/kırpılma çıkmadı. Dürüst kayıt: taramanın asıl değeri düzen değil, aşağıdaki **düzen dışı dört kusuru** yakalaması oldu |
| **Üretimde veri uydurma** | ✅ En ağır kusur buydu. `bulletinHistoryService`, arşive ulaşılamadığında sessizce DEMO bültene düşüyor ve `attachResultSummary()` içinde **`systemAccuracy` yüzdesini uyduruyordu** — ekranda gerçek başarı oranı sanılacak bir sayı. Artık üretimde hata **dürüstçe taşınıyor**, demo veri yalnız `__DEV__` + açık izinle veriliyor. Kural hatırlatması: veriyi DEMO diye etiketlemek yetmez, sayının **üretilmemesi** gerekir |
| Demo/gerçek ayrımı | ✅ Yeni `src/demoGate.js` — React Native'e bağımlılığı olmayan saf modül (`src/apiBase.js` ile aynı gerekçe: `config.js` react-native'den `Platform` çekiyor, o da node testlerinde yüklenemiyor). `__DEV__` çağrı anında okunuyor, testler geçici olarak çevirip geri bırakabiliyor |
| İddialı dil (demo verisinde) | ✅ Yasak dil yalnız üretim metinlerinde aranmıştı; `src/data` içindeki demo kayıtlarda **"net favori"** ve **"gol garantiliydi"** duruyordu — yayında ekrana düşebilirdi. Temizlendi; yeni `test/verdict-wording.test.mjs` bunu kilitliyor |
| Ham teknik hata ekranda | ✅ Arşiv hatası artık uydurulmadığı için ekrana taşınıyordu, ama **"vekil: ECONNREFUSED"** gibi ham dizge olarak. `humanArchiveError()` yalnız ağ/sunucu hatalarını insan diline çeviriyor; sunucunun anlamlı mesajları ("Bu bülten arşivde bulunamadı.") olduğu gibi kalıyor — bilgi gizlenmiyor, anlaşılır hâle geliyor |
| Backend çökmesi | ✅ Express 4 async route içindeki reddi yakalamıyor; tek bir hata **tüm süreci düşürüyordu** (yayın ortasında API'nin komple gitmesi demek). Yeni `src/security/asyncGuard.js` uçları sarmalıyor, `test/async-guard.test.mjs` kilitliyor |
| **Testler gerçek arşive yazmaya çalışıyordu** | ✅ Altı test dosyası (`api`, `legacy-isolation`, `radar-api`, `radar-dna-boundary`, `radar-empty-screen`, `scorecard-provenance`) geçici klasör için `ARCHIVE_DIR` veriyor ama **sürücüyü sabitlemiyordu**. `getArchiveStore()` Supabase yapılandırılmışsa dosya deposunu değil **Supabase'i** seçiyor — yani `backend/.env` dosyası olan senin makinende `npm test`, **8001/8002 numaralı sahte mühürlü bülteni GERÇEK arşive yazmayı deniyordu**. Arşiv değişmez olması gereken veri. Altısında da `ARCHIVE_DRIVER='file'` sabitlendi; ayrıca sürücüyü doğrulayan bir koruma testi eklendi ki sabitleme kazara kaldırılırsa test kırmızı yansın |
| ↳ Bu ortamda gerçekleşti mi? | ℹ️ **Hayır.** Denetim VM'inde ağ erişimi yok; Supabase çağrıları `fetch failed` ile düşüyor — bu yüzden 8 test kırmızıydı, yazma hiç ulaşmadı. Ancak **ağı olan normal bir terminalde** `npm test` çalıştırıldıysa yazma denenmiş olabilir. Arşivde 8001/8002 numaralı bülten görünüyorsa bunlar test kalıntısıdır; **silme deneme** (arşiv değişmezlik tetikleyicileriyle korunuyor), haber ver |
| ⚠️ Ölçülemeyen ekranlar | ⚠️ `basari-panelim` ve `guvenlik-ayarlari` **oturum açıkken** görünüyor; denetim ortamında Supabase kimlik doğrulaması yok (anahtarlar yalnız senin `backend/.env` dosyanda, bilerek buluta alınmadı) → bu iki ekran **ölçülmedi**. Kusursuz oldukları anlamına **gelmez**. `hafta-kapanisi` yalnız **hata hâlinde** ölçüldü: canlı sportoto.gov.tr gerekiyor, bu ortamdan 403 dönüyor |
| Cihaz eşitlemesi | ✅ Değişen **25 dosya** cihaza yazıldı ve md5 ile iki tarafta karşılaştırıldı — hepsi bire bir aynı. "Yalnız cihazda" değişiklik **yoktu**, yani üzerine yazılan bir çalışman olmadı |

Sayılar: uygulama **175/175** · backend **338/338** (arşiv sürücüsü koruma testi eklendi) ·
web derlemesi ✅. Cihazda doğrulama: uygulama **174 geçti / 1 atlandı** (atlanan test
derlenmiş web çıktısını ölçüyor, cihazda `app/dist` yok — kusur değil), arşiv testleri
cihazda **77/77** (düzeltmeden önce 8'i kırmızıydı).

**Ek 7 (aynı gün, yedinci "devam") — C9 telefon hatırlatması ("onay" ile):**

> **Kapsam sınırı — baştan açıkça:** Bu iş **yalnız cihazın kendi saatiyle
> çalışan yerel hatırlatma** getiriyor. **Sunucudan gönderilen (uzak/push)
> bildirim YOKTUR** ve bu işle gelmedi. Uzak bildirim için Expo push
> belirteci + FCM kimlik bilgileri gerekiyor, onlar da Play Console'a bağlı
> → **E3 blokajı**. Yani telefon, uygulama kapalıyken bile hatırlatabiliyor;
> ama "sunucu sana bildirim gönderdi" diyen hiçbir şey yok.

| Madde | Durum |
|---|---|
| Paket kurulumu | ✅ `expo-notifications 56.0.22` — **senin onayınla** kurulan tek yeni paket. Bağımlılık kapanışı incelendi: 67 paketten cihazda eksik olan yalnız üçüydü (`expo-notifications`, `expo-application`, `badgin`); üçü de kuruldu. Başka hiçbir paket eklenmedi, mevcut sürümler yükseltilmedi |
| Ne zaman çalar | ✅ Yalnız **senin kendi kuponundaki** maç için, başlamadan **60 dk önce**. Bülten maçı kuponunda değilse hatırlatma kurulmaz |
| Uydurma yok | ✅ Başlama saati bilinmeyen maça hatırlatma **kurulmuyor** (saat uydurulmuyor), takım adı eksikse yarım metin yazılmıyor, başlamış/canlı/resmî sonuçlu maça kurulmuyor, geçmiş bir ana **hiç** kurulmuyor. Atlanan her maç sayısıyla raporlanıyor — sessizce yutulmuyor |
| Metin dürüstlüğü | ✅ Bildirim metni sabit biçimde `"<no>. <ev> – <deplasman> · <saat>"`. Tahmin, skor, 1/X/2 seçimi veya "kesin/garanti/banko" dili **yapısal olarak** giremiyor; test bunu biçim kalıbıyla kilitliyor |
| Gizlilik | ✅ Bildirim metnine ve verisine e-posta, belirteç, kullanıcı adı, puan **giremiyor**; test kasten "kirli" kupon verip hiçbirinin sızmadığını doğruluyor. Tercih yeni `sportoto.push.v1` anahtarında — **mevcut hiçbir anahtarın adı değişmedi** |
| **Hesap silinince susuyor** | ✅ Uygularken çıkan gerçek bir açık: yerel veriler siliniyordu ama **işletim sistemine kurulmuş hatırlatmalar duruyordu** — hesap silindikten sonra da telefon çalmaya devam ederdi. Artık silme akışı önce hatırlatmaları iptal ediyor, `LOCAL_KEYS` testi de anahtarı kilitliyor |
| Anahtar yalan söylemiyor | ✅ İzin verilmediyse anahtar "açık" olarak **kaydedilmiyor**. Ekran dört ayrı gerçek durumu ayırıyor: tarayıcı (anahtar hiç çizilmiyor) · izin işletim sisteminden kapatılmış (nereden açılacağı yazıyor) · açık (kurulu hatırlatma **sayısı** yazıyor) · kapalı. "Açık görünüp hiç çalmayan" bir düğme yok |
| Başka bildirimlere dokunmuyor | ✅ İptal/okuma işlemleri yalnız kimliği `mac:` ile başlayan **ve** `kind === 'match-starting'` olan kayıtlara uygulanıyor; başka bir kaynağın bildirimi silinemiyor |
| Ekran metni düzeltmesi | ✅ Bildirim merkezinin alt notu **"telefon bildirimi gönderilmez"** diyordu — bu iş sonrası **yanlış** hâle geldi. Düzeltildi: hatırlatmanın yalnız maç başlangıcı için olduğu ve **cihazın kendi saatiyle** çalıştığı, sunucudan bildirim gönderilmediği yazıyor |
| Dar ekran | ✅ `verify-narrow.mjs`'e **21.** durak olarak `bildirimler` eklendi (bu ekran daha önce hiç ölçülmemişti). 360px'te kart taşmıyor: **19 durak ölçüldü · 0 kusur · 2 atlandı** |
| Cihaz eşitlemesi | ✅ **14 dosya** cihaza yazıldı, md5 ile iki tarafta karşılaştırıldı — hepsi bire bir aynı. Üzerine yazılan çalışman **yok**: yazmadan önce cihazdaki hâller buluta çekilip satır satır karşılaştırıldı, cihazda olup bulutta olmayan tek satır bile kalmadı |
| ⚠️ Eşitlemede yakalanan tuzak | ⚠️ Cihazdaki `app.json` / `package.json`, projenin **ilk günkü Expo şablonu** hâlinde kalmıştı (`"name": "app"`, bağımlılık listesi eksik) — hâlbuki paketler kuruluydu. Yani cihazda `npm install` çalıştırılsaydı **kurulu paketlerin çoğu silinirdi**. Bu üç dosya (kilit dosyası dâhil) artık doğru hâlleriyle cihazda |
| ⚠️ Sürüm notu | ⚠️ Cihazdaki `expo-constants` 56.0.21 ve `@expo/image-utils` 0.10.1, kilit dosyasının söylediğinden bir yama eski. **Çalışmaya engel değil** (Expo yapılandırması ve testler cihazda sorunsuz geçti) ve **bilerek yükseltilmedi** — çalışan paketleri gereksiz oynatmamak için. İnternetli bir `npm install` bunu kendiliğinden hizalar |

Yeni testler: hatırlatma planlayıcı **18 test** (kupon yoksa bildirim yok, saat
yoksa uydurulmuyor, geçmişe kurulmuyor, yalnız kendi kuponun, iddialı dil yok,
kişisel veri sızmıyor, kimlik kararlı, maç saati değişirse eski kayıt iptal) +
hesap silme gizlilik kilidi → uygulama **197/197** · backend **338/338** ·
web derlemesi ✅ · dar ekran **0 kusur**.
**Cihazda doğrulama:** uygulama **196 geçti / 1 atlandı** (atlanan test derlenmiş
web çıktısını ölçüyor, cihazda `app/dist` yok — kusur değil), Expo yapılandırması
`expo-notifications 56.0.22` eklentisini sorunsuz çözüyor.
**Dürüst boşluk:** bu özellik **hiçbir gerçek Android/iOS cihazda denenmedi**;
kanıtlanan şey planlayıcı mantığı, tarayıcıda özelliğin kapalı görünmesi ve
paketin cihazda çözülmesi. Ayrıca cihazda tam web derlemesi **tamamlanamadı** —
araç başına 45 sn sınırı var, derleme daha uzun sürüyor; derleme bulutta
**aynı paket sürümüyle** doğrulandı.

**Ek 8 (26.07.2026) — gerçek Android testi ÇÖKTÜ, kök neden bulundu ve düzeltildi:**

Ek 7'de dürüstçe yazdığımız boşluk ("hiçbir gerçek cihazda denenmedi") gerçek
oldu: telefonda Expo Go SDK 56 içinde Bildirimler ekranı **"Tarayıcıda telefon
bildirimi kurulamaz."** diyordu, aç/kapa anahtarı çizilmiyordu ve Android izni
hiç istenmiyordu. Yani özellik gerçek cihazda **hiç çalışmıyordu**.

| Madde | Durum |
|---|---|
| **Kök neden** | ✅ İki ayrı gerçek tek bir `boolean`'a sıkıştırılmıştı: `isDesteklenir()` = `!isWeb && !!Notifications`. `require('expo-notifications')` **içe aktarma anında hata fırlatıyordu** — paketin ana dosyası uzak/push'a özel alt modülleri de çekiyor, onların `requireNativeModule(...)` çağrıları **modül düzeyinde** çalışıyor ve o yerli modüller (`ExpoPushTokenManager`, `ExpoTopicSubscriptionModule`, `NotificationsServerRegistrationModule`, `ExpoBackgroundNotificationTasksModule`) SDK 53'ten beri **Expo Go/Android'de kayıtlı değil**. Eski `catch { Notifications = null }` bu hatayı sessizce yutuyordu; ekran da `!destek` için "Tarayıcıda…" cümlesini **sabit** yazıyordu. Sonuç: gerçek telefon "tarayıcı" diye teşhis ediliyordu. `appOwnership`, `executionEnvironment`, `isRunningInExpoGo`, `isDevice` **hiçbiri kullanılmıyor** — karar yalnız gerçek platform + yerel bildirim API'sinin çalışırlığına bakıyor |
| Modül yükleme | ✅ İki aşamalı: önce normal paket denenir; hata verirse **9 alt yol tek tek** içe aktarılır (izin, zamanlama, iptal, listeleme, kanal, işleyici, yayıcı, tipler). Yerel bildirim için gereken beş yerli modül Expo Go'da **var**; yalnız push'a özel olanlar yok — bu yüzden parçalı yükleme çalışıyor |
| Dürüst teşhis | ✅ Ortam beş gerçek duruma ayrıldı: `web` · `hazir` · `modul-yok` · `modul-hata` · `api-eksik`. "Tarayıcıda kurulamaz" cümlesi artık **yalnız gerçekten web'de** üretilebiliyor; modül hatasında ekranda gerçek teknik satır ve "bu bir tarayıcı sınırı değil" notu görünüyor |
| İzin akışı | ✅ Anahtara basınca Android izin ekranı çıkar. Reddedilirse anahtar **açık görünmez** ve "Ayarları aç" düğmesi belirir. İzin sonradan telefon ayarlarından kapatılırsa uygulama öne gelince (`AppState` + ekran odağı) durum **kendiliğinden düzelir**, tercih kapatılır ve kurulu hatırlatmalar iptal edilir |
| İşletim sistemi kabul etmezse | ✅ Zamanlama sonrası kayıtlar **geri okunuyor**; kurulmayan bildirim için "kuruldu" **denmiyor**, ekran eksik olduğunu söylüyor. Kimlikler maç numarasıyla bağlı (`mac:<hafta>:<no>`) → tekrar çalıştırınca **çoğalmıyor**, aynı maç iki kupondaysa **tek** hatırlatma kuruluyor |
| Test bildirimi | ✅ Yalnız hatırlatma açıkken görünen "🔔 Test bildirimi gönder": **aynı gerçek kanal ve aynı zamanlayıcı**, **1 dakika** sonrası. Metin sabit: "Test bildirimi başarıyla çalıştı." İçinde tahmin, seçim, skor, puan, e-posta veya kullanıcı verisi **yok** (test 20 yasak alan adını JSON üzerinde tarıyor). Dokunulunca Bildirimler ekranı açılır; gerçek maç hatırlatmasının davranışı (maçın canlı detayına gitme) **değişmedi** |
| Kapsam | ✅ Yalnız bildirim ortamı, izin, zamanlama ve Bildirimler ekranı. Bülten, Radar, Master Analiz, arşiv, snapshot, profil, puan ve kupon hesaplama **hiç ellenmedi**. Depolama anahtarları değişmedi |
| Testler | ✅ **46 yeni test** (`app/test/push-env.test.mjs`): gerçek Android web sayılmıyor · izin reddinde anahtar kapalı · izin geri alınınca ekran düzeliyor · tek zamanlama · maç kuponda yoksa iptal · saat değişince yeniden kurulum · hesap silme/çıkışta temizlik · test bildiriminde kişisel veri yok. Ayrıca **paket bütünlüğü** testleri: her alt yol kurulu pakette gerçekten çözülüyor, o yolların içe aktarma ağacında **yasak yerli modül yok**, ve ana dosyanın hâlâ yasak modül çektiği ayrıca kanıtlanıyor (kök neden nöbetçisi) |
| Doğrulama | ✅ uygulama **243/243** · backend **338/338** · `expo export --platform web` ✅ · `expo export --platform android` ✅ (bu ikincisi kritik: Metro'nun 9 alt yolu **android çözümlemesiyle** bulduğunu kanıtlıyor) |
| ⚠️ Dürüst boşluk | ⚠️ Bunların hepsi **bulut/birim sonucu**; gerçek telefonda çalıştığını **kanıtlamaz**. Doğrulama, senin 1 dakikalık cihaz kontrolünle yapılacak |

**Ek 9 (27.07.2026) — bildirim GELİYOR ama dokununca ANA SAYFA açılıyordu:**

Gerçek Android testi bu kez **yarı yarıya geçti**: bildirim telefona düştü ✅,
fakat dokunulunca Bildirimler ekranı yerine **ana sayfa** açıldı ❌.

Bir düzeltme: senin tahminin ("test bildirimi yönlendirme bilgisi taşımıyor")
**bu kez isabetli değildi**. Bildirim verisi baştan beri doğruydu ve telefona
bozulmadan ulaşıyordu; sorun verinin **okunduğu andaydı**.

| Madde | Durum |
|---|---|
| **Kök neden** | ✅ Dokunma dinleyicisi `if (!data?.tab \|\| !navRef.current) return;` ile başlıyordu. `navRef` yalnız `NavigationContainer` **bağlıyken** dolar; oysa uygulama açılırken önce **açılış ekranı** (en az 1200 ms + oturum yükleme), gerekiyorsa **biyometrik kilit** çiziliyor — bu iki durumda `NavigationContainer` **hiç mount edilmemiş** oluyor. Bildirimle açılan her başlangıçta dokunma tam da o pencerede geliyor, `navRef` boş olduğu için **sessizce düşüyor** ve kullanıcı varsayılan sekmede (ana sayfa) kalıyordu. İkinci ve ayrı bir eksik: uygulama **tamamen kapalıyken** dokunma, JS dinleyicisi var olmadan önce yerli katmanda yakalanıyor — dinleyici o dokunma için **hiç çalışmıyor** |
| Bekleyen hedef | ✅ Dokunulan bildirim artık kuyrukta **bekliyor**; `NavigationContainer` bağlanır bağlanmaz (`onReady`) uygulanıyor. Biyometrik kilit açıldığında konteyner yeniden bağlandığı için aynı kancadan geçiyor — yani **açıkken, arka planda ve tamamen kapalıyken** aynı yol işliyor |
| Kapalı uygulama | ✅ Açılışta `getLastNotificationResponse()` okunuyor ve **okuduktan sonra temizleniyor**; temizlenmeseydi aynı dokunma sonraki her normal açılışta da kullanıcıyı o ekrana atardı |
| Hedef seçimi | ✅ Rota bildirimin **`kind`** alanından türetiliyor (`test-notification` → Bildirimler, `match-starting` → o maçın canlı detayı). Bildirimin içindeki serbest `tab`/`screen` metni **gezinmeyi sürükleyemiyor** — tanınmayan bir bildirim uygulamayı hiçbir yere götüremez |
| Maç bulunamazsa | ✅ Üç durumlu karar: maç bültende **yok** ya da numara geçersiz → **Bildirimler** ekranı (yanlış maç ya da ana sayfa **açılmaz**); bülten **henüz yüklenmediyse** maç detayına gidilir, o ekran kaydı bulamazsa kendi dürüst hatasını gösterir. Hedef **en geç anda** çözülüyor: dokunma beklerken bülten yüklenirse yeni bilgi kullanılıyor |
| Gizlilik | ✅ Taşınan tek alan **maç numarası**. Tahmin, kupon seçimi, e-posta, kullanıcı ya da oturum bilgisi yok. Yönlendirme için tutulan bilgi de yalnız bültendeki **maç numaraları** (zaten herkese açık) |
| Korunanlar | ✅ İzin akışı, 60 dakika önce hatırlatma, tekilleştirme (`mac:<hafta>:<no>`), iptal ve çıkış/hesap silme temizliği **hiç değişmedi** (test F7 bunu ayrıca bekçiliyor). Uygulamanın diğer bölümlerine dokunulmadı; depolama anahtarları aynı |
| Değişen dosyalar | ✅ Yeni: `app/src/pushRoute.js` (saf modül), `app/test/push-route.test.mjs`. Düzenlenen: `app/App.js` (bekleyen hedef + `onReady`), `app/src/services/pushService.js` (`sonYanitVerisi` / `sonYanitiTemizle`), `app/src/pushSync.js` (yalnız açıklama satırı) |
| Testler | ✅ **31 yeni test**: doğru ekran adları · bulunamayan maç → Bildirimler · geçersiz numara → Bildirimler · yabancı bildirim gezinme yaptırmıyor · hazır değilken gelen dokunma kaybolmuyor · **tek kez** uygulanıyor · geç çözümleme · kişisel veri yok · `App.js`/`pushService.js` bağlantı nöbetçileri · eski hatalı erken çıkışın geri gelmediğini kanıtlayan kök neden nöbetçisi |
| Doğrulama | ✅ uygulama **273/274** (1 atlanan, eskiden beri) · backend **338/338** · `expo export --platform web` ✅ · `expo export --platform android` ✅ |
| ⚠️ Dürüst boşluk | ⚠️ Hepsi yine **bulut/birim sonucu**. Gerçek telefonda doğru ekranın açıldığını **kanıtlamaz**; bunu ancak senin cihaz denemen gösterir |

**Ek 10 (28.07.2026) — gerçek maç yönlendirmesini beklemeden kanıtlama
(yalnız geliştirme):**

Test bildirimi gerçek Android cihazda **üç durumda da** doğru ekranı açtı
(açıkken, arka planda, tamamen kapalıyken) ✅. Geriye **gerçek maç
hatırlatmasına dokununca o maçın detayının açıldığını** görmek kaldı. Üretimde
o bildirim maçtan **60 dakika önce** düştüğü için doğrulama saatler alırdı;
bu yüzden Bildirimler ekranına **yalnız geliştirme derlemesinde görünen** bir
"⚽ Maç hatırlatmasını test et" seçeneği eklendi.

| Madde | Durum |
|---|---|
| Gerçek maç | ✅ Güncel bültendeki **başlamamış, saati ve takımları bilinen en yakın** maç seçiliyor. Başlamış / canlı / resmî sonucu gelmiş maç kullanılmıyor |
| Uydurma yok | ✅ Bülten okunamazsa **"bulten-yok"**, uygun maç kalmadıysa **"mac-yok"** deniyor; sahte maç, sahte saat, sahte takım **üretilmiyor**. Uygun maç yoksa cihaza **hiç dokunulmuyor** (kanal bile kurulmuyor) |
| Aynı üretim akışı | ✅ Bildirimin başlık/gövde/verisi artık **tek kaynaktan** üretiliyor (`pushPlanner.macBildirimIcerigi`); üretimdeki 60 dakikalık hatırlatma ile geliştirme testi **aynı işlevi** çağırıyor. Tür de aynı: `match-starting`. Yani testte telefona düşen bildirim, üretimdekinden **başka bir yoldan** üretilmiş olamıyor |
| Ayırt edilebilirlik | ✅ Yalnız **başlık** "Geliştirme testi: maç birazdan başlıyor" diyor; gövde ve yönlendirme verisi **birebir** üretimdeki gibi. Yönlendirmeyi zaten başlık değil, verideki `kind` alanı belirliyor → kanıt zedelenmiyor, ama gerçek hatırlatmayla **karıştırılamıyor** |
| Yönlendirme | ✅ Dokunulunca **seçilen maçın detay ekranı** (`BulletinTab › LiveMatchDetail`, `params.no`). Ek 9'daki bekleyen-hedef düzeni kullanıldığı için **açıkken, arka planda ve tamamen kapalıyken** aynı yol işliyor — yeni bir bildirim sistemi kurulmadı |
| 60 dakika düzeni | ✅ **Değişmedi.** Test kaydı ayrı bir kimlik taşıyor (`test:mac`), `mac:<hafta>:<no>` ailesine **girmiyor**; bu yüzden eşitleme (`diffSchedule`) onu ne kuruyor ne siliyor, "Kurulu hatırlatma: N" sayısına da karışmıyor. (Kimlik `mac:` ile başlasaydı ilk eşitleme test bildirimini **sessizce iptal ederdi**.) Bildirim tamamen kapatılınca yine de temizleniyor — geride kayıt kalmıyor |
| Gizlilik | ✅ Bildirimde yalnız **maç numarası, takım adları ve saat**. Bu yolda **kupon verisi hiç okunmuyor**; tahmin, kupon seçimi, kullanıcı, e-posta, oturum bilgisi taşınmıyor (testler bunu ayrıca bekçiliyor) |
| Dürüst durum | ✅ "Kuruldu" demeden önce kayıt **cihazdan geri okunuyor**. İzin yoksa, işletim sistemi zamanlamayı kabul etmediyse ya da uygun maç yoksa ekran **nedenini açıkça yazıyor**. İki kez basılınca bildirim **çoğalmıyor** (aynı kimlik, önce eski kayıt siliniyor) |
| Yayın kapısı | ✅ Kapı **iki katmanlı**: `__DEV__` doğrudan okunuyor (Metro yayın derlemesinde `false` gömüyor, küçültücü bölümü **paketten atıyor**) + ortak `gelistirmeKipi()`. **Ölçüldü:** üretim web paketinde "Maç hatırlatmasını test et" metni **hiç yok** |
| Dokunulmayanlar | ✅ Bülten, Radar, Master Analiz, profil, kupon hesaplama ve arşiv sistemleri **değişmedi**; depolama anahtarları aynı |
| Değişen dosyalar | ✅ Yeni: `app/src/pushDevTest.js` (saf modül), `app/test/push-dev-test.test.mjs`. Düzenlenen: `app/src/pushPlanner.js` (içerik tek kaynağa taşındı — davranış aynı), `app/src/pushSync.js`, `app/src/services/pushService.js`, `app/src/screens/NotificationsScreen.js` |
| Testler | ✅ **40 yeni test**: gerçek maç seçimi · başlamış/canlı/resmî maç atlanıyor · dürüst nedenler · içerik üretimle **birebir aynı** · rota = o maçın detayı · kimlik yalıtımı (eşitleme dokunmuyor, sayıma karışmıyor, "hepsini sil" temizliyor) · gizlilik · 60 dakika düzeni korunuyor · yayın kapısı · izin yok / OS kabul etmedi / iki kez basma |
| Doğrulama | ✅ uygulama **314/315** (1 atlanan, eskiden beri) · backend **338/338** · `expo export --platform android` ✅ · `expo export --platform web` ✅ |
| ⚠️ Dürüst boşluk | ⚠️ Hepsi yine **bulut/birim sonucu**. Bildirime dokununca gerçek telefonda **doğru maçın** açıldığını **kanıtlamaz**; bunu ancak senin cihaz denemen gösterir. Doğru maç açılmadan bu özellik **bitmiş sayılmıyor** |

## D-EK. YAYIN STÜDYOSU — yayıncı geri bildirimi (26.07.2026)

Yukarıdaki A/B/C listesinden ayrı bir koldur: stüdyo ekranları ilk geçişten
sonra senin verdiğin **altı** geri bildirimle yeniden ele alındı. Tam kayıt
(karar gerekçeleri, değişen dosyalar, ölçüm sayıları, dürüst boşluklar)
`05-YAYIN-KONTROL-LISTESI.md` → **"Stüdyo ikinci geçişi"** başlığında. Burada
yalnız denetim özeti var:

| Geri bildirim | Durum |
|---|---|
| "sistem tahmin vermesin" | ✅ Motor stüdyoda **1-0-2 seçimi vermiyor**. `userMatchEngine.js` her kriteri `fact` (ölçülen gözlem) ve `lean` (bunun 1-0-2'ye etkisi) olarak ayırdı; yayıncı ekranı **yalnız `fact`** gösteriyor. Panel adı "Sistem Önerisi" → **"Motor Okuması"**. Birleşik `note` metni harfi harfine aynı üretildiği için Maç Detayı / Radar / Master Analiz ekranları **değişmedi** |
| "güven seviyesi düşürüldü … elimizde veri yok" | ✅ Eksik oyuncu/teknik direktör verisine dayanan güven düşürme cümlesi kaldırıldı — olmayan veriye atıf yapılmıyor |
| "bunlar kafa karıştırıyor" (`Bülten sırası: 5` · `DİKKAT` · `Temkinli`) | ✅ Rozet satırı stüdyodan tamamen kaldırıldı |
| "yayıncı ana sayfası bu şekilde olmalı + kayıtlı kalmalı" | ✅ Ana sayfa **resmî sonuç tablosu** düzeninde (tablo + sağda özet paneli); geçmiş hafta karnesi kalıcı: maç maç senin seçimin vs resmî sonuç · "15'te X" · resmî ikramiye tablosu · haftalar arası birikimli karne. Yeni ekran `StudioKarneScreen.js` |
| "teması yapay zeka olduğu çok belli, fontlar/yazılar çok büyük" | ✅ Dört stüdyo ekranı da gömülü **Barlow Semi Condensed** ve "resmî bülten tablosu" yoğunluğunda. Font **önkoşul değil**: hazır olana kadar `fontOf()` boş stil döndürür, ekran çizilir, font gelince yeniden çizilir. Süs emojileri (💬📈⚠) kaldırıldı, anlam taşıyan 🔒 kaldı; rakamlar `tabular-nums`; yazı boyutu tek kaynaktan (`T(k)`) |
| "takım logoları da olsun" | ✅ `TeamCrest` ile arma; arma yoksa ⚽ (uydurma logo yok) |
| "sistem güvenli riskli vs yazmasın" (yayıncı modu) | ✅ **Tamamen kaldırıldı** (senin seçtiğin kapsam). Giden: kupondaki **TOPLAM RİSK** kutusu/çubuğu, **"En Riskli Maçlar"** paneli, maç ekranındaki **"Risk Yorumu"** paneli, **"Risk sinyali"** ve **"Veri güveni"** çipleri, bültendeki risk özet satırı ve **seviye rozetleri**. Seviye rozeti bileşeni (`LevelBadge`) ile seviye→renk eşlemesi (`toneOfLevel`/`toneSoftOfLevel`) **kod tabanından silindi** — çağrılacak bir bileşen kalmadığı için kazara geri eklenemez. İkincil "Sunum" rotasındaki "Temkinli bir hafta." cümlesi de aynı sebeple çıktı |
| ↳ Hesap ne oldu? | ✅ **Silinmedi.** Ölçüm `broadcastStudio.js` içinde 61 testiyle duruyor; yalnız yayıncı modunda **çizilmiyor**. İleride geri istersen sıfırdan yazılmayacak |
| ↳ Yerine ne yazıyor? | ✅ Bültenin ANALİZ sütunu artık **hüküm değil sayım**: o maç için **kaç veri kaynağı bulunduğu** (`N kaynak`, hiç yoksa `Veri yok`). Sayı ekranda hesaplanmaz, bulunan kaynak listesinin uzunluğudur. Alt açıklama bunun **"bir değerlendirme değildir; motor 1-0-2 önermez"** olduğunu yazıyor. Silinen panelin içindeki nötr bilgi (seçimin türü: Tek/Çift/Kapalı) kaybolmadı, maç ekranının başlık satırına taşındı |
| ↳ Geri sızmasın diye | ✅ **İki katmanlı kilit.** (1) Kaynak taraması: yeni `studio-no-verdict.test.mjs` (**13 test**) sekiz yayıncı dosyasını tarıyor — silinen bileşenler yok, ölçüm fonksiyonları çağrılmıyor/içe aktarılmıyor, yasak sözcük yok, **ölçümün kendisi ise hâlâ yerinde**. (2) Canlı denetim: `render-studio.mjs` gerçek tarayıcıda çizilen metni tarıyor (dört ekran da), böylece sözcük bir **veri alanından** gelirse de yakalanır. İki listenin ayrışmaması ayrıca sınanıyor. Kilit **bilerek bozularak** ölçüldü: bir ekrana "güvenli" yazınca test düştü, geri alınca 13/13 |
| Paket kuralı | ✅ Yalnız **onayını aldığım** iki paket: `expo-font` + `@expo-google-fonts/barlow-semi-condensed`. Başka paket eklenmedi |
| Paket boyutu (sonradan yakalandı) | ✅ Android paketini ölçünce çıktı: font paketinin **kökünden** içe aktarma, ailenin **18 kesimini de** uygulamaya gömüyordu (1.833 KB) — biz **4** kesim kullanıyoruz. `studioFonts.js` kesim başına alt yola çevrildi: **4/4 kesim, 400 KB**, indirme **~1,4 MB** küçüldü. Yeni `studio-fonts.test.mjs` (8 test) bunu kilitliyor; kilidin tuttuğu **kaynağı bilerek bozup** ölçüldü (3 test düştü, geri alınca 8/8) |
| Doğrulama (bulut) | ✅ Uygulama **534 test · 533 geçti / 0 kaldı / 1 atlandı** · web paketi **200** · `expo export` **android ✅** · `verify:render` **47/47**, "KOD HATASI: yok" |
| Doğrulama (derlenmiş paket) | ✅ Android paketinin **kendi içinde** arandı (Hermes dizeleri UTF-16 saklandığı için bayt düzeyinde): "Toplam Risk", "En Riskli Maçlar", "Risk Yorumu", "Veri güveni", "Temkinli bir hafta" → **0 kez**. Kalması gerekenler yerinde: "bir değerlendirme değildir", "motor 1-0-2 önermez", "Kolon sayısı", "Veri yok" |
| Doğrulama (senin makinen) | ✅ 20 kaynak dosya + font paketi kopyalandı, **20/20 md5 birebir aynı**; aynı testler senin klasöründeki dosyalara karşı da koştu: **521/520** *(bu satır font geçişine aittir)* |
| Doğrulama (senin makinen — hüküm kaldırma) | ✅ Değişen **10 dosya** senin klasörüne yazıldı, **10/10 md5 birebir aynı**. Testler senin dosyalarının üzerinde koştu: **534 test · 533 geçti / 0 kaldı / 1 atlandı**, çıkış kodu **0**; yeni kilit suiti ayrıca tek başına **13/13**. Atlanan tek test hazır web derlemesi ister, tasarımı gereği atlanır. Senin kopyanda yasak sözcük taraması: sekiz yayıncı dosyasında kalan tüm eşleşmeler **açıklama satırı** (kaldırmayı anlatan notlar), çizilen metinde **sıfır** |
| ⚠️ Dürüst boşluk | ⚠️ Yukarıdakilerin hepsi **bulut/birim ve masaüstü** sonucu. Stüdyo akışı **gerçek telefonda hiç denenmedi** — bu deneme yapılmadan "yayında çalışıyor" sayılmaz |
| ⚠️ Dürüst boşluk | ⚠️ "Güvenli/riskli yazmasın" kuralı **yalnız yayıncı modunda** uygulandı — senin tarif ettiğin kapsam buydu. **Master Analiz / Karar Motoru** yolunda (`decisionEngine.js`, `analysis/engine.js`, `DecisionEngineView.js`, `RadarCenterCards.js`, `RadarScreen.js`, `MatchDetailScreen.js`, `WeekSummaryScreen.js`) "Güvenli kupon", "Veri Güvenliği", "Risk sinyali", "🟡 Temkinli" ifadeleri **duruyor**. Aynı temizliği orada da istersen ayrı bir iş olarak yapılır. (Hesap ayarları ekranlarındaki "Güvenlik Ayarları" bir hüküm değildir, kapsam dışıdır) |
| ⚠️ Dürüst boşluk | ⚠️ Karnenin **resmî sonuç** yolu bu ortamda gerçek `/api/history` ile ölçülemedi (sandık dışarı çıkamıyor, 502). Sahte veri uygulamaya/depoya **yazılmadı**; yalnız tarayıcı testi sırasında geçici bir yanıt taklidiyle ekran çizimi doğrulandı |

## D-EK2. TAKIM ARMASI — "eşleşmeyen logo" önlemi

> Senin sözün: *"bülten yeni açıklandı ve takım logoları eşleşmeyenler var …
> eşleşmeyen logo takım isimleri için önlem almamız lazım."*

| Başlık | Durum |
|---|---|
| **Kök neden** | ✅ Arma, **fikstür eşleşmesinin yan ürünüydü**. `stats[side].logo` yalnız `findFootyMatch` tuttuğunda doluyordu; tek bir maç eşleşmeyince o maçın **iki takımının da** arması boş kalıyordu — kulübün arması kaynaktan çekilmiş olsa bile. Yani "bu maçı eşleştiremedim" ile "bu kulübün armasını bilmiyorum" **aynı soru sanılıyordu**; oysa ayrı sorular |
| **Ölçüm (senin 1526 bültenin)** | ✅ 15 maç · 30 arma yeri: **24 dolu / 6 boş**. Altı boşluğun tamamı üç maçtan geliyor: #1 Club Brugge–Union St.Gilloise, #4 PSV Eindhoven–AZ Alkmaar (bu ikisinde **birer taraf** kaynakta yok), #14 Porto–Uniao Torreense (**iki taraf da kaynakta var**, yalnız fikstür eşleşmedi). `snapshot-1526.json` da aynı altı boşluğu gösteriyordu |
| **Önlem** | ✅ Yeni `backend/src/crestRegistry.js`: kalıcı **arma kayıt defteri**. Her yenilemede kaynağın sezon takım listelerindeki armalar deftere işleniyor (`refresh.js` 2a bloğu), bülten maçlarına fikstürden **bağımsız** iliştiriliyor (3a bloğu). Defter cache'te kalıcı: bir lig sonraki haftalarda kapsam dışına düşse bile o kulüplerin arması korunuyor |
| **Sıra** | ✅ 1) maçın kendi kaynak eşleşmesi (en kesin) → 2) arma defteri → 3) hiçbiri yoksa **boş** (nötr ⚽). Yeni bir görsel icat edilmedi |
| **Dürüstlük kuralı koda gömüldü** | ✅ *"başka kulübün arması veya 'benzeri' bir görsel ASLA konmaz."* Defter **varsayılan-ret**: aynı normalize ada farklı kimlikli + farklı armalı birden çok kulüp denk gelirse arma **verilmez**. Bir katman aday üretiyorsa karar orada verilir; belirsizse reddedilir, **daha gevşek katmana inilmez** ("gevşeterek bir şey bulmak" yasak) |
| **Gerçek veriyle yakalanan yanlış arma** | ✅ İlk sürüm `matcher.js`'in `sideMatches` katmanlarını yeniden kullanıyordu. Senin bülteninle denenince **yanlış arma** çıktı: bülten takımı **"Porto"**, Polonya kulübü `…klub-**sporto**wy-wieczysta-krakow` armasına bağlandı — logo katmanı ham "içeriyor mu" baktığı için *sportowy* kelimesinin içindeki *porto* eşleşme sayılıyordu. Fikstürde zararsız (orada **iki taraf + ±4 gün** koşulu var), takım başına **felaket** |
| **Düzeltme** | ✅ Defter kendi **sıkı merdivenini** kullanıyor: `exact` (birebir ad/alias) → `contain` (**yalnız uçtan** kapsama: "KGHM Zaglebie Lubin" ⊇ "Zaglebie Lubin") → `slug` (ad, arma adresinin **ardışık parçalarına** birebir oturmalı; ülke öneki ve jenerik parça tek başına sayılmaz) → `token` (**en az iki** ayırt edici kelime). Kelime/parça sınırına oturmayan hiçbir benzerlik kanıt değil. Ayrıca **sürüm işareti** kuralı: A takımı ≠ B takımı ≠ kadın takımı ≠ altyapı — birebir ad dışındaki katmanlarda iki tarafın işaretleri aynı olmak zorunda ("Porto" ile "Porto B" hiçbir katmanda buluşamaz) |
| **Testler** | ✅ Yeni `backend/test/crest-registry.test.mjs` — **21 test**, aralarında: fikstür tutmasa da arma çizilir · belirsizlikte arma yok · Porto ≠ Porto B · kadın takımı arması erkek takımına verilmez · **regresyon: "Porto" içinde *porto* geçen Polonya kulübünün armasını almaz** · lig kapsam dışına düşse de arma korunur · resmî bülten takım nesnesi değiştirilmez (imza/teyit akışı korunur) |
| **Ekran tarafı** | ✅ `app/src/utils.js` içine tek okuma noktası (`crestOf`): önce maçın kendi arması, yoksa defterden gelen. On çağrı yeri buna çevrildi. Karar **backend'de** veriliyor, ekran yalnız okuyor |
| **Doğrulama (bulut)** | ✅ Backend **507 test · 475 geçti / 0 kaldı / 32 atlandı** · uygulama **534 test · 533 geçti / 0 kaldı / 1 atlandı** · web paketi **200** · `verify:render` **47/47**, "KOD HATASI: yok" |
| **Doğrulama (senin makinen)** | ✅ Değişen **9 dosya** klasörüne yazıldı, **9/9 md5 birebir aynı**. Backend testleri senin dosyaların üzerinde **39/39 dosya, 0 kaldı**; uygulama testleri **534 test · 533 geçti / 0 kaldı**. (Üç backend dosyası köprünün 45 sn sınırında ilk turda yetişmedi — sebebi veritabanına ulaşamayan ~7 sn'lik bekleyişlerdi; veritabanı ortam değişkeni boşaltılarak tek tek koşturuldu, **9/9 · 16/16 · 8/8** geçti) |
| ⚠️ Dürüst boşluk | ⚠️ **Kaç armanın gerçekten kurtulacağı canlı yenilemeden önce ölçülemez.** Bu ortamda kaynağa ağ erişimi yok; benim yaptığım deneme yalnız bültenin içine gömülü lig tablolarından kurulabildi (62 kulüp) ve o havuzda zaten Brugge/PSV/Porto/Torreense **yok** — yani deneme bir **alt sınır**. Beklentim: `season.teams` havuzunda bulunan **4 takım** (Club Brugge, PSV Eindhoven, Porto, Uniao Torreense) armasına kavuşur; **Union St.Gilloise ve AZ Alkmaar kaynakta hiç olmadığı için ⚽ kalır** — adresleri **tahmin edilmeyecek**, kapsam raporunda adlarıyla listelenecek. Kesin sayı `npm run refresh` sonrası günlükte yazacak |
| ⚠️ Dürüst boşluk | ⚠️ Defter **ilk canlı yenilemede** dolar. O yenileme yapılana kadar arma tablosu bugünküyle aynı kalır |

## D2. ÖNCELİK SIRASI (kalanlar için önerim)

Yukarıdaki A, B ve C listelerinin neredeyse tamamı ✅ durumda; stüdyo kolu da
(D-EK) senin beş geri bildiriminin tamamını kapattı. **Gerçekten kalan** iş şu
üç başlık:

1. **A7 — kupon maliyeti.** Kod tarafı hazır; eksik olan tek şey **resmî birim
   kolon bedeli**. Bu sayı **uydurulmayacak ve koda gömülmeyecek**; sen
   söylediğinde `backend/data/coupon-pricing.json` içine yazılır (kolon sayısı
   2.500 sınırını aşmaz kuralı zaten kodda).
2. **C9 — telefon bildirimi.** Yerel kısmın kodu bitti (Ek 7), gerçek Android
   testinde çöktü, kök nedeni bulunup düzeltildi (Ek 8); ikinci denemede
   bildirim **geldi** ama dokununca ana sayfa açıldı, onun da kök nedeni
   bulunup düzeltildi (Ek 9). Üçüncü denemede **test bildirimi üç durumda da**
   doğru ekranı açtı ✅. **Kalan tek adım gerçek maç yönlendirmesi** — bunun
   için 60 dakika beklemeden deneyebilesin diye geliştirme kipinde "Maç
   hatırlatmasını test et" seçeneği eklendi (Ek 10). Doğru **maç** açılmadan
   özellik "çalışıyor" sayılmıyor. **Kapsam dışı kalan kısım uzak (sunucudan gönderilen)
   bildirim** — Expo push belirteci + FCM kimlik bilgileri gerekiyor, ikisi de
   Play Console'a bağlı → aşağıdaki **E3** çözülmeden yapılamaz. Bu yüzden
   "bildirim gönderelim" türü hiçbir söz verilmiyor.
3. **§E blokajları** (`05-YAYIN-KONTROL-LISTESI.md`) — mağazaya çıkış için
   senden gelmesi gerekenler: üretim HTTPS API adresi (E1), `SUPPORT_EMAIL`
   (E2), Play Console + imzalama anahtarı (E3), `com.emrahanlar.masteranaliz`
   paket adı onayı (E4), marka vekili sorusu (E6), isim kararı (E7), "Kupon"
   kelimesi kararı (E8), moderasyon aracı onayı (E9), mağaza ekran görüntüleri
   ve öne çıkan görsel (E10).

Ayrıca ölçülemeyen iki ekran (`basari-panelim`, `guvenlik-ayarlari`) bir kez
**oturum açık** durumda taranmalı — Supabase anahtarları senin makinende
olduğu için bu tarama orada yapılmalı, bu ortamda yapılamaz.

Bir de **gerçek cihaz denemesi** bekleyen iki akış var: C9'un maç yönlendirmesi
ve **stüdyonun tamamı** (D-EK). İkisi de kod tarafında bitti, ikisi de yalnız
senin telefonunda kanıtlanabilir; o deneme yapılmadan hiçbiri "yayında
çalışıyor" diye yazılmayacak.

Tüm çalışmalarda değişmez kurallar geçerli kalır: dürüstlük ilkeleri, mühür
bütünlüğü, "kesin/garanti/banko" dili yasağı, bahis/ödeme yok, depolama
anahtarları değişmez.
