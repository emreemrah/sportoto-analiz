# RAPOR — 1525 (51. Hafta) Tutmayan Tahminlerin Analizi

Tarih: 2026-08-04 · Kaynak: `radarCenter-1525`, `snapshot-1525`, `/api/history/1525`.
Not: 1525 kaydı resmî karnede `late_unverified` (mührün maç öncesi olduğu
kanıtlanamamış) sayıldığı için karne yüzdelerine GİRMEZ; buradaki analiz kayıt
üzerinde geriye dönük okumadır, karne başarısı değildir. 1526 raporuyla birlikte
okunmalı: `RAPOR-1526-tutmayan-tahminler.md`.

## 1. Haftanın özeti

Kupon önerisi ölçüsüyle: **10/15 doğru, 5 yanlış** (#2, #3, #8, #13, #15) —
1526 ile aynı skor. Bu hafta X bolluğu vardı: 4 maç berabere bitti (1, 2, 3, 13),
yalnız #1'deki tekli X tahmini tuttu. Genişletme mekanizması yine 4 maçı
kurtardı (#4 üçlü, #9 üçlü, #12 X2, #14 1X).

## 2. Maç maç: tutmayanlar

### #2 Horsens – Nordsjaelland · öneri 2 (TEMKİNLİ) · sonuç X (1-1)
Favori %77 ile deplasmandı, aktif radarların üçü de 2 diyordu, sürpriz 0,
uyarı yoktu. Favori öndeyken beraberliğe düşen maç. **Hüküm: VARYANS.**
Not: Danimarka maçlarında Radar 1 ve 2 kapalıydı (3 aktif radar, kalite 89).

### #3 Randers – Silkeborg · öneri 1 (NET) · sonuç X (1-1)
%77 favori, radarlar 1, sürpriz 0, uyarı yok. **Hüküm: VARYANS + KAPSAM.**
Yine Danimarka: performans/xG radarları kapalıydı; beraberlik eğilimini
görebilecek iki katman devre dışıydı.

### #8 Malmö – Elfsborg · öneri 1 (GÜÇLÜ ADAY) · sonuç 2 (1-2)
**Haftanın en net süreç hatası.** Sinyaller: favori yalnız %54, yatma riski 54,
sürpriz DNA **44** (üç özellik birden eşleşmiş: favorinin xG desteği düşüyor +
sonuçlara göre zayıf gerçek performans + oran–oynanma tersliği), ve **Radar 4
(Oran) açıkça "2" diyordu**. Bütün bunlara rağmen en yüksek güven etiketi
verildi. Sonucu Radar 4 bildi. **Hüküm: SÜREÇ HATASI** — 1526 raporundaki
düzeltme (sürpriz sinyali yüksekken en yüksek etiket verilmez) tam bu vakayı
da kapsıyor; radar çatışmasının karara bağlanması (öneri 1) hâlâ açık iş.

### #13 Lech Poznan – Cracovia · öneri 1 (NET) · sonuç X (0-0)
%80 favori (haftanın en yüksek ikincisi), uyarı yok, sürpriz 0; Polonya
maçında performans/xG kapalı (3 radar). **Hüküm: VARYANS + KAPSAM.**
0-0 için eldeki hiçbir katmanda sinyal yoktu.

### #15 Zaglebie Lubin – P. Gliwice · öneri X (NET) · sonuç 1 (2-0)
**Motor çelişkisi vakası.** Kupon motoru NET etiketiyle **tekli X** yazdı;
oysa Radar Merkezi master'ı aynı maçta **%77 ile 1** diyordu ve iki aktif
radar da 1 gösteriyordu. Master haklı çıktı, kupon önerisi yattı. İki motorun
aynı maçta ters TEKLİ üretebilmesi ve bunun hiçbir katmanda uyarı
doğurmaması başlı başına bir süreç açığıdır. **Hüküm: SÜREÇ HATASI
(çelişki denetimi yok).** Kupon motorunun X'i neden seçtiği ayrıca
incelenmeli (muhtemelen o anki ihtimal girdisi; kayıtta "NET" eşiğini X
geçmiş görünüyor).

## 3. Radar karşılaştırması — 1525 ve iki haftalık toplam

| Kaynak | 1525 | 1526 | Toplam | % |
|---|---|---|---|---|
| Master (birleşim) | 10/15 | 9/15 | 19/30 | 63 |
| Radar 3 · Oynanma DNA | 10/15 | 9/15 | 19/30 | 63 |
| Radar 4 · Oran Takibi | 10/15 | 8/15 | 18/30 | 60 |
| Radar 2 · xG/Beklenti | 4/8 | 6/12 | 10/20 | 50 |
| Radar 1 · Rakip Gücü | 5/8 | 3/11 | 8/19 | 42 |

- **Tek haftayla hüküm vermenin tehlikesi burada görünüyor:** Radar 1,
  1526'da %27'ydi, 1525'te %63 (5/8). İki haftalık toplamı %42 — hâlâ düşük
  ama "bozuk" demek için erken. Örneklem uyarısı geçerli (n≤30).
- **Radar 4'ün asıl değeri isabet yüzdesi değil:** iki haftanın da en net
  sürprizini yalnız o yakaladı (1525 Malmö "2", 1526 Hacken "2"). Favoriyle
  ters düştüğü anlar bilgi taşıyor — ama bu uyarı bugün hiçbir karara bağlı değil.
- Radar 3 "1-ağırlıklı bültende hep favoriyi söyleme" eğilimiyle yüksek
  görünüyor; ayrışması az.

## 4. İki haftanın ortak örüntüleri

1. **Skor aynı: 10/15 + 10/15.** Yanlışların dağılımı da benzer: sonucu 1
   bitmeyen maçlarda yanılıyor (iki haftada 1 biten 17 maçın 16'sı bilindi;
   X/2 biten 13 maçın yalnız 4'ü).
2. **Beraberlik en zayıf nokta:** iki haftada 7 maç X bitti, yalnız 1'i
   yakalandı (1525 #1). X tahmini toplam 3 kez yazıldı (1✓ 2✗).
3. **Radar çatışması + yüksek sürpriz = tekli yazma** hatası her iki haftada
   da en az bir maçı götürdü (1525 #8, 1526 #5/#13). Dürüst ölçüm: önerilen
   korumalar geriye dönük 1525 #8 (Malmö) ve #15'i (motor çelişkisi)
   KURTARIRDI; 1526 #5 ve #13'te ise genişletme ikinci ihtimal olarak "2"yi
   eklerdi, sonuç X geldiği için yine yatardı. Yani korumalar isabet
   garantisi değil, sinyal varken tek seçeneğe sıkışmama önlemidir.
4. **Kapsam sorunu:** perf/xG radarlarının kapalı olduğu maçlarda (kupa +
   Danimarka/Polonya) yanlış oranı belirgin yüksek: iki haftada bu tip 13
   maçın 6'sı yanlış (%46), tam veri olan 17 maçın 4'ü (%24).
5. **İyi çalışanlar:** genişletme mekanizması (iki haftada 8 kurtarma) ve
   mühürlü Güçlü Aday'lar (1525: 4/5 — yatan, sinyalleri görmezden gelen
   Malmö'ydü; 1526: 2/2).

## 5. Sonuç

1525 de 1526 ile aynı resmi veriyor: sistemin favori-yönlü isabeti makul,
ama (a) sürpriz/çatışma sinyalleri karar katmanına bağlı değil, (b) veri
kapsamı dar maçlarda güven yüksek gösteriliyor, (c) beraberlik sinyali zayıf,
(d) iki motor birbirinden habersiz ters tekli üretebiliyor (#15). Dördü de
kod düzeyinde adreslenebilir; hiçbiri "şans" mazereti gerektirmiyor. Tek
haftalık yüzdelerle radar ağırlığı değiştirilmemeli — örneklem büyüsün.
