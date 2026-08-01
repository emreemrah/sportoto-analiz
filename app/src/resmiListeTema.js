// RESMÎ LİSTE PALETİ — resmî listenin DÜZENİ, uygulamanın RENKLERİ.
//
// KARAR (emrah, 01.08.2026): "bizim renklere uyumlu olsun".
// Önce resmî sitenin renkleri (mavi-gri + parlak kırmızı bant) kullanılmıştı;
// uygulamanın lacivert paletiyle çakışıyordu — özellikle "Açıklanan Sonuçlar"
// bandı, hemen üstündeki lacivert "Kupon Oluştur" düğmesinin yanında yabancı
// duruyordu.
//
// ÇÖZÜM: renkler artık theme.js'ten TÜRETİLİYOR, elle yazılmıyor. Yani tema
// bir gün değişirse liste kendiliğinden uyar; ikinci bir palet bakımı yok.
// Resmî listeden korunan şey DÜZENDİR: sıkı satırlar, düz köşeler, zebra,
// dikey ayraçlar, tam genişlik bant.
//
// ⚠ MARKA NOTU: Ekrandaki kaynak satırı ve BAĞIMSIZLIK BEYANI kalır —
// düzen resmî listeye benzediği sürece bu iki satır daha da gereklidir.
// Uzantı AÇIK: node:test uzantısız çözemiyor (bkz. resmiListe.js'teki aynı not).
import { colors } from './theme.js';

export const RL = {
  // Zemin ve satırlar
  sayfa: colors.surface,
  satir: colors.surface,
  satirAlt: colors.surfaceSoft,   // zebra — uygulamanın kendi açık tonu
  cizgi: colors.border,

  // Yazı — uygulamanın metin hiyerarşisi
  baslik: colors.muted,
  metin: colors.textSoft,
  guclu: colors.text,
  soluk: colors.muted,

  // Üst şerit ve bant: uygulamanın LACİVERT ana rengi (resmî sitedeki
  // parlak kırmızı değil). Bant, hemen üstündeki "Kupon Oluştur" düğmesiyle
  // aynı renk olduğu için ekran tek parça görünür.
  ustCizgi: colors.primary,
  bant: colors.primary,
  bantYazi: colors.white,

  // Alt bilgi satırları (15 Bilen / Kapanış / Açıklamalar)
  etiketZemin: colors.primarySoft,
  etiketYazi: colors.textSoft,
  degerZemin: colors.surfaceSoft,
  degerYazi: colors.textSoft,
};

// Ölçüler — resmî listedeki sıkı, tablo hissi. Renk değil DÜZEN burada
// korunuyor: uygulamanın genel yuvarlaklığından belirgin biçimde daha düz.
export const RLO = {
  satirYuksekligi: 44,
  koseYaricapi: 6,
  bantYaricapi: 8,
  yaziBoyu: 12,
  baslikBoyu: 11.5,
  armaBoyu: 22,
};
