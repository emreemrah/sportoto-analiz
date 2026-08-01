// RESMÎ LİSTE PALETİ — yalnız Resmî Liste ekranı için.
//
// NEDEN AYRI DOSYA: Bu ekran resmî listenin GÖRÜNÜMÜNÜ yansıtır; uygulamanın
// geri kalanı kendi paletini (theme.js) kullanır. İki palet karışırsa aynı
// uygulamada iki farklı gri, iki farklı kırmızı çıkar. Buradaki renkler
// theme.js'e SIZDIRILMAZ ve theme.js'ten buraya renk alınmaz.
//
// DEĞERLER YAKLAŞIKTIR: paylaşılan ekran görüntüsünden okundu, resmî bir
// stil kılavuzundan değil. İnce ayar gerekirse yalnız bu dosya değişir —
// ekran dosyasında tek bir renk sabiti yoktur.
//
// ⚠ MARKA NOTU: Görünümün resmî siteye yaklaşması, açık işler listesindeki
// marka/impersonation riskini büyütür (uygulama adı kararı henüz verilmedi).
// Bu yüzden ekranda kaynak satırı ve BAĞIMSIZLIK BEYANI kalır — kaldırılmamalı.

export const RL = {
  // Zemin ve satırlar
  sayfa: '#ffffff',
  satir: '#ffffff',
  satirAlt: '#eef4f8',        // zebra — çok açık mavi-gri
  cizgi: '#e3ebf1',           // ince ayraç

  // Yazı
  baslik: '#8ba6ba',          // tablo başlıkları (Sıra/Maç/…) — soluk mavi-gri
  metin: '#6f93ab',           // maç adı, gün, saat — mavi-gri
  guclu: '#3f5f76',           // skor/sonuç gibi öne çıkan sayılar
  soluk: '#9db3c2',           // yardımcı notlar

  // Üst şerit ve kırmızı bant
  ustCizgi: '#9c1231',        // sayfanın en üstündeki koyu kırmızı şerit
  bant: '#e2172f',            // "Açıklanan Sonuçlar" bandı
  bantYazi: '#ffffff',

  // Alt bilgi satırları (15 Bilen / Kapanış / Açıklamalar)
  etiketZemin: '#eef4f8',
  etiketYazi: '#7e9bb0',
  degerZemin: '#f7fafc',
  degerYazi: '#6f93ab',
};

// Ölçüler — resmî listedeki sıkı, tablo hissi (uygulamanın genel
// yuvarlaklığından belirgin biçimde daha düz).
export const RLO = {
  satirYuksekligi: 44,
  koseYaricapi: 3,
  bantYaricapi: 4,
  yaziBoyu: 12,
  baslikBoyu: 11.5,
  armaBoyu: 22,
};
