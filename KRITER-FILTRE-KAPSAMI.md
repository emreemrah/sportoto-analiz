# Genel Filtreler — 40 Kriterin Kapsam Listesi (GÜNCEL: maç logu bağlandı)

Kaynak: `criterionCatalog.js` (tek doğruluk kaynağı) · Filtreler: Dönem (P) · Saha (S) · Rakip gücü (R)

## ✅ ŞU AN UYGULUYOR — 21 kriter (6 + yeni bağlanan 15)

**Yeni bağlananlar (sezon maç logundan — sonuç/skor/saha/maç-anı rakip sınıfı):**
Galibiyet Sayısı · Mağlubiyet Sayısı · Beraberlik Eğilimi · Attığı Gol · Yediği Gol · Averaj · 2.5 Üst · KG Var · Temiz Kale · Gol Atamadı · İç/Dış Performans · İç/Dış PPG · İç/Dış Gol · İç/Dış Yediği Gol · Deplasmanda Direnç — hem backend Master Analiz'de hem panelde; P+S+R üçü de. Rakip sınıfı maç ANINDAKİ altın kural sınıfıdır (ID bazlı, ad eşleşmesi yok, bugünkü tablo geçmişe uygulanmaz). Örneklem yetmezse "yeterli maç yok" der.

**Önceden bağlı olanlar (6):**

| Kriter | Filtreler | Not |
|---|---|---|
| Son Maç Formu (formGeneral) | P + S + R | Panelde de canlı — "[Filtre: …]" notuyla |
| PPG (Maç Başı Puan) (ppg) | P + R | Panelde de canlı |
| Gol / Maç (goalsPerGame) | P + R | Backend Master Analiz'de |
| Yediği Gol / Maç (concededPerGame) | P + R | Backend Master Analiz'de |
| Ortak Rakip Kıyaslaması (commonOpponents) | R | Backend Master Analiz'de |
| Form Düşüşü (formDrop) | R | Backend Master Analiz'de |

Rakip sınıfı hepsinde altın kuralla: gerçek puan farkı ≥ 10 → güçlü/zayıf (ppg verisi yoksa sıra dilimi yedeği). Yeterli maç yoksa kriter "yeterli maç yok" der, uydurmaz.

## 🚫 YAPILAMAZ — kaynak maç-bazlı kırılım vermiyor (10 kriter)

xG (Hücum) · xG Karşı (Savunma) · İç / Dış xG (Hücum) · İç / Dış xGA (Savunma) · Topla Oynama · Şut · İsabetli Şut · Korner · Faul · Kart

Kaynak bu değerleri yalnız **sezon ortalaması** olarak verir; "güçlüye karşı korner ortalaması" diye bir veri yoktur — hesaplamak uydurma olurdu. Filtre açıkken bu kriterler kartta açıkça "[Genel filtre bu kriterde uygulanamadı — kaynakta kırılım yok; genel değer kullanıldı]" diye işaretlenir.

## ➖ FİLTRE KAVRAMI UYGULANMAZ (9 kriter)

Lig Sırası · Takım Güç Kıyaslaması · Puan / Puan Farkı · Ev Sahibi Avantajı · Eksik Oyuncu · Golcü Oyuncu Eksikliği · Asist Yapan Oyuncu Eksikliği · Teknik Direktör Değişimi · Yeni Hoca Etkisi

Bunlar geçmiş maç kesiti değil **güncel durum / sabit katkı** bilgisidir (bugünkü sıra/puan, kadro/hoca; Ev Sahibi Avantajı sabit hafif katkıdır — filtreyle değişmez). Kadro/hoca kriterleri zaten kaynak bağlı olmadığı için "veri bulunamadı" der.

---
Toplam: 21 + 10 + 9 = **40 kriter**. Filtre davranışı her satırda görünürdür: uygulayan "[Filtre: …]", uygulayamayan "genel değer", örneklemi yetmeyen "yeterli maç yok". Maç logu her bülten tazelemesinde yeniden üretilir; log henüz oluşmadıysa (eski cache) kriter dürüstçe genel değere düşer ve bunu söyler.
