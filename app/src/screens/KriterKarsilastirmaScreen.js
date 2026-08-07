// ---------------------------------------------------------------------------
// KRİTER KARŞILAŞTIRMA — "hangi iş için hangi kriter" (2026-08-07)
// ---------------------------------------------------------------------------
// KULLANICININ TARİFİ (birebir): "Claude kod yazmada başarılı, ChatGPT dikte
// ve resim üretmede. Bizim derdimiz maç değil, KRİTERİN KENDİSİ."
//
// Kriter kırılımı ekranı "TEK kriter, tüm işler" gösterir. Bu ekran tabloyu
// ters çevirir: "TEK iş, tüm kriterler". Her iş için kriterler sıralanır ve
// o işin ustası kim görünür.
//
// İKİ GÖRÜNÜM:
//   • İŞE GÖRE   — ağır favorili maçta kim iyi? X demekte kim iyi?
//   • KRİTERE GÖRE — her kriterin uzmanlık alanı ve zayıf alanı
//
// SIRALAMA ham yüzdeye göre DEĞİL: 3 maçta %100 yapan, 20 maçta %70 yapanın
// üstüne çıkmasın diye güvenilirlik alt sınırı kullanılır (backend hesaplar).
// Gösterilen yüzde her zaman HAM yüzdedir; yalnız sıra düzeltilir.
//
// DÜRÜSTLÜK: eşiğin altındaki kriter listeden ATILMAZ ama "az" işaretlenir ve
// "uzman" ilan edilemez. Uzmanlık yoksa uydurulmaz, "henüz belirlenemedi" denir.

import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';

import { api } from '../api';
import { colors, spacing, radius } from '../theme';

/** Yüzdeyi yazar; ölçüm yoksa "—". "%0" yazılmaz. */
const yuzde = (v) => (v == null ? '—' : `%${v}`);

function SiraSatiri({ s, madalya }) {
  return (
    <View style={st.sSatir}>
      <Text style={st.sMadalya}>{madalya}</Text>
      <Text style={st.sAd} numberOfLines={1}>{s.ad}</Text>
      <View style={st.sSag}>
        <Text style={st.sOran}>{yuzde(s.oran)}</Text>
        <Text style={st.sMac}>
          {s.mac} maçta {s.dogru}{s.azOrneklem ? ' · az' : ''}
        </Text>
      </View>
    </View>
  );
}

function IsKarti({ is }) {
  const [acik, setAcik] = useState(false);
  const list = is.siralama || [];
  if (!list.length) {
    return (
      <View style={st.kart}>
        <Text style={st.isBaslik}>{is.baslik}</Text>
        <Text style={st.bos}>Bu iş için ölçülebilir maç yok.</Text>
      </View>
    );
  }
  const gorunen = acik ? list : list.slice(0, 3);
  return (
    <View style={st.kart}>
      <Text style={st.isBaslik}>{is.baslik}</Text>
      {is.aciklama ? <Text style={st.isAlt}>{is.aciklama}</Text> : null}
      {gorunen.map((s, i) => (
        <SiraSatiri key={s.key} s={s} madalya={i === 0 ? '1.' : `${i + 1}.`} />
      ))}
      {list.length > 3 ? (
        <TouchableOpacity
          onPress={() => setAcik((x) => !x)}
          accessibilityRole="button"
          accessibilityLabel={`${is.baslik} için tüm kriterleri göster`}
        >
          <Text style={st.acKapa}>
            {acik ? '− Kısalt' : `+ Kalan ${list.length - 3} kriteri gör`}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function KriterKarti({ k, onAc }) {
  return (
    <TouchableOpacity
      style={st.kart}
      activeOpacity={0.7}
      onPress={() => onAc(k)}
      accessibilityRole="button"
      accessibilityLabel={`${k.ad} kriterinin kırılımını aç`}
    >
      <View style={st.kUst}>
        <Text style={st.kAd} numberOfLines={1}>{k.ad}</Text>
        <Text style={st.kGenel}>{yuzde(k.oran)}</Text>
        <Text style={st.kOk}>›</Text>
      </View>
      <Text style={st.kMac}>{k.mac} maçta {k.dogru} doğru</Text>

      {k.uzmanlik ? (
        <>
          <Text style={st.kIyi}>
            <Text style={st.kEtiket}>Uzmanlık: </Text>
            {k.uzmanlik.baslik} · {yuzde(k.uzmanlik.oran)} ({k.uzmanlik.mac} maç)
          </Text>
          {k.zayif ? (
            <Text style={st.kKotu}>
              <Text style={st.kEtiket}>Zayıf: </Text>
              {k.zayif.baslik} · {yuzde(k.zayif.oran)} ({k.zayif.mac} maç)
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={st.kYok}>
          Uzmanlık henüz belirlenemedi — hiçbir işte yeterli maç yok.
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function KriterKarsilastirmaScreen({ navigation }) {
  const [veri, setVeri] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [gorunum, setGorunum] = useState('is');   // 'is' | 'kriter'

  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const r = await api.analysisKriterKarsilastirma();
        if (!iptal) setVeri(r);
      } catch (e) {
        if (!iptal) setHata(e?.message || 'Karşılaştırma okunamadı.');
      } finally {
        if (!iptal) setYukleniyor(false);
      }
    })();
    return () => { iptal = true; };
  }, []);

  // İşleri gruplayarak göster (Maç tipi, Kalabalık profili, ...).
  const gruplar = [];
  for (const is of veri?.isler || []) {
    let g = gruplar.find((x) => x.ad === is.grup);
    if (!g) { g = { ad: is.grup, isler: [] }; gruplar.push(g); }
    g.isler.push(is);
  }

  return (
    <View style={st.kok}>
      <View style={st.ust}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={st.geri}
          accessibilityRole="button"
          accessibilityLabel="Geri dön"
        >
          <Text style={st.geriTxt}>‹</Text>
        </TouchableOpacity>
        <View style={st.ustOrta}>
          <Text style={st.ustEtiket}>KRİTER KARŞILAŞTIRMA</Text>
          <Text style={st.ustAd}>Hangi iş için hangi kriter</Text>
        </View>
      </View>

      <View style={st.sekmeler}>
        {[['is', 'İşe göre'], ['kriter', 'Kritere göre']].map(([k, etiket]) => (
          <TouchableOpacity
            key={k}
            style={[st.sekme, gorunum === k && st.sekmeAcik]}
            onPress={() => setGorunum(k)}
            accessibilityRole="button"
            accessibilityLabel={etiket}
          >
            <Text style={[st.sekmeTxt, gorunum === k && st.sekmeTxtAcik]}>{etiket}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {yukleniyor ? (
        <View style={st.bekle}>
          <ActivityIndicator color={colors.primary} />
          <Text style={st.bekleTxt}>40 kriter mühürlü arşivde karşılaştırılıyor…</Text>
        </View>
      ) : hata ? (
        <View style={st.icerik}><Text style={st.hata}>{hata}</Text></View>
      ) : (
        <ScrollView contentContainerStyle={st.icerik}>
          {veri?.uyari ? <Text style={st.uyari}>{veri.uyari}</Text> : null}

          {gorunum === 'is' ? (
            <>
              <Text style={st.aciklama}>
                Her iş için kriterler sıralandı. Sıralama ham yüzdeye göre değil,
                güvenilirliğe göre: az maçta çıkan yüksek yüzde öne geçemez.
              </Text>
              {gruplar.map((g) => (
                <View key={g.ad}>
                  <Text style={st.grupBaslik}>{g.ad}</Text>
                  {g.isler.map((is) => <IsKarti key={is.ad} is={is} />)}
                </View>
              ))}
            </>
          ) : (
            <>
              <Text style={st.aciklama}>
                Her kriterin en güçlü ve en zayıf olduğu iş. Bir kriter ancak bir
                işte {veri?.uzmanlikMinMac ?? 8}+ maç görürse "uzman" sayılır.
                Kritere dokun → tam kırılımı açılır.
              </Text>
              {(veri?.kriterler || []).map((k) => (
                <KriterKarti
                  key={k.key}
                  k={k}
                  onAc={(x) => navigation.navigate('KriterKirilim', { key: x.key, ad: x.ad })}
                />
              ))}
            </>
          )}

          <Text style={st.altNot}>
            "az" = 5 maçın altı; tesadüfe açık. Bunlar geçmiş gözlemleridir,
            kesin sonuç veya kazanç vaadi değildir.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  kok: { flex: 1, backgroundColor: colors.bg },
  ust: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  geri: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  geriTxt: { fontSize: 26, color: colors.primary, fontWeight: '800', marginTop: -4 },
  // TAŞMA KORUMASI (ders §11): flex:1 tek başına yetmez.
  ustOrta: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, marginLeft: 4 },
  ustEtiket: { color: colors.textMuted, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.5 },
  ustAd: { color: colors.text, fontSize: 15, fontWeight: '900' },

  sekmeler: {
    flexDirection: 'row', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 8,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sekme: {
    flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, paddingVertical: 7,
    borderRadius: radius.sm, backgroundColor: colors.bgAlt, alignItems: 'center',
  },
  sekmeAcik: { backgroundColor: colors.primary },
  sekmeTxt: { color: colors.textSoft, fontSize: 12.5, fontWeight: '800' },
  sekmeTxtAcik: { color: colors.white },

  bekle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: spacing.md },
  bekleTxt: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  hata: { color: colors.danger, fontSize: 12.5, lineHeight: 18 },

  icerik: { padding: spacing.md, paddingBottom: spacing.xl },
  uyari: {
    backgroundColor: colors.warningSoft, color: colors.text, fontSize: 11.5, lineHeight: 16,
    padding: spacing.sm, borderRadius: radius.sm, marginBottom: spacing.md,
  },
  aciklama: { color: colors.textMuted, fontSize: 11.5, lineHeight: 16, marginBottom: spacing.md },
  grupBaslik: {
    color: colors.textMuted, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.6,
    marginBottom: 6, marginTop: 4,
  },

  kart: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  isBaslik: { color: colors.text, fontSize: 13, fontWeight: '900' },
  isAlt: { color: colors.textMuted, fontSize: 10.5, lineHeight: 14, marginTop: 2, marginBottom: 4 },
  bos: { color: colors.textMuted, fontSize: 11.5, marginTop: 4 },

  sSatir: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 7,
  },
  sMadalya: { color: colors.textMuted, fontSize: 11, fontWeight: '900', width: 18 },
  sAd: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, color: colors.text, fontSize: 12.5, fontWeight: '700' },
  sSag: { alignItems: 'flex-end', minWidth: 86 },
  sOran: { color: colors.text, fontSize: 14, fontWeight: '900' },
  sMac: { color: colors.textMuted, fontSize: 10 },

  kUst: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kAd: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, color: colors.text, fontSize: 13, fontWeight: '900' },
  kGenel: { color: colors.text, fontSize: 14, fontWeight: '900' },
  kOk: { color: colors.textMuted, fontSize: 16, fontWeight: '900' },
  kMac: { color: colors.textMuted, fontSize: 10.5, marginBottom: 5 },
  kEtiket: { color: colors.textMuted, fontWeight: '800' },
  kIyi: { color: colors.success, fontSize: 11.5, lineHeight: 16, fontWeight: '700' },
  kKotu: { color: colors.danger, fontSize: 11.5, lineHeight: 16, fontWeight: '700' },
  kYok: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },

  acKapa: { color: colors.primary, fontSize: 12, fontWeight: '800', marginTop: 8 },
  altNot: { color: colors.textMuted, fontSize: 10, lineHeight: 14, textAlign: 'center', marginTop: 4 },
});
