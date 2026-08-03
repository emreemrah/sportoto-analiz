// RADAR 5 — BİR SIRANIN GEÇMİŞ MAÇLARI (TABLO).
//
// NEDEN AYRI DOSYA: RadarScreen zaten çok büyük. Bu liste kendi başına bir
// okuma birimi; burada durunca hem ekran küçülüyor hem düzen tek yerden
// değişiyor.
//
// TASARIM: kullanıcının verdiği bülten tablosunun aynısı — başlık satırı, sabit
// sütunlar, satır şeritlemesi. Sütun eşlemesi kullanıcının tarifi:
//   "durum sütununda oynanma yüzdeleri, sağında sonuç"
//   KARŞILAŞMA | 1 · X · 2 (oynanma) | SONUÇ
//
// NEDEN TABLO: önceki hâlde her maç iki sıkışık satırdı ve üç renkli rozet ile
// üç yüzde yan yana duruyordu; 2 maçta okunuyor, 20 maçta sayı duvarına
// dönüyordu ("veri çoğaldıkça karışıyor"). Tabloda 1/X/2 başlığı BİR KEZ üstte
// durur, sayılar hep aynı sütuna hizalanır — satır sayısı artınca göz sütunu
// tarar, her satırı yeniden çözmez.
//
// GERÇEKLEŞEN SONUÇ, kendi yüzde hücresinde vurgulanır. "Kalabalık neye
// oynadı, maç nasıl bitti" tek bakışta görünür — Radar 5'in bütün amacı bu.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { colors, radius } from '../theme';

const SECENEKLER = ['1', 'X', '2'];

// Sonuç rozetinin rengi. 1 mavi, X amber, 2 kırmızı — ekranın geri kalanıyla
// aynı dil (RadarScreen memOutcome* stilleri).
const ROZET = { '1': 'rozetBir', X: 'rozetBerabere', '2': 'rozetIki' };

function Satir({ mac, cift }) {
  const { week, home, away, score, result, played } = mac;
  const pct = played?.pct || null;
  return (
    <View style={[s.satir, cift && s.satirCift]}>
      <View style={s.macHucre}>
        {/* DÜZEN (kullanıcı kararı, 3 Ağustos 2026): hafta maçın BAŞINDA,
            skor iki takımın ORTASINDA — yani tire'nin durduğu yerde.
            Skor yoksa tire kalır; boşluk bırakmak takım adlarını birbirine
            yapıştırırdı.

            Hafta ve skor AYRI <Text> düğümleridir: tek metne birleştirilince
            "52. Hafta" ve "1-1" tek başına aranamaz hâle geliyor (testler ve
            ekran okuyucu ikisini de ayrı okumalı). İç içe Text kullanılmasının
            sebebi bu — tek satır akışı korunur, düğümler ayrı kalır. */}
        <Text style={s.takim} numberOfLines={2}>
          <Text style={s.hafta}>{week || '—'}</Text>
          {'  '}{home} <Text style={s.skor}>{score || '–'}</Text> {away}
        </Text>
      </View>

      {SECENEKLER.map((k) => {
        const v = pct?.[k];
        const gerceklesen = result === k;
        return (
          <View key={k} style={[s.oranHucre, gerceklesen && s.oranHucreGerceklesen]}>
            {/* Veri yoksa TİRE konur; %0 yazmak olmayan bilgiyi gerçek gibi
                gösterirdi. Tire, tablo dilinde "kayıt yok" demektir. */}
            <Text style={[s.oran, gerceklesen && s.oranGerceklesen]}>
              {v == null ? '–' : `%${v}`}
            </Text>
          </View>
        );
      })}

      <View style={s.sonucHucre}>
        <Text style={[s.sonuc, s[ROZET[result]] || s.sonucBos]}>{result || '?'}</Text>
      </View>
    </View>
  );
}

export default function SiraGecmisListesi({ kayit, donemEtiketi, limit }) {
  if (kayit?.yukleniyor) return <View style={s.kutu}><Text style={s.bilgi}>Maçlar yükleniyor…</Text></View>;
  if (kayit?.hata) return <View style={s.kutu}><Text style={s.bilgi}>Maçlar okunamadı: {kayit.hata}</Text></View>;

  const tumu = kayit?.liste || [];
  if (!tumu.length) return <View style={s.kutu}><Text style={s.bilgi}>Bu sıra için doğrulanmış geçmiş sonuç yok.</Text></View>;

  const liste = tumu.slice(0, limit ?? tumu.length);
  const enEski = liste[liste.length - 1]?.week;
  const kayitsiz = liste.filter((m) => !m.played?.pct).length;

  return (
    <View style={s.kutu}>
      {/* BAŞLIK SATIRI — 1/X/2'nin ne olduğu BİR KEZ burada söylenir. Önceki
          tasarımda her maçın altında "Oynanma" etiketi tekrarlanıyordu. */}
      <View style={s.baslikSatiri}>
        <Text style={[s.baslik, s.macHucre]}>KARŞILAŞMA</Text>
        {SECENEKLER.map((k) => (
          <Text key={k} style={[s.baslik, s.oranHucre, s.baslikOrta]}>{k}</Text>
        ))}
        <Text style={[s.baslik, s.sonucHucre, s.baslikOrta]}>SON</Text>
      </View>
      {/* Alt başlık ("oynanma yüzdesi · koyu hücre = gerçekleşen sonuç")
          kullanıcı kararıyla kaldırıldı (3 Ağustos 2026). Sütun başlıkları
          (1 · X · 2 · SON) zaten tabloyu anlatıyor; koyu hücre görsel olarak
          kendini gösteriyor. */}
      {liste.map((m, i) => <Satir key={`${m.roundId}-${i}`} mac={m} cift={i % 2 === 1} />)}

      {/* KAPSAM — iki gerçek de söylenir: listenin nereden başladığı ve üstteki
          yüzdenin ondan BAĞIMSIZ hesaplandığı. İkincisi olmazsa kullanıcı iki
          maçlık listeye bakıp üstteki yüzdeyi doğrulamaya çalışır. */}
      <Text style={s.bilgi}>
        {donemEtiketi || 'Seçili dönem'} · {liste.length} maç · liste {enEski || 'kayıt başlangıcı'}'ndan başlar
        {kayitsiz ? ` · ${kayitsiz} maçta oynanma kaydı yok (–)` : ''}
      </Text>
      <Text style={s.bilgi}>Üstteki yüzde tüm haftalardan hesaplanır.</Text>
    </View>
  );
}

// Sütun genişlikleri dar telefona (≈340 px liste genişliği) göre seçildi:
// 3×34 oran + 30 sonuç + boşluklar → karşılaşmaya ≈190 px kalır, iki satır sığar.
const ORAN_GENISLIK = 34;

const s = StyleSheet.create({
  kutu: { marginTop: 8, marginLeft: 34, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },

  baslikSatiri: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primary, borderTopLeftRadius: 6, borderTopRightRadius: 6,
    paddingVertical: 5, paddingHorizontal: 6,
  },
  baslik: { color: colors.white, fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  baslikOrta: { textAlign: 'center' },

  satir: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 6, paddingHorizontal: 6,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  // Şeritleme — uzun listede gözün satırı kaybetmemesi için.
  satirCift: { backgroundColor: colors.surfaceSoft },

  macHucre: { flex: 1, minWidth: 0, paddingRight: 6 },
  // Hafta ve skor, takım adlarının İÇİNDE akan iç Text'lerdir.
  // HAFTA sönük durur (konum bilgisi, okumanın hedefi değil).
  // SKOR ise satırın en belirgin ögesidir (kullanıcı kararı): marka rengi,
  // takım adından büyük ve daha kalın. "Maç nasıl bitti" sorusunun cevabı
  // satırda göze ilk çarpan şey olmalı — takım adları onun çevresinde okunur.
  hafta: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  skor: { color: colors.primary, fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },
  takim: { color: colors.text, fontSize: 12, fontWeight: '700', lineHeight: 19 },

  oranHucre: { width: ORAN_GENISLIK, alignItems: 'center', justifyContent: 'center', paddingVertical: 2, borderRadius: 4 },
  // Gerçekleşen sonucun hücresi koyulaşır: hangi seçeneğin çıktığı, yüzdesiyle
  // BİRLİKTE okunur. Ayrı bir sütun eklemeye gerek kalmaz.
  oranHucreGerceklesen: { backgroundColor: colors.primarySoft },
  oran: { color: colors.textSoft, fontSize: 11, fontWeight: '700' },
  oranGerceklesen: { color: colors.primary, fontWeight: '900' },

  sonucHucre: { width: 30, alignItems: 'center' },
  sonuc: {
    minWidth: 22, textAlign: 'center', color: colors.white, fontSize: 11, fontWeight: '900',
    borderRadius: radius.pill, paddingVertical: 2, overflow: 'hidden',
  },
  rozetBir: { backgroundColor: colors.info },
  rozetBerabere: { backgroundColor: colors.warning, color: colors.primary },
  rozetIki: { backgroundColor: colors.accent },
  sonucBos: { backgroundColor: colors.border, color: colors.textSoft },

  bilgi: { color: colors.muted, fontSize: 11, fontStyle: 'italic', marginTop: 6 },
});
