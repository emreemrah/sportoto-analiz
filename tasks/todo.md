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

### 2026-08-03 · Radar 5: maç satırına BUGÜNÜN oynanma yüzdesi

- [x] Maç adının **YANINDA**, oktan önce (kullanıcı kararı: "altında değil
      yanında"): `1  Randers – Lyngby   Pzt ● 1:72 X:16 2:12   ▼`
- [x] Gün adı KISALTILIYOR (yer dar). Kesme değil **açık eşleme** — "Pazar" ve
      "Pazartesi" ilk üç harfte aynı ("Paz"), kesme ikisini karıştırırdı
- [x] Kaynak Radar 3'ün günlük verisi (`dailyPlayed`) — **ayrı istek yok**
- [x] Gün seçimi `varsayilanGun` ile: gerçek verisi olan en son geçmiş/bugün
      günü; gelecek gün asla seçilmez (boş hücre `{}` tuzağı — `radarGun.js`)
- [x] Kaynaklar ORTALANMAZ, her kaynak kendi satırında renkli noktasıyla
      (Radar 3'ün kuralı); kaynak adı hiçbir yerde geçmez
- [x] **Yakalanan hata:** günlük oynanma verisi yalnız `tab === 'publicBetting'`
      iken çekiliyordu; Radar 5'e doğrudan girildiğinde `dailyPlayed` boş
      kalıyor ve yüzdeler HİÇ görünmüyordu. Çekme koşuluna `bulletinMemory`
      eklendi — aynı kilit iki sekmede geçerli olduğu için ek istek gitmez
- [x] Testler: jest 3 yeni test (gün adıyla gösterim · gelecek gün seçilmez ·
      veri yoksa satır çizilmez)
- [x] Doğrulama: app **744 test** · jest **163 test** · 0 başarısız; bundle
      `Exported: dist`. Canlı: sıra 1 Randers–Lyngby → `Pazartesi 03.08`,
      `1 %72 · X %16 · 2 %12`

**İnceleme.** Testi yazmasaydım eksik veri çekme hatası fark edilmezdi: ekran
sessizce boş kalırdı, hiçbir hata vermeden. Test önce kırmızı verdi ("Pazartesi
03.08 bulunamadı"), sebep aranınca `useEffect` koşulu çıktı.

### 2026-08-03 · Radar 3/4: her GÜNÜN kendi çekim saati

- [x] Backend: her `days[]` nesnesi kendi `lastObservedAt` (ISO) +
      `lastObservedLabel` (İstanbul saati, `HH:MM`) alanını taşıyor
- [x] Saat çevirimi SUNUCUDA (`istanbulSaat`): cihazın saat dilimi yanlışsa
      kullanıcı yanlış saat görürdü
- [x] Gün penceresi bağlayıcı: mühür (23:55+pay) sonrası gözlem o güne
      yazılmaz; komşu günden saat TAŞINMAZ (gözlem yoksa null)
- [x] Ekranda iki yerde: gün çipinin alt satırında (`02.08 · 20:45` — hepsi
      bir bakışta) ve çiplerin altındaki satırda SEÇİLİ gün için
      (`Pazar 02.08 · kaynaktan son çekim 20:45`)
- [x] Haftalık tek "son çekim" alanı **kaldırıldı** + geri gelmesini engelleyen
      test yazıldı
- [x] Testler: backend `veri-yasi.test.mjs` (**10 test**) + jest 2 test
- [x] Doğrulama: backend **975 test** · jest **160 test** · 0 başarısız;
      bundle `Exported: dist`. Canlı: Pazar `20:45` · Pazartesi `22:39` ·
      gelecek günler saatsiz

**İnceleme.** İlk sürümü YANLIŞ yaptım: panele haftanın EN SON çekimini
yazdım ("Son güncelleme: 22:39"). Kullanıcı Pazar sekmesindeyken Pazartesi'nin
saatini görüyordu ve haklı olarak "ne alaka" dedi. Ekranda TEK GÜN görünür —
o hâlde oradaki her sayı o güne ait olmalı. Haftalık alan kaldırıldı; yerine
gün bazlı saat geldi. Ders: `lessons.md` §10.

Ölçülen ayrım (ilk sürümde raporladığım): son *çalıştırma* 22:01:56 ama son
*kaydedilen değişiklik* 21:29:20 — o turda `written: 0, unchanged: 15` olduğu
için mükerrer satır yazılmamıştı. Ekranda verinin gerçek yaşı gösteriliyor.

**İnceleme.** Kullanıcı "oynanma oranları en son saat kaçta çekildi" diye
sordu; ekranda bu bilgi hiç yoktu — yalnız "23:55'te mühürlenir" yazıyordu ki o
GELECEKTEKİ bir söz, geçmişteki çekim değil. Kaynak susarsa sayılar sessizce
eskiyordu.

İki "son" arasındaki fark ölçüldü ve önemli: son *çalıştırma* 22:01:56
(`playedObserveStatus.json`), ama son *kaydedilen değişiklik* 21:29:20 —
çünkü o turda `written: 0, unchanged: 15` (değerler aynıydı, mükerrer satır
yazılmadı). Ekranda **verinin gerçek yaşı** gösteriliyor, çalıştırma saati
değil; kullanıcının sorduğu da budur.

Test yazarken Radar 4 gözlem şeklini yanlış kurdum (`{'1',X,'2'}` sanmıştım,
gerçeği `{home,draw,away}`) — test kırmızı verince `METRICS.odds.extract`
okunup düzeltildi.

### 2026-08-03 · Radar 5: "dönem başarısı" göstergesi kaldırıldı

- [x] Maç satırındaki `Dönem başarısı: X %100.0 ▲` bloğu kaldırıldı
      (`RadarScreen.js`) — üstündeki `Geçmiş N. sıra · 1/X/2` satırının EN
      YÜKSEĞİNİ tekrar ediyordu, aynı sayı "başarı" adıyla ikinci kez
- [x] Dönem çiplerindeki `· %66.7` ve eğilim okları (▲▼—) kaldırıldı
      (`RadarTabHeaders.js`). Çipler FİLTRE olarak duruyor
- [x] Ölü kod temizliği: `radar5PeriodSuccess`, `radar5PeriodTrend`, `rowTrend`
      (`radarScreenData.js`), `dnaStatsByPosition` haritası, 4 stil
      (`memSuccessRow/memSuccess/memSuccessValue/memTrend`), 5 stil
      (`dnaPeriodLabel/dnaTrend/dnaTrendUp/dnaTrendDown/dnaTrendFlat` × 2 dosya)
- [x] Testler: silinen fonksiyonların 4 testi kaldırıldı; `radar-ekrani.test.jsx`
      çip metni `/Son 5 Hafta · %/` → `'Son 5 Hafta'` olarak güncellendi
- [x] Doğrulama: app **744 test** · jest **158 test** · 0 başarısız;
      `expo export --platform web` → `Exported: dist`

**İnceleme.** Gösterge iki yerde aynı hesaptan besleniyordu, o yüzden ikisi de
kaldırıldı — biri kalsaydı kafa karışıklığı sürerdi. Kaldırma kod referansı
bırakmadı (tarama temiz); geriye yalnız *neden kaldırıldığını* anlatan yorumlar
kaldı, gösterge geri istenirse nereye döneceği belli olsun diye.

### 2026-08-03 · HATA: Radar 5'te yüzde, listenin görmediği haftalardan geliyordu

- [x] **Teşhis:** `/position-matches` listeyi `eskiHaftalariAt` ile 1525'ten
      kesiyordu (`radar.js:562`), `/position-dna` kesmiyordu (`radar.js:699`).
      Ekran "2 maç" derken yüzde **768 maçtan** hesaplanıyordu
      (`cut.historyMatches: 755` + `archiveMatches: 13`)
- [x] **Düzeltme:** `computePositionDna(eskiHaftalariAt([...]))` — tek satır,
      veri kaybı yok
- [x] Canlı sonuç: yüzde tabanı **768 → 28**, listedeki toplam maç sayısı da
      **28** — iki uç artık birebir aynı
- [x] Dönem filtresi (Son 5/10/15/25/50/Tüm) artık yüzdeyi **değiştirmiyor**
- [x] Yeni regresyon testi: `test/radar5-kesim-tutarliligi.test.mjs` (4 test)
- [x] `radar-dna-boundary.test.mjs`: sembolik tur numaraları (1400/1499) gerçek
      sınıra takılmasın diye o dosyada `RADAR5_LISTE_BASLANGIC=1`
- [x] Doğrulama: backend **965 test, 0 başarısız** (32 atlandı — canlı DB)

**İnceleme.** Kullanıcı bu tutarsızlığı bir önceki turda bana sormuştu ve ben
"kasıtlı" diye açıklamıştım; ekrandaki "Üstteki yüzde tüm haftalardan
hesaplanır" cümlesini kanıt saydım. Yanlıştı — o cümle tasarım değil, hatanın
üstünü örten bir yamaydı. `routes/radar.js:521`'deki yorum sözleşmeyi zaten
yazmıştı ("Kesim ve sezon kapsamı /position-dna İLE AYNI hesaplanır"); kod
tutmuyordu. Ders: `lessons.md` §8.

Testin gerçekten koruduğu **bozarak** kanıtlandı: düzeltme geri alınınca 3 test
kırmızıya döndü ("last10 penceresi farklı yüzde veriyor"). İlk test sürümünde
dönem-filtresi testi bozuk kodda da geçiyordu (kurulumda 3 hafta varken `last5`
hepsini kapsıyordu); kurulum 15 eski haftaya çıkarılıp ayırt edici hâle getirildi.

### 2026-08-03 · 1525 öncesi arşiv temizliği — YAPILAMADI (veritabanı koruması)

- [x] Envanter: 1525 öncesi bülten artığı = **1521 (49. Hafta)**, 30 satır
      (`bulletins` 1 · `bulletin_matches` 15 · `bulletin_snapshots` 1 ·
      `match_official_results` 13 · `bulletin_data_observations` **0**)
- [x] Kullanıcı kararı: yalnız bülten artığı silinsin, **resmî Spor Toto
      geçmişine dokunulmasın** (205 tur · 3.053 maç — Radar 5 yüzdelerinin tabanı)
- [x] Yedek alındı → `backend/data/silinen-1521-yedek/`
- [ ] ~~Silme~~ — `bulletin_snapshots` DB trigger'ına takıldı:
      `IMMUTABLE_SNAPSHOT: kilitli snapshot silinemez (bulletin 1521)`
- [x] Kısmi silme **geri alındı**: `match_official_results`'tan silinen 13 satır
      yedekten geri yüklendi, sayım yeniden 13
- [x] Regresyon: Radar 5 sıra 1 → 2 maç (51+52), `/api/history/1521` → 15 maç

**İnceleme.** Silme mümkün değil ve bu bir kusur değil: `001_bulletin_archive.sql:162`
kilitli snapshot'a UPDATE ve DELETE'i tamamen yasaklıyor, `003` de bu kuralı
yazıyor — *"trg_snapshot_no_delete HİÇ kapatılmaz"*. Trigger'ı devre dışı bırakmak
ürünün değişmezlik sözleşmesini kırardı, yapılmadı.

**Zaten gerek yok:** iki okuma sınırı 1525'i hâlihazırda uyguluyor —
`playedDnaArchive.js:38` (`DNA_START_ROUND_ID`) 1525 öncesini **hiç okumuyor**,
`siraOynanma.js:33` (`LISTE_BASLANGIC_ROUND_ID`) Radar 5 listesini 51. Haftadan
başlatıyor. 1521 verisi diskte duruyor ama hiçbir ekrana çıkmıyor.

**Dokunulmadı:** `cache/radarCenter-1521.json` (yalnız önbellek, yeniden üretilebilir).

### 2026-08-03 · Commit'lenmemiş yığının bütünlük doğrulaması

- [x] Üç test paketi çalıştırıldı: backend **961** (0 kaldı, 32 atlandı),
      app **748** (0 kaldı, 1 atlandı), jest **158** (0 kaldı)
- [x] Silinen sağlayıcılara (`providers/bilyoner.js`, `providers/misli.js`)
      **canlı import/referans kalmamış** — `playedPercentages.js:13` yalnız
      `nesineAdapter` çekiyor. Kalan tek metin izi `HANDOFF.md:238` (belge)
- [x] Web bundle derleniyor: `expo export --platform web` → 2,6 MB, `Exported: dist`
- [x] **SIR SIZINTISI RİSKİ KAPATILDI** (aşağıda)

**İnceleme.** Asıl görev testleri koşturmaktı; iş sırasında ondan önemli bir şey
çıktı: `backend/.env.yedek-0107` dosyası **gitignore'a takılmıyordu**.
`.gitignore:31`'deki desen `*env-yedek*` (tire), dosya adı `.env.yedek-0107`
(nokta) — eşleşmiyordu. Dosya `FOOTYSTATS_API_KEY`, `APIFOOTBALL_API_KEY`,
`SUPABASE_SECRET_KEY` ve `SUPABASE_DB_URL` içeriyor; bir `git add -A` bunları
repoya sokardı. `.env.*` deseni + `!*.env.example` istisnası eklendi;
`git check-ignore` artık `.gitignore:33` ile yakalıyor, `.env.example` takipte
kalmaya devam ediyor. Git geçmişi kontrol edildi: **sızıntı olmamış**, yalnız
risk vardı.

**Atlanan 32 test — "atlandı, geçti değildir".** Hepsi canlı PostgreSQL isteyen
migration + moderasyon testleri; koşul `MIGRATION_TEST_DB_URL`. Makinede
127.0.0.1:5433'te gerçek bir `postgres.exe` dinliyor ve `livePg.mjs:43-49` her
test için izole geçici veritabanı kuruyor (üretime dokunmaz), ama bağlantı
parolası hiçbir yerde belgelenmemiş. **Yeni `009_profiles_predictions.sql`
canlı olarak hiç uygulanmadı** — statik testi (`goc-tam-mi`, 5/5) `if not
exists` / RLS / cascade'i doğruluyor, canlı davranışı doğrulamıyor.


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


---

## 2026-08-06 — DENETİM VE TEMİZLİK (A'dan Z'ye)

Kullanıcı isteği: "projeyi komple incele … ne varsa dök" ardından
"tüm düzeltmeleri yapıp uygula".

**Önce yapılan denetim** → `RAPOR-PROJE-DENETIMI.md` (dört paralel tarama:
backend, uygulama, test/doküman, yayın/güvenlik).

- [x] `backend/.env.yedek-0107` SİLİNDİ (9 gerçek anahtar taşıyordu; git'e
      girmemişti ama diskte durması tek başına risktı)
- [x] Katalog sürümü "çelişkisi" incelendi → **yanlış alarm**: iki AYRI katalog
      (eski `criteriaEval` = `criteria-1.0.0`, master 40 kriter =
      `criteria-catalog-2.0.0`). Değerler DEĞİŞTİRİLMEDİ (mühürlü snapshot'lar
      bu etiketleri taşıyor); yalnız ad ayrıştırıldı:
      `LEGACY_CRITERIA_CATALOG_VERSION` + iki tarafa açıklama
- [x] Kırık test kaldırıldı: `app/test-ui/liderlik.test.jsx` silinmiş
      `LeaderboardScreen`'i çağırıyordu
- [x] `HANDOFF.md` + `AGENTS.md`: "ana motor `userMatchEngine`" yanlışı
      düzeltildi (doğrusu `backend/src/analysis/masterEngine.js`); var olmayan
      kupon ekranları, eski branch talimatı ve sökülen rozet sistemi güncellendi
- [x] Ölü kod (≈1.400 satır) `_to_delete/denetim-20260806/` altına alındı:
      `decisionEngine.js`, `DecisionEngineView.js`, `SahaBackdrop`,
      `BultenBackdrop`, `LineupBuilder`, `CompareBars`,
      `usePerformanceDashboard`, iki mock veri dosyası
- [x] Ölü import temizliği: `MatchDetailScreen` (13 isim), `RadarScreen` (9)
- [x] Ölü koda bağlı testler uyarlandı: `esik-birligi` (ALTIN senaryolar
      kaldırıldı, eşik sabitleri + yaşayan kriter motoru KALDI),
      `guvence-dili`, `erisilebilirlik-simge-dugme`, `verdict-wording` (silindi)
- [x] Sessiz hata yutma giderildi: `refresh.js` sezon çekimi (artık loglanıyor
      + `dusenSezonlar`), `routes/auth.js` üç `.catch(() => {})` (yanıt gizlilik
      gereği AYNI kaldı, hata sunucu loguna yazılıyor)
- [x] `misli: 'k2'` "hayalet eşlemesi" incelendi → **bilinçli** (arşivdeki eski
      gözlemler bu kimliği taşıyor). Gerçek risk kapatıldı: aynı koda iki
      kaynak düşerse açılışta HATA fırlatan çakışma kilidi eklendi
- [x] `/api/health` artık **kalan kotayı** yayınlıyor (2 Ağustos'taki sessiz
      kapsam çöküşü dışarıdan görülebilsin diye; sağlayıcı adı sızdırılmaz)
- [x] `backend/migrations/README.md`: 007-009 satırları eklendi (belge 006'da
      kalmıştı), oyunlaştırma tablolarının artık ölü olduğu not edildi
- [x] Yanlış `mkdir` izi 4 boş klasör ve ölü `cache/bilyonerDiag.json` temizlendi

**İnceleme.** Denetimin işaret ettiği 3 maddenin ikisi (katalog sürümü, misli
eşlemesi) incelenince **yanlış alarm** çıktı — körü körüne "düzeltmek" arşiv
semantiğini bozardı. Bu yüzden ikisinde de değer değil, ANLAM netleştirildi ve
gerçek risk (isim karışıklığı, kod çakışması) ayrıca kapatıldı. Kalan maddeler
uygulandı. En büyük kazanç ölü kod: 1.400+ satır ve 22 ölü import gitti.

Doğrulama: backend **944/944**, app **740/740** (0 başarısız; app sayısı
ölü koda bağlı 16 testin kaldırılmasıyla 756 → 740'a indi).

**Bilerek yapılmayanlar (gerekçeli):** ~172 ölü stil anahtarı (yalnız kozmetik,
büyük diff riski), Yayın Stüdyosu kümesi (bayrakla kapalı, silinmez),
`SystemDashboardScreen` (dev-only demo), kırılgan regex bekçi testlerinin
yeniden yazımı (ayrı ve büyük iş).


## 2026-08-06 (ek) — YAYIN STÜDYOSU TAMAMEN KALDIRILDI

Kullanıcı kararı: "Yayın Stüdyosu tamamen silelim". Özellik 1 Ağustos'ta
bayrakla kapatılmıştı (`YAYIN_STUDYOSU_ACIK=false`); artık kod da gitti.

- [x] Ekranlar: Broadcast · StudioBulletin · StudioMatch · StudioKarne
- [x] Mağaza/mantık: broadcast.js, broadcastStudio.js, broadcastStudioStore.js,
      studioKarne.js, studioCouponSave.js
- [x] `userMatchEngine.js` (6 kriterli hafif motor — yalnız stüdyodan erişiliyordu)
- [x] 9 test dosyası + `scripts/render-studio.mjs` + `verify:render` betiği
- [x] `features.js` bayrağı ve App.js/HomeScreen kalıntıları (📺 düğmesi dahil)
- [x] `FULLSCREEN_ROUTES` boşaltıldı (stüdyo rotaları kalmadı)

**Yanlış silmeden dönülen adım:** `studioParts.js` da silinmişti, ama testler
onun KUPON ekranlarını beslediğini gösterdi (couponStudioParts → TeamCrest /
PickBoxes). Geri alındı, başlığı gerçeğe göre düzeltildi ve tek stüdyo
bağımlılığı (`officialSymbol`) doğrudan `couponConfig`'e çevrildi.

Doğrulama: app **520/520** (0 başarısız; stüdyo testlerinin gitmesiyle 740→520).
