# RAPOR — 1526 (52. Hafta) Tutmayan Tahminlerin Analizi

Tarih: 2026-08-04 · Kaynak: mühürlü arşiv (`official_forward`), radar merkezi kaydı
(`radarCenter-1526`), kupon önerisi kaydı (`snapshot-1526`), karne uçları.
Tüm sayılar gerçek kayıttan okundu; hiçbir değer geriye dönük üretilmedi.

## 1. Haftanın özeti

Kupon önerisi ölçüsüyle (ekrandaki "Sistem" sütunu): **10/15 doğru, 5 yanlış**
(4, 5, 7, 9, 13). Tekli ana tahmin karnesinde (Master Analiz): **6/12** —
orada ek olarak 2 ve 11 de yanlış sayılır çünkü karne çifteleri saymaz
(kupon önerisi o iki maçı 1-2 ve 1-X-2 genişletmesiyle kurtarmıştı).

Sonuç tipine göre: sonucu **1** biten 9 maçın 9'u bilindi. Yanlışların tamamı
sonucu **2** (3 maç) veya **X** (2 maç) biten maçlarda. Sistem bu hafta
deplasman ve beraberlik tarafında kör kaldı; X sonuçlanan hiçbir maçta X
önerisi yoktu.

## 2. Maç maç: neden tutmadı, sinyal var mıydı?

### #4 PSV – Alkmaar · öneri 1 (GÜÇLÜ ADAY) · sonuç 2
- **Veri eksikti:** puan tablosu/kayıt verisi yoktu (`homeRec/awayRec: null`),
  Radar 1 (Rakip Gücü) ve Radar 2 (xG) bu maçta **devre dışıydı**. Karar
  yalnız halk eğilimi (%66 → 1) + oran + bülten hafızasına dayandı.
- **Sinyal:** yön uyarısı yoktu; yalnız iki zayıf negatif vardı (sağlayıcılar
  arası %9,9 fark; açılıştan beri 1 oynanması −11,1 puan).
- **Hüküm: SÜREÇ HATASI.** Veri bu kadar eksikken en yüksek güven etiketi
  verilmemeliydi ("veri yoksa güveni düşür" kuralına aykırı). Bu kusur
  `analysis/prediction.js` başlığında belgelenmiş ve **düzeltilmiş**: artık
  veri/oran yoksa eşik yükselir, etiket en fazla TEMKİNLİ olur.

### #5 Hacken – Kalmar · öneri 1 (NET) · sonuç X (1-1)
- **Sinyal VARDI:** Radar 4 (Oran Takibi) yönü **"2"** gösteriyordu — favoriyle
  ters. Sürpriz DNA'da "oran–oynanma tersliği" eşleşmişti (puan 16). Kriter
  detayında da karşı sinyaller vardı (yediği gol ve xGA deplasman lehine).
- **Hüküm: DARALTMA HATASI.** %64'lük favoriye tekli yazıldı; radar çatışması
  kupon genişliği kararına bağlı olmadığı için uyarı karara işlemedi. 1X
  genişletmesi bu uyarılarla tutarlı olurdu.

### #7 AIK Stockholm – Örgryte · öneri 1 (GÜÇLÜ ADAY) · sonuç 2 (0-3)
- **Sinyal VARDI ve güçlüydü:** halkın %83,3'ü ev sahibine yığılmıştı
  (aşırı yığılma uyarısı), oran–oynanma tersliği eşleşmişti, sürpriz DNA 32
  puandı (haftanın en yükseklerinden). Üstelik maç **oransızdı**.
- **Hüküm: SÜREÇ HATASI (belgelenmiş).** Oran hiç yokken en yüksek güven
  etiketi verildi; yığılma bandının geçmiş örneklemi 1 maç olduğu için bant
  istatistiği de karara katılamadı. Bu vaka kod içinde açıkça anılıyor
  ("1526/7. maç oransız olduğu hâlde en yüksek etiketi aldı") ve kural
  **düzeltilmiş** durumda. Aşırı yığılma sinyalinin karara etkisi ise hâlâ
  bant örneklemine bağlı — arşiv büyüdükçe güçlenecek.

### #9 Valerenga – Ham Kam · öneri 1 (NET) · sonuç 2 (0-3)
- **Sinyal YOKTU:** beş radarın beşi de 1 diyordu, sürpriz DNA 0, tek negatif
  sağlayıcılar arası %8,8'lik fark. Favori %65, veri kalitesi 98.
- **Hüküm: VARYANS (gerçek kör nokta).** Eldeki hiçbir veri bu sonucu ima
  etmiyordu. 0-3'lük skor kadro/moral gibi sistemde OLMAYAN verilerle ilgili
  olabilir (eksik oyuncu/hoca verisi hâlâ bağlı değil — bilinen eksik).
  Böyle maçlar tahmin sisteminin doğal sınırıdır; süreç makuldü, sonuç ters.

### #13 Molde – Sarpsborg 08 · öneri 1 (NET) · sonuç X (3-3)
- **Sinyal VARDI, hem de en çok burada:** favori yalnız %54, favori-yatma
  riski 55 (haftanın en yükseği #11 ile birlikte), Radar 1 yönü **"2"**,
  açılıştan beri 1 oynanması **−15,6 puan** (haftanın en sert düşüşü),
  sağlayıcılar arası %10,6 çelişki.
- **Hüküm: DARALTMA HATASI.** Bu profil tekli öneri profili değildi; benzer
  profilli #11 (favori %50, risk 56) 1-X-2 ile açılmışken #13 tekli kaldı.
  Yeni tek-seçim tabanı kuralı bu vakayı da kapsamalı (aşağıda öneri 2).

### Karne teklisinde ayrıca yanlış olan #2 ve #11
Ana tahmin #2'de "2" (sonuç 1), #11'de "2" (sonuç 1) idi — ikisi de yanlış.
Kupon önerisi bu iki maçı çifte/açık genişletmesiyle kurtardı; genişletme
mekanizması bu hafta tam da tasarlandığı işi yaptı.

## 3. Radar karşılaştırması (yalnız 1526 — örneklem 1 hafta, DÜŞÜK GÜVEN)

| Kaynak | Yön isabeti | Not |
|---|---|---|
| Master (radar birleşimi) | 9/15 (%60) | Güçlü Aday 2/2 (n yetersiz) |
| Radar 3 · Oynanma DNA | 9/15 (%60) | 14 maçta "1" dedi; 1 biten her maçı bildi |
| Radar 4 · Oran Takibi | 8/15 (%53) | #5'te tek doğru yönlü uyarıyı verdi (2) |
| Radar 2 · xG/Beklenti | 6/12 (%50) | 3 maçta veri yok |
| Radar 1 · Rakip Gücü | 3/11 (%27) | 4 maçta veri yok; 8 yanlış yön |

**Dürüstlük notu:** Bu tablo TEK haftadır; "hangi radar daha doğru" sorusuna
kalıcı cevap değildir (karne ucu da aynı uyarıyı veriyor: "örneklem küçük").
Radar 1'in %27'si dikkat çekici ama tek haftayla ağırlık değiştirmek acele
olur — birkaç hafta biriktirip kalibrasyon karnesiyle bakılmalı. Bu haftanın
tek yapısal gözlemi: 1-ağırlıklı bültende Oynanma DNA "hep 1 de" stratejisiyle
bile %60'a ulaşır; radarın gerçek değeri 1 bitmeyen maçlarda uyarı verip
vermediğidir — o da #5 (Radar 4) ve #7 (sürpriz sinyalleri) dışında yoktu.

## 4. Sistem hatalı mıydı? (özet hüküm)

- **Süreç hatası: 2 maç** (#4, #7) — veri/oran eksikken en yüksek güven
  verildi. İkisi de kod içinde teşhis edilip **düzeltildi** (1526 sonrası).
- **Daraltma hatası: 2 maç** (#5, #13) — uyarı sinyalleri varken tekli
  yazıldı; sinyaller karar katmanına bağlı değildi.
- **Varyans: 1 maç** (#9) — hiçbir veriyle öngörülemezdi; hata değil sınır.
- Ayrıca **iyi çalışan taraf:** genişletme mekanizması (#1, #2, #3, #11'i
  kurtardı) ve mühürlü Güçlü Aday'ların 2/2 gelmesi.

## 5. Yapılması gerekenler (önem sırasıyla)

1. **Radar çatışmasını tekli-öneri kararına bağla.** Akıllı Kupon'da
   "Master↔Radar çatışması" sinyali var ama maç kartındaki kupon önerisi
   (prediction.js) radar yönlerini hiç okumuyor. Bir radar favoriyle ters
   yöndeyse tek seçim yazılmasın, genişletilsin. (Dürüst not: #5 ve #13'te
   genişletme "2"yi eklerdi, sonuç X geldiği için yine tutmazdı — kazanç
   isabet garantisi değil, tek seçeneğe sıkışmamaktır.)
2. **Favori-yatma riski eşiği:** risk ≥ 50 iken tekli öneri verilmesin
   (#11 zaten açılmıştı, tutarlılık sağlanır).

> **✅ UYGULANDI (2026-08-04):** 1 ve 2 numaralı öneriler + motor çelişkisi
> denetimi ve sürpriz DNA eşiği `backend/src/analysis/radarGuards.js` olarak
> eklendi (refresh.js'e bağlı, kilitli haftaya dokunmaz, yalnız genişletir).
> Testler: `backend/test/radar-guards.test.mjs` (14 test).
3. **Sürpriz DNA ≥ 30'u görünür uyarıya çevir** (#7 profili: aşırı yığılma +
   terslik + oransızlık). Etiket düşürme düzeltmesi yapılmış; bunun bir de
   kart üzerinde "sürpriz sinyali var" uyarısına bağlanması kalmış.
4. **Beraberlik modeli zayıf:** X sonuçlanan 3 maçın hiçbirinde X önerisi
   yoktu; X'e en yakın maç bile (draw %35, #11) ancak üçlüyle açıldı.
   Beraberlik eğilimi kriterinin (draws, BTTS, düşük fark) X-lehine sinyale
   dönüşme eşikleri gözden geçirilmeli.
5. **Eksik oyuncu/hoca verisi** hâlâ yok (bilinen eksik). #7 ve #9'daki
   0-3'lük sonuçların en olası açıklaması bu tür bilgidir; güvenilir kaynak
   bulunana kadar bu maç tipi kör nokta kalacak — kaynak bulunmadan uydurma
   yapılmayacak (kural).
6. **Bant istatistiklerinin örneklemi:** "%80+ yığılma" bandında yalnız 1
   geçmiş maç vardı; geçmiş bülten içe aktarımı büyüdükçe bu bantlar karara
   katılabilir hâle gelecek. İçe aktarımın düzenli çalıştığı doğrulanmalı.

## 6. Bu rapor neyi DEĞİL neyi söylüyor?

Tek haftalık ölçümdür; başarı ya da başarısızlık kanıtı değildir. "Sistem
hatalı mı?" sorusunun cevabı ikili: 1526'da **karar katmanında iki gerçek
kusur vardı ve ikisi de düzeltildi**; kalan yanlışların bir kısmı sinyal
bağlantısı eksikliği (yukarıdaki 1-2), biri de futbolun doğal belirsizliği.
Hiçbir öneri "kesin sonuç" vaadi değildir.
