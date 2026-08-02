# Görev Defteri

Her önemsiz olmayan iş buraya kontrol edilebilir maddelerle yazılır, uygulamaya
başlamadan önce plan gözden geçirilir, ilerledikçe işaretlenir ve iş bitince
altına bir **İnceleme** bölümü eklenir.

---

## Açık görevler

### Kullanıcının kararına bırakılanlar (bende değil)

- [ ] Supabase anahtarlarını yenile (panel erişimi kullanıcıda)
- [ ] `MODERATOR_EMAILS` / `SUPPORT_EMAIL` değerlerini belirle
- [ ] Uygulama adı için TÜRKPATENT kontrolü
- [ ] Veri sağlayıcıdan yazılı izin
- [ ] Hukuki görüş (avukat)
- [ ] Google Play Console hesabı
- [ ] Resmî kolon fiyatını doğrula (10 TL — teyit edilmedi)

### Senin kararın bekleyen

- [ ] **FootyStats hesabında turnuva seçimi.** Hesapta 34 turnuva seçili ve
      hepsi YEREL LİG. Şampiyonlar Ligi, Avrupa Ligi, ülke kupaları ve
      hazırlık maçları kaynakta var (toplam 1734 turnuva) ama seçili değil.
      Takım fikstürü altyapısı bunları destekliyor — seçime eklendikleri anda
      kendiliğinden görünürler, kod değişikliği gerekmez.

### Teklif edildi, onay bekliyor
- [ ] Yeşil kaynak adaptörünü kapat (`enabled: false`) — kaynak giriş duvarı
      arkasında, her 15 dakikada boşuna deneyip log kirletiyor.
      **Karar:** kullanıcı "ekleme" dedi; kapatma ayrıca onaylanmadı.

---

## Tamamlananlar

### 2026-08-02 · OLAY: kapsam çöküşü + gerileme koruması

- [x] Fikstür tüm turnuvalarda aranıyor (`fiksturIndeksi`), yalnız lig
      sezonunda değil — kupa/Avrupa eklendiğinde kendiliğinden gelsin
- [x] Ekranda kapsam satırı: hangi turnuvaların dahil olduğu yazıyor
- [x] **Gerileme koruması** (`src/kapsamKorumasi.js`): çalışan bir bülten
      varken kapsamı ÇÖKMÜŞ sonuç yazılmaz, eski veri korunur, `ok: false`
- [x] Düşen sezonlar sayılıp `failedSeasons` cache'ine yazılıyor; geçici
      hatada bir kez daha deneniyor (429'da ısrar YOK)
- [x] `scripts/kurtarma-yenileme.mjs` — hız sınırı açılınca veriyi geri getirir

**İnceleme.** Kendi hatam: yarım saat içinde beş kez yenileme çalıştırıp
FootyStats kotasını tükettim. Kaynak 429 dönmeye başladı, 57 sezonun hepsi
düştü, dolu bülten (14/15) tamamen boş bültenle (0/15) EZİLDİ ve durum
`ok: true` kaydedildi. Sistem kendini başarılı sanırken kullanıcının
uygulaması verisiz kaldı.

Asıl kusur 429 değil, **iyi veriyi bozukla ezmek ve buna "başarılı" demek**.
Koruma artık bunu engelliyor: elde çalışan veri varken tam çöküş yazılmaz.
Kısmi düşüş engellenmiyor — yeni sezon başında meşru olabilir ve aşırı koruma
sistemi kalıcı olarak güncellenemez hale getirirdi.

Doğrulama: backend 860 · app 722 · render 145 test, 0 başarısız.

**Kapanış (13:55).** Kota ~43 dakikada açıldı, kurtarma işi tek denemede
tam yenilemeyi çalıştırdı: kapsam 0/15 → **14/15**. Kalan tek maç
Arsenal–Dortmund hazırlık maçı, kapsam dışı olması normal.

### 2026-08-02 · Kaynak kotası koruması

- [x] `src/sources/kotaBekcisi.js` — kalan hak API yanıtındaki
      `request_remaining` alanından okunur (tahmin değil)
- [x] Kullanıcı tetikli çağrılar `istegeBagli` işaretli; kalan hak 300'ün
      altına inince KESİLİR, zorunlu yenilemeye yer kalır

**İnceleme.** FootyStats kotası **1800 istek/saat**. Bir tam yenileme ~130
istek (57 sezon × 2 + katalog + ek aramalar) → saatte en çok ~13 yenileme.

Kullanıcı sayısı kaynağa giden isteği ARTIRMIYOR (kullanıcılar bizim
cache'imize bağlanıyor). Ama tek bir kullanıcı tetikli yol vardı:
`/api/history/:roundId`, başlamış-sonuçsuz maçların skorunu tazeliyor ve
kısıtı HAFTA BAŞINA 60 saniyeydi — global değil. Hafta başına 15 maç =
900 istek/saat; maç akşamı 3 hafta görüntülenirse 2.700 istek/saat ve kota
aşılır. 10 kullanıcıda da 10.000 kullanıcıda da aynı — tehlike kullanıcı
sayısında değil, TAVANIN OLMAMASINDA.

### 2026-08-02 · Ölçek hazırlığı (yayın öncesi)

- [x] Yanıt sıkıştırma (gzip/brotli, Node zlib — paket kurulmadı): 615 KB → 13 KB
- [x] `Cache-Control: no-cache` → 15 sn'lik yoklamalar 304 · 0 bayt
- [x] Hazır paket belleği: gövde bir kez dizilip sıkıştırılıyor
- [x] **Arşiv durumu belleği** — en büyük kazanç: `getArchiveStatus` her
      istekte 116 ms Supabase turu yapıyordu

**İnceleme.** Ölçülen kapasite **79 → 439 istek/sn** (5,5×). 15 sn yoklamayla
~6.500 eşzamanlı açık ekran demek. Bant genişliği pratikte sıfıra indi
(304). Ölçümler localhost'ta; gerçek sunucuda mutlak sayılar değişir, oranlar
kalır.

**Ölçülmedi:** Supabase yazma yükü (kupon/yorum/kullanıcı) ve plan limitleri.
Yayın öncesi bakılacak ikinci konu.

### 2026-08-02 · Takım kartı: istatistik → fikstür

- [x] Backend: `GET /api/team-fixtures/:teamId?seasonId=` — takımın sezondaki
      oynanmış + oynanacak tüm maçları (`src/takimFikstur.js`, 30 dk cache)
- [x] Bültene `footyHomeId` / `footyAwayId` eklendi — mevcut `externalTeamId`
      BAŞKA sağlayıcının kimliği ve sezon verisiyle eşleşmiyor (Randers:
      2614 ≠ 2521)
- [x] `TakimFiksturModal` — tek liste, tarih sırası, "SIRADAKİ" ayracı,
      açılışta oraya kaydırma
- [x] Takım adı altındaki bağlantı `istatistik ›` → `maçlar ›`
- [x] Ölü kod temizliği: `TeamStatsModal` + `TSBox` + `tm` stilleri (132 satır)

**İnceleme.** Test iki gerçek hata yakaladı. (1) `Number(null)` sıfır olduğu
için skoru EKSİK gelen bitmiş maça "M" yazıyordum — yani olmayan bir sonucu
uyduruyordum; null artık önce eleniyor. (2) Ters eşleşmede (`swapped`) takım
kimlikleri çevrilmezse takım kartı RAKİBİN fikstürünü açıyordu; mantık
`kaynakTakimKimlikleri` olarak ayrı bir saf fonksiyona çıkarılıp test edildi.

Doğrulama: backend 833 · app 722 · render 142 test, 0 başarısız. Canlı uçtan
uca: Randers → kendi 22 maçı, Lyngby → kendi 22 maçı, sonuç harfleri her takımın
kendi açısından doğru.

Kalan boşluk: gerçek cihazda gözle görülmedi.

### 2026-08-02 · Ana sayfa: sayaçlar, lig şeridi, yaklaşan maçlar

- [x] Hero sayaçları: `14` → `14/15` (payda gösterilir), eşikler etikete
      yazıldı (`Öne Çıkan 45+`, `Sürpriz 65+`), eşikler tek sabite bağlandı
- [x] Lig şeridi: backend bültene `leagueImage` ekliyor, ana sayfada kayan
      logo+ad satırı
- [x] Yaklaşan maçlar: önceki haftanın oynanmamış maçları hafta rozetiyle
      listeye katıldı; kartlar doğru ekrana gidiyor
- [x] Kayan şerit tek bir ortak bileşene (`KayanSerit`) çıkarıldı
- [x] Şeridin durması giderildi: dokunmayla duraklatma kaldırıldı, JS
      sürücüsüne geçildi, bekçi eklendi

**İnceleme.** Üç kusur iş sırasında ortaya çıktı ve düzeltildi: (1) önceki
hafta kartı sıra numarasıyla maç detayına gidip **yanlış maçı** açıyordu,
(2) ilk birleştirme güncel haftayı ekrandan tamamen siliyordu, (3) dün
oynanmış maçlar "yaklaşan" görünüyordu. Şeridin donması **kendi eklediğim**
dokunmayla duraklatma yüzündendi; sayfa dikey kaydırılınca "parmak kalktı"
olayı gelmiyor, bayrak kalkık kalıyordu. İlk onarma denemem de işe yaramadı,
çünkü yerel sürücüyle çalışan animasyon ölürken JS'e hiçbir haber göndermiyor.

Doğrulama: backend 818 · app 722 · render 135 test, 0 başarısız. Kritik
düzeltmeler kasten bozulup testlerin kırmızıya döndüğü görüldü.

Kalan bilinen boşluk: hiçbiri **gerçek cihazda gözle** doğrulanmadı — kayma
hızı, `14/15` sığması ve hafta rozetinin görünümü kullanıcı onayı bekliyor.
