# Dersler

Kullanıcıdan gelen düzeltmelerden çıkarılan kurallar. Oturuma başlarken **önce
burası okunur.** Amaç aynı hatayı ikinci kez yapmamak.

Biçim: **Kural** → *Neden* (hangi gerçek olay) → *Nasıl uygulanır*.

---

## 1. Bahis sitesi adı hiçbir yerde geçmez

**Kural:** Nesine, Bilyoner, Misli, Oley, İddaa gibi adlar ekranda, HTTP
yanıtında, log'da — hiçbir yerde görünmez.

**Neden:** Kullanıcı iki kez uyardı ("bu kadar araştırma yaptık", "site ismi
hiçbir yerde geçmeyecek, bu zor mu"). İlk seferinde adları maç satırından
kaldırıp başlıktaki lejanta geri koymuştum. İkinci seferinde
`PROVIDER_NAMES[s] || s` yazmıştım — bilinmeyen bir değer geldiğinde ham
anahtarı ekrana basıyordu.

**Nasıl uygulanır:** Kaynak kimliği dışarıya `k1`/`k2`/`k3` kodlarıyla çıkar
(`backend/src/providers/kaynakKodu.js`). Arayüzde renk adı kullanılır. Bir
eşleme fonksiyonunda **asla `|| s` benzeri ham geri düşüş yazılmaz** —
bilinmeyen değer `k0`'a düşer. Bunu `app/test/bahis-sitesi-adi.test.mjs`
koruyor.

---

## 2. Onay bekleme — iş istendiği anda başla

**Kural:** Ekran değişikliği dahil, istenen iş sorulmadan yapılır. Adım adım
yönlendirme istenmez. Belirsizlikte makul olan seçilir, seçim tek satırla
söylenir ve devam edilir.

**Neden:** Bir dönem "başla demeden başlama" kuralı vardı; kullanıcı
**2 Ağustos 2026'da iptal etti**: "bunu iptal et, doğrudan düzelt, yönlendirme
isteme." Onay beklemek işi yavaşlatıyordu ve kod zaten geri alınabilir.

**Nasıl uygulanır:** Bkz. CLAUDE.md → "SINIR: otonomluk nerede biter". Tek
istisna geri alınamaz/dışa dönük işler: push, deploy, paket kurma, silme,
dışarıya mesaj, para harcama.

---

## 3. Komutları kullanıcı çalıştırmaz

**Kural:** Sunucu yeniden başlatma, test koşturma, cache yenileme gibi işler
kullanıcıya bırakılmaz; kendim yaparım.

**Neden:** "kanka ben yapmıyorum sen yapacaksın" — backend'i yeniden
başlatmasını istemiştim.

**Nasıl uygulanır:** Rapor sonunda "şunu çalıştır" yazmadan önce sor: bunu ben
çalıştırabilir miyim? Çalıştırabiliyorsam çalıştırırım. Yalnız kullanıcının
sahip olduğu kararlar (hesap, ödeme, imza) ona bırakılır.

---

## 4. Sessiz hata yazılmaz

**Kural:** Bir işlem başarısız olursa `console.warn` deyip geçilmez; durum
kaydedilir ve işlem "başarılı" sayılmaz.

**Neden:** Bir sezon çekimi düştüğünde `refresh.js` sadece konsola yazıp
geçiyordu; `ok: true` bitiyordu. Kullanıcı ekranda "6 maçta veri yok" gördü,
sistem kendini başarılı sanıyordu. O çalıştırmanın çıktısı hiçbir yerde
durmadığı için **neden düştüğü hâlâ bilinmiyor**.

**Nasıl uygulanır:** Yutulan hata, durum dosyasına/log'a kalıcı yazılır ve
özet sayaca yansır. Sessizce eksilen veri, gürültülü hatadan tehlikelidir.

---

## 4b. Kaynağı yakma — yenilemeyi arka arkaya çalıştırma

**Kural:** `npm run refresh` bir teşhis aracıdır, döngüde çalıştırılmaz. Her
çalıştırma 57 sezon çeker; kota saatliktir.

**Neden:** 2 Ağustos 2026'da takım fikstürü üzerinde çalışırken yarım saat
içinde beş kez yenileme çalıştırdım. FootyStats **HTTP 429** dönmeye başladı,
57 sezonun hepsi düştü ve dolu bülten (14/15) **tamamen boş** bültenle
(0/15) ezildi. Kullanıcının uygulaması verisiz kaldı ve kotanın açılması
saatler sürdü.

**Nasıl uygulanır:**
- Kod değişikliğini önce TESTLE doğrula; canlı yenileme en sona bırakılır.
- Aynı veriyi tekrar görmek gerekiyorsa cache'ten oku, kaynağa gitme.
- 429 görürsen ISRAR ETME — daha çok istek sınırı uzatır.

---

## 5. Düzeltmenin çalıştığı, bozarak kanıtlanır

**Kural:** Yazılan test, düzeltme geri alındığında KIRMIZIYA dönmelidir.
Dönmüyorsa test boştur.

**Neden:** Sekme koruma testim, düzeltme geri alınınca da yeşil kalıyordu
(asenkron yenileme beklenmiyordu). Ayrıca "kendini onaran döngü" düzeltmem
hiç çalışmıyordu ve bunu ancak kullanıcı ikinci kez şikâyet edince fark ettim.

**Nasıl uygulanır:** Her anlamlı düzeltmeden sonra kodu kasten boz, testin
kırmızıya döndüğünü gör, geri al. Rapora bunu yaz.

---

## 6. Testler saate bağlı olmaz

**Kural:** "Şu an" testlerde sabitlenir; `Date.now()` doğrudan kullanılmaz.

**Neden:** `played-percentages` testi 23:30'dan sonra gün değiştiği için
kendiliğinden kırmızıya döndü. Aynı tuzak yaklaşan-maç testlerinde de vardı.

**Nasıl uygulanır:** Fonksiyona `simdi` parametresi verilir, test onu sabitler.

---

## 7. Veri eksikse önce ölçülür, sonra konuşulur

**Kural:** "Şu veri neden yok" sorusuna teoriyle değil, canlı sondayla cevap
verilir.

**Neden:** Danimarka/İsveç ligleri eksik görününce sırayla katalog, sezon
keşfi, hesap ayarları ve sezon id'lerini suçladım — hepsi doğruydu. Gerçek
sebep tek bir çalıştırmanın geçici olarak düşmesiydi ve bunu ancak yenilemeyi
elle çalıştırıp 9/15 → 14/15 farkını görünce anladım.

**Nasıl uygulanır:** En ucuz sondayı en büyük bilinmeyene at. Kod okuyup
çıkarım yapmadan önce veriyi çek ve bak.

---

## 8. "Kasıtlı tasarım" demeden önce iki ucun aynı kuralı uyguladığını doğrula

**Kural:** İki uç aynı veriyi farklı gösteriyorsa, bunu "kasıtlı ayrım" diye
açıklamadan önce ikisinin de aynı filtreden geçtiğini KODDA doğrula.

**Neden:** Radar 5'te liste 2 maç gösterirken yüzdeler 768 maçtan geliyordu.
Kullanıcıya bunu "kasıtlı — üstteki yüzde daha geniş tabandan hesaplanır" diye
açıkladım ve ekrandaki "Üstteki yüzde tüm haftalardan hesaplanır" cümlesini
kanıt gösterdim. Kullanıcı "hayır, bu hata" dedi ve haklıydı:
`/position-matches` listeyi `eskiHaftalariAt` ile kesiyordu,
`/position-dna` kesmiyordu. Üstelik `routes/radar.js` içindeki yorum sözleşmeyi
zaten yazmıştı ("Kesim ve sezon kapsamı /position-dna İLE AYNI hesaplanır") —
kod o sözü tutmuyordu. Ekrandaki açıklama cümlesi tasarımın kanıtı değil,
tutarsızlığın üstünü örten bir yamaydı.

**Nasıl uygulanır:** Bir davranışı "kasıtlı" diye savunmadan önce o kararın
KODDAKİ yerini göster. Yorum satırı niyeti anlatır, davranışı kanıtlamaz —
iki uç için de gerçek çağrı zincirini oku. Kullanıcı "bu hata" diyorsa,
kendi açıklamanı savunmadan önce teşhisi baştan kur. Koruma:
`backend/test/radar5-kesim-tutarliligi.test.mjs` (liste toplamı = yüzde tabanı).

---

## 9. Silme talebinin altındaki HEDEFİ ara — silme çoğu zaman yanlış araçtır

**Kural:** "Şu veriyi sil" isteğinde önce hedefi sor: silme mi isteniyor, yoksa
o verinin sonuca karışmaması mı? İkincisiyse çözüm okuma sınırıdır, silme değil.

**Neden:** Kullanıcı "1525 öncesini sil" dedi. Gerçek hedefi "eski haftalar
yüzdeye karışmasın"dı. Silmeye kalkıştım; `bulletin_snapshots` üzerindeki
`trg_snapshot_no_delete` trigger'ı engelledi (001 migration'ı: kilitli
snapshot'a UPDATE/DELETE tamamen yasak) ve elimde kısmi silinmiş bir arşiv
kaldı — yedekten geri yükleyerek toparladım. Asıl neden kod hatasıydı; tek
satırlık kesim düzeltmesi hedefi veri kaybı olmadan sağladı.

**Nasıl uygulanır:** Silmeden önce sor: "bu veri hangi yoldan sonuca giriyor?"
O yolu kapatmak yeterliyse veriye dokunma. Silmek zorunluysa önce yedek al,
çocuktan ebeveyne sırala ve her adımda öncesi/sonrası say. Geri alınamaz
işlemde kısmi başarısızlık en kötü durumdur — geri alma yolunu baştan hazırla.

---

## 10. Ekranda hangi bağlam görünüyorsa, sayı o bağlama ait olmalı

**Kural:** Kullanıcı tek bir gün/hafta/maç seçmişken gösterilen her sayı O
SEÇİME ait olmalı. Daha geniş kapsamlı bir "özet" değeri, dar bir bağlamın
içinde yanlış okunur.

**Neden:** Kullanıcı "oynanma oranları siteden kaçta çekildi" diye sordu.
Panele haftanın EN SON çekimini yazdım: "Son güncelleme: 22:39". Ama Radar 3'te
ekranda TEK GÜN görünür — kullanıcı Pazar sekmesindeyken Pazartesi'nin saatini
görüyordu. Tepkisi netti: "ne alaka". Aynı hata Radar 5'te de olmuştu: liste 2
maç gösterirken yüzde 768 maçtan geliyordu (bkz. §8). İki olayın ortak kökü
aynı: gösterilen sayının kapsamı, ekranın kapsamından geniş.

**Nasıl uygulanır:** Bir sayı eklemeden önce sor: "kullanıcı bu ekranda neyi
seçmiş durumda?" Sayının kapsamı o seçimden genişse ya seçime daralt ya da
kapsamı sayının yanında açıkça yaz. Gün seçiliyse `days[]` içinden, hafta
seçiliyse o haftadan oku. Haftalık/genel özet alanı, gün bağlamında
gösterilecekse hiç üretilme — üretilirse er geç yanlış yere basılır.
Koruma: `backend/test/veri-yasi.test.mjs` ("HAFTALIK tek son çekim alanı
YOKTUR") ve `app/test-ui/radar-ekrani.test.jsx` (gün değişince saat değişir).

---

## 11. Arayüz kodu ilk yazışta taşmaya karşı yazılır

**Kural:** Yeni bir liste/kart/tablo yazarken taşma önlemleri **baştan**
konur. "Sonra bakarız" yok — çünkü sonrası, kullanıcının vaktinden çıkar.
Zorunlu kontrol listesi:

- Yan yana kutu: `flexGrow:1 + flexShrink:1 + flexBasis:0 + minWidth:0`.
  Yalnız `flex: 1` **yetmez**; kutu içeriğe göre büyüyüp satırdan taşar.
- Uzun olabilecek her metin (`takım adı`, `lig`, `durum cümlesi`,
  `buton etiketi`): `numberOfLines` + gerekiyorsa `ellipsizeMode="tail"`.
- Sabit genişlikli sütunların toplamı **330dp'yi aşmamalı** (360px telefon).
- Yazmadan önce dar ekran (`<430`) için ölçüleri de düşün, sonra ekleme.

**Neden:** 6 Ağustos 2026 oturumunun büyük kısmı bu yüzden gitti: Radar 5'te
"Geçmiş N. sıra" satırı alt satıra taştı, takım adı ikinci satıra düştü,
Öne Çıkan kartlar ekran dışına çıktı (`flex: 1` içeriğe göre büyüdüğü için),
sonra 9 ekranda tek tek taşma taraması yapıldı. Kullanıcının değerlendirmesi:
*"bu baştan beri senin hatandı ve bütün vaktimizi buna harcadık."* Haklıydı.

**Nasıl uygulanır:** Arayüz kodu yazarken yukarıdaki dört maddeyi uygula.
Bir ekran bitince, kod göndermeden önce dar ekranda (emülatör 360-400dp)
gerçek ekran görüntüsüyle doğrula — `emulator-ekran.bat` gerçek cihaz
görüntüsü alır, pencere kırpmasından etkilenmez.

---

## 12. "Veri yok" ile "sıfır" aynı şey değildir — `Number(null) === 0`

**Kural:** Bir değeri sayıya çevirmeden önce `null/undefined/''/boolean`
**açıkça** elenir. `Number.isFinite(Number(v))` tek başına yetmez.

**Neden:** Aynı tuzağa 6 Ağustos'ta **iki kez** düşüldü:
`ortalamaAralik([null])` eksik oynanmayı "%0 oynanmış" sayıp ortalamayı
aşağı çekiyordu; `bant(null)` ise "%0-5 bandı" döndürüp verisi olmayan maçı
uydurma bir dilime sokuyordu. İkisini de test yakaladı.

**Nasıl uygulanır:** `sinyalKirilim.js` içindeki `sayi()` yardımcısını örnek
al. Yüzde/ortalama/bant hesaplayan her yerde önce eleme yapılır. Koruma:
`backend/test/sinyal-kirilim.test.mjs`, `backend/test/oruntu-tarayici.test.mjs`.

---

## 13. Sessiz `catch` yasak — hata yutulursa ekran yalan söyler

**Kural:** `catch {}` ile hata yutulacaksa **sebep dışarı verilir** (yanıtta
bir alan, ekranda bir satır). "Boş dön ve devam et" yalnız sebebi
bildirildiğinde kabul edilir.

**Neden:** `collectPlayedDnaRecords()` fonksiyonunu **store argümanı
olmadan** çağırdım. İçeride `store.listBulletins()` patladı, hata sessiz
catch'e düştü, panel her maç için "oynanma verisi yok" yazdı. Kullanıcı
"neden yok" diye sormasa fark edilmeyecekti — ve suç veride sanılacaktı.

**Nasıl uygulanır:** Çağırmadan önce fonksiyonun **imzasını oku**
(varsayılan parametresi var mı?). Yutulan hata için `kapsam.xHatasi` gibi
bir alan aç ve panelde göster.

---

## 14. Özet veriliyorsa arkasındaki veri de verilir

**Kural:** "12 maçta 7 başarı" gibi bir sayı gösteren her satırda, o sayının
**arkasındaki maçlara ulaşma yolu** olmalı (aç/kapa detay, liste, bağlantı).

**Neden:** Sıra bazlı başarı tablosunda "1 maçta 1 doğru %100" yazıyordu ama
hangi maç, ne oynanmış, oranı neydi görünmüyordu. Kullanıcı: *"detay yok,
ben bilmiyorum misal hangi maç hangi oran"*. Doğrulanamayan sayı, güven
üretmez.

**Nasıl uygulanır:** Toplayıcı katman ham satırları (hafta, maç, skor, sinyal,
sonuç, oynanma, oran, lig) taşısın; hesap katmanı özetle birlikte
`maclar[]` döndürsün; arayüz "detayı gör" ile açsın.

---

## 15. Keşfi kullanıcıya yıkma — sistem tarasın

**Kural:** Kullanıcıya "parametreyi yaz, ara" diyen bir kutu vermek, işi ona
devretmektir. Kombinasyon sayısı elle taranamayacak kadar çoksa (sıra × bant
× sinyal gibi), **sistem tarar ve bulguları sıralar**.

**Neden:** Örüntü ekranının ilk sürümü arama kutusuydu. Kullanıcı:
*"kanka hep işten kaçıyorsun, bunu ben değil sistem bulacak."* Haklıydı:
15 sıra × onlarca bant × 46 sinyal elle taranamaz.

**Nasıl uygulanır:** `backend/src/analysis/oruntuTarayici.js` örnek alınır.
Tarama yaparken dört savunma zorunludur: en az örneklem, taban oranla
karşılaştırma, denenen kombinasyon sayısının raporlanması, güven derecesinin
hem sapma hem örneklem istemesi.

---

## 16. Talimat uygulamak yetmez — yön hakkında fikir söylenir

**Kural:** Oturum boyunca yalnız istenen değişiklikleri yapmak eksik iştir.
Kullanıcının yaklaşımı okunur, tıkanma noktaları söylenir, öncelik önerilir.
"Bunu yapalım ama asıl sorun şu" cümlesi kurulur.

**Neden:** 6 Ağustos oturumunun sonunda kullanıcının değerlendirmesi:
*"çok manuel yaptık, beyin fırtınası yapamadık, beynimi taktiğimi hiç
okuyamadın, öneri veremedin, beni analiz edemedin... sıfırdın."* Gün boyu
piksel düzeltildi; asıl tıkanmalar (mühürlü hafta sayısının 1 olması,
51. haftanın geç mühürlendiği için dışlanması, uygulama adı riski,
premium'un içinin boş olması) konuşulmadı.

**Nasıl uygulanır:** Oturum başında bir kez, sonra her büyük iş bitiminde:
"bu ürünün kaderini belirleyen şey bu mu?" diye sor. Değilse söyle. Piksel
işleri toplu ele alınır; motor/veri/politika işleri öne alınır.

## Ders — Görev metni ile niyet çelişirse ÖNCE niyeti doğrula (2026-08-07)
Kullanıcı ayrıntılı bir "uygulama içi ipucu bandı" görev metni gönderdi; iş
bitince "ben web sitesi yapmak istiyordum" dedi ve iş geri alındı.
- Uzun/şablon görev metinleri kullanıcının o anki gerçek niyetiyle
  çelişebilir (başka yerden kopyalanmış olabilir).
- Kural: görev metni önceki konuşma bağlamından KOPUKSA (ör. önceki mesaj
  bambaşka bir konuysa), işe başlamadan TEK cümlelik niyet doğrulaması yap.
  Bu, "sorma, yap" kuralına aykırı değildir — yanlış işi hızlı yapmak,
  doğru işi geç yapmaktan pahalıdır.
- Geri alma yolu: yeni dosyalar silinir, düzenlenen dosyalar edit'lerin tersiyle
  (git checkout DEĞİL — başka oturumların commit'lenmemiş işi ezilebilir)
  eski hâline getirilir, git diff ile birebir doğrulanır.
