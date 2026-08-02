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
