// RESMÎ LİSTE TABLOSU — resmî sitedeki maç tablosu, tek bileşen.
//
// NEDEN BİLEŞEN: Aynı tablo İKİ ekranda görünüyor (Bülten ve Resmî Liste).
// Kopyalansaydı iki ayrı gerçek olurdu: birinde düzeltilen bir biçim
// hatası diğerinde kalırdı ve hangisinin doğru olduğu belirsizleşirdi.
//
// Bu bileşen VERİ ÜRETMEZ; biçimlendirmeyi resmiListe.js yapar, renkleri
// resmiListeTema.js verir. Burada yalnız yerleşim vardır.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { spacing } from '../theme';
import { RL, RLO } from '../resmiListeTema';
import { Logo } from '../ui';
import { crestOf } from '../utils';
import {
  macGunu, macSaati, skorMetni, sonucMetni, kademeSatirlari, altSatirlar,
} from '../resmiListe';

/** Sütunlar arası ince dikey ayraç (resmî listedeki "|" çizgileri). */
const Ayrac = () => <View style={st.ayrac} />;

function Satir({ item, zebra, onPress }) {
  const govde = (
    <>
      <Text style={st.hSira}>{item.no}</Text>
      <Ayrac />
      {/* ARMALAR ADLARLA BİRLİKTE ORTALANIR.
          Önce arma-ad-arma üçlüsü hücreye YAYILIYORDU (ad flex:1): geniş
          ekranda armalar hücrenin iki ucuna savruluyor, aradaki boşluk
          kocaman açılıyordu. Telefonda daha az belliydi ama yapı aynıydı —
          yani "web'de öyle görünüyor" değil, yerleşim hatasıydı.
          Şimdi üçlü tek grup hâlinde ortalanıyor; hücre genişledikçe
          boşluk grubun DIŞINDA kalıyor, armalar adın yanında duruyor. */}
      <View style={[st.hMac, st.macHucre]}>
        <Logo uri={crestOf(item, 'home')} name={item.home?.name} size={RLO.armaBoyu} />
        <Text style={st.macYazi} numberOfLines={1}>
          {item.home?.mediumName || item.home?.name} – {item.away?.mediumName || item.away?.name}
        </Text>
        <Logo uri={crestOf(item, 'away')} name={item.away?.name} size={RLO.armaBoyu} />
      </View>
      <Ayrac />
      <Text style={st.hGun}>{macGunu(item.date)}</Text>
      <Ayrac />
      <Text style={st.hSaat}>{macSaati(item.date)}</Text>
      <Ayrac />
      <Text style={st.hSkor}>{skorMetni(item)}</Text>
      <Ayrac />
      <Text style={st.hSonuc}>{sonucMetni(item)}</Text>
    </>
  );

  // Dokunma İSTEĞE BAĞLI: onPress verilmezse düz satır çizilir. Çalışmayan
  // bir düğme görüntüsü bırakılmaz.
  if (!onPress) {
    return (
      <View style={[st.satir, zebra && st.zebra]} testID={`resmi-satir-${item.no}`}>{govde}</View>
    );
  }
  return (
    <TouchableOpacity
      style={[st.satir, zebra && st.zebra]}
      onPress={onPress}
      activeOpacity={0.7}
      testID={`resmi-satir-${item.no}`}
    >
      {govde}
    </TouchableOpacity>
  );
}

/**
 * @param maclar        bülten maçları (no, home, away, date, score, result)
 * @param onSatirPress  (no) => void · verilmezse satırlar dokunulmaz olur
 */
export default function ResmiListeTablosu({ maclar = [], onSatirPress = null, bosNot, yukleniyor = false }) {
  return (
    <View>
      <View style={[st.satir, st.baslikSatiri]}>
        <Text style={[st.hSira, st.baslikYazi]}>Sıra</Text>
        <Ayrac />
        <Text style={[st.hMac, st.baslikYazi]}>Maç</Text>
        <Ayrac />
        <Text style={[st.hGun, st.baslikYazi]}>Maç Günü</Text>
        <Ayrac />
        <Text style={[st.hSaat, st.baslikYazi]}>Maç Saati</Text>
        <Ayrac />
        <Text style={[st.hSkor, st.baslikYazi]}>Skor</Text>
        <Ayrac />
        <Text style={[st.hSonuc, st.baslikYazi]}>Sonuç</Text>
      </View>

      {/* BAŞLIK SATIRI HER ZAMAN ÇİZİLİR. Yüklenirken tabloyu tamamen
          gizlemek başlığı da götürüyor ve ekran her tazelemede titriyordu. */}
      {yukleniyor && !maclar.length ? (
        <View style={st.orta}><ActivityIndicator color={RL.bant} /></View>
      ) : !maclar.length ? (
        <Text style={st.bosNot}>{bosNot || 'Bu hafta için maç listesi bulunamadı.'}</Text>
      ) : maclar.map((m, i) => (
        <Satir
          key={m.no ?? i}
          item={m}
          zebra={i % 2 === 1}
          onPress={onSatirPress ? () => onSatirPress(m.no) : null}
        />
      ))}
    </View>
  );
}

/** "Açıklanan Sonuçlar" bölümü — kırmızı bant + kademe/kapanış satırları. */
export function AciklananSonuclar({ prize, closeDate }) {
  const satirlar = [...kademeSatirlari(prize), ...altSatirlar(prize, closeDate)];
  return (
    <View>
      <View style={st.kirmiziBant}>
        <Text style={st.kirmiziBantYazi}>Açıklanan Sonuçlar</Text>
      </View>
      {satirlar.map((s) => (
        <View key={s.etiket} style={st.altSatir}>
          <Text style={st.altEtiket}>{s.etiket}</Text>
          <Text style={st.altDeger}>{s.deger}</Text>
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  satir: {
    flexDirection: 'row', alignItems: 'center',
    minHeight: RLO.satirYuksekligi,
    paddingHorizontal: spacing.md,
    backgroundColor: RL.satir,
  },
  zebra: { backgroundColor: RL.satirAlt },
  baslikSatiri: { minHeight: 34, backgroundColor: RL.sayfa },
  baslikYazi: { color: RL.baslik, fontSize: RLO.baslikBoyu, fontWeight: '600' },

  hSira: { width: 38, textAlign: 'center', color: RL.metin, fontSize: RLO.yaziBoyu },
  hMac: { flex: 1, minWidth: 130 },
  hGun: { width: 120, textAlign: 'center', color: RL.metin, fontSize: RLO.yaziBoyu },
  hSaat: { width: 60, textAlign: 'center', color: RL.metin, fontSize: RLO.yaziBoyu },
  hSkor: { width: 46, textAlign: 'center', color: RL.metin, fontSize: RLO.yaziBoyu },
  hSonuc: { width: 48, textAlign: 'center', color: RL.metin, fontSize: RLO.yaziBoyu },
  ayrac: { width: 1, alignSelf: 'stretch', backgroundColor: RL.cizgi, marginVertical: 10 },

  // justifyContent:'center' + macYazi'da flex YOK: üçlü tek grup olarak
  // ortalanır, boşluk grubun dışında kalır. (flex:1 verilseydi ad hücreyi
  // doldurur ve armaları uçlara iterdi — düzeltilen hata buydu.)
  macHucre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8 },
  macYazi: { color: RL.metin, fontSize: RLO.yaziBoyu, textAlign: 'center', flexShrink: 1 },

  kirmiziBant: {
    backgroundColor: RL.bant, borderRadius: RLO.bantYaricapi,
    paddingVertical: 11, alignItems: 'center',
    marginTop: spacing.lg, marginBottom: spacing.sm, marginHorizontal: spacing.md,
  },
  kirmiziBantYazi: { color: RL.bantYazi, fontSize: 13, fontWeight: '700' },

  altSatir: { flexDirection: 'row', alignItems: 'stretch', marginHorizontal: spacing.md, marginBottom: 6 },
  altEtiket: {
    width: 132, backgroundColor: RL.etiketZemin, color: RL.etiketYazi,
    fontSize: RLO.yaziBoyu, paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: RLO.koseYaricapi,
  },
  altDeger: {
    flex: 1, backgroundColor: RL.degerZemin, color: RL.degerYazi,
    fontSize: RLO.yaziBoyu, paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: RLO.koseYaricapi, marginLeft: 6,
  },

  orta: { paddingVertical: spacing.xl, alignItems: 'center' },
  bosNot: {
    color: RL.soluk, fontSize: RLO.yaziBoyu, fontStyle: 'italic',
    paddingVertical: spacing.lg, textAlign: 'center',
  },
});
