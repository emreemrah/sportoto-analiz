// ---------------------------------------------------------------------------
// GEÇMİŞ (MÜHÜRLÜ) MAÇ DETAYI — 2026-08-07
// ---------------------------------------------------------------------------
// NEDEN VAR: geçmiş bültende maç kartına basılamıyordu. Kart düz bir <View>'dı;
// hiçbir yere gitmiyordu. Oysa mühürlü haftada elimizdeki en değerli şey tam da
// bu: maç OYNANMADAN ÖNCE ne demişiz, sonra ne olmuş. Karne bunu toplu yüzde
// olarak gösteriyordu; tek maçta "hangi kriter ne dedi" görünmüyordu.
//
// NE GÖSTERİR (hepsi mühürlü kayıttan, yeniden hesap YOK):
//   • Resmî sonuç ve skor
//   • Maç öncesi mühürlenmiş sistem tahmini + tuttu mu
//   • Kriter kriter: hangi kriter hangi yönü söyledi, doğru muydu
//   • Mühür kanıtı: ne zaman mühürlendi, doğrulama özeti
//
// DÜRÜSTLÜK KURALLARI (proje kuralı, burada da geçerli):
//   • Mühür yoksa analiz UYDURULMAZ; "maç öncesi kayıt yok" yazılır.
//   • Resmî sonuç gelmemişse "tuttu/tutmadı" DENMEZ; "henüz resmî değil" denir.
//   • Bugünkü motorla geçmiş maç yeniden hesaplanmaz (backend zaten mühürlü
//     snapshot'ı okur; ekran da bunu açıkça yazar).

import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';

import { api } from '../api';
import { colors, spacing, radius } from '../theme';

const SEMBOL = { 1: 'Ev sahibi (1)', X: 'Beraberlik (X)', 2: 'Deplasman (2)' };

/** Sinyali okunur yöne çevirir; bilinmeyen değer uydurulmaz. */
function yon(sym) {
  return SEMBOL[sym] || (sym ? String(sym) : null);
}

export default function GecmisMacDetayScreen({ route, navigation }) {
  const { roundId, no, mac } = route.params || {};
  const [veri, setVeri] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const r = await api.analysisSealedMatch(roundId, no);
        if (!iptal) setVeri(r);
      } catch (e) {
        // SESSİZ YUTMA YOK: sebep ekranda yazar (404 = mühür yok).
        if (!iptal) setHata(e?.message || 'Analiz kaydı okunamadı.');
      } finally {
        if (!iptal) setYukleniyor(false);
      }
    })();
    return () => { iptal = true; };
  }, [roundId, no]);

  const resmiSonuc = mac?.result || null;                 // '1' | 'X' | '2' | null
  const skor = mac?.score ? `${mac.score.home} - ${mac.score.away}` : null;
  const master = veri?.match?.master || null;
  const tahmin = master?.mainPrediction || null;
  const muhurlu = veri?.freezeStatus === 'sealed';

  // İSABET yalnız RESMÎ sonuç varsa hesaplanır. Geçici/canlı skor sayılmaz.
  const isabet = (resmiSonuc && tahmin) ? tahmin === resmiSonuc : null;

  // Kriter kırılımı: mühürlü katkılar. Her satır kendi yönünü ve (resmî sonuç
  // varsa) doğru olup olmadığını taşır.
  const katkilar = Array.isArray(master?.contributions) ? master.contributions : [];
  const veriYok = Array.isArray(master?.missingData) ? master.missingData : [];

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
          <Text style={st.ustNo}>#{no}</Text>
          <Text style={st.ustAd} numberOfLines={1}>
            {mac?.home?.name || 'Ev sahibi'} – {mac?.away?.name || 'Deplasman'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={st.icerik}>
        {/* 1) RESMÎ SONUÇ */}
        <View style={st.kart}>
          <Text style={st.kartBaslik}>Resmî Sonuç</Text>
          {skor ? (
            <>
              <Text style={st.skor}>{skor}</Text>
              <Text style={st.skorAlt}>
                {resmiSonuc ? `Maç sonucu: ${yon(resmiSonuc)}` : 'Sonuç harfi bilinmiyor'}
              </Text>
            </>
          ) : (
            <Text style={st.bos}>Bu maç için resmî skor bulunamadı.</Text>
          )}
        </View>

        {/* 2) MAÇ ÖNCESİ NE DEMİŞİZ */}
        <View style={st.kart}>
          <Text style={st.kartBaslik}>Maç Öncesi Tahminimiz</Text>

          {yukleniyor ? (
            <View style={st.bekle}>
              <ActivityIndicator color={colors.primary} />
              <Text style={st.bekleTxt}>Mühürlü kayıt okunuyor…</Text>
            </View>
          ) : hata ? (
            <Text style={st.bos}>
              Bu maç için maç öncesi mühürlü analiz kaydı bulunamadı.
              {'\n'}Sebep: {hata}
              {'\n\n'}Mühür, tahminin maç başlamadan üretildiğinin kanıtıdır.
              Kaydı olmayan maç için sonradan analiz üretilmez.
            </Text>
          ) : !tahmin ? (
            <Text style={st.bos}>
              Mühürlü kayıt var ama bu maçta sistem tek bir yön söylememiş
              (kriterler denk çıkmış). Uydurma bir tahmin yazılmaz.
            </Text>
          ) : (
            <>
              <View style={st.tahminSatir}>
                <View style={st.tahminKutu}>
                  <Text style={st.tahminEtiket}>Sistem dedi</Text>
                  <Text style={st.tahminDeger}>{yon(tahmin)}</Text>
                </View>
                {isabet === null ? (
                  <View style={[st.rozet, st.rozetNotr]}>
                    <Text style={st.rozetTxt}>henüz resmî değil</Text>
                  </View>
                ) : (
                  <View style={[st.rozet, isabet ? st.rozetOk : st.rozetKotu]}>
                    <Text style={st.rozetTxt}>{isabet ? '✓ tuttu' : '✗ tutmadı'}</Text>
                  </View>
                )}
              </View>

              {master?.confidence ? (
                <Text style={st.satirNot}>Güven: {master.confidence}</Text>
              ) : null}
              {master?.summary ? (
                <Text style={st.ozet}>{master.summary}</Text>
              ) : null}

              {/* MÜHÜR KANITI — bu ekranın en önemli satırı. */}
              <Text style={st.muhur}>
                {muhurlu
                  ? 'Bu analiz maç öncesinde mühürlendi ve bugünkü verilerle '
                    + 'yeniden hesaplanmadı — gördüğün, o gün söylediğimizdir.'
                  : 'Bu hafta mühürlenmemiş; gösterilen değerler maç öncesi '
                    + 'dondurulmuş kayıttan gelmiyor olabilir.'}
              </Text>
            </>
          )}
        </View>

        {/* 3) KRİTER KIRILIMI */}
        {katkilar.length > 0 && (
          <View style={st.kart}>
            <Text style={st.kartBaslik}>Hangi Kriter Ne Dedi</Text>
            <Text style={st.kartAlt}>
              {resmiSonuc
                ? 'Sağdaki işaret, kriterin söylediği yönün resmî sonuçla '
                  + 'uyup uymadığını gösterir.'
                : 'Resmî sonuç gelmediği için doğru/yanlış işareti konmadı.'}
            </Text>
            {katkilar.map((k) => {
              const dogru = resmiSonuc ? k.signal === resmiSonuc : null;
              return (
                <View key={k.key} style={st.kSatir}>
                  <View style={st.kSol}>
                    <Text style={st.kAd} numberOfLines={1}>{k.label}</Text>
                    {k.familyLabel ? (
                      <Text style={st.kAile} numberOfLines={1}>{k.familyLabel}</Text>
                    ) : null}
                  </View>
                  <Text style={st.kYon}>{k.signal}</Text>
                  <Text style={[
                    st.kIsaret,
                    dogru === true && { color: colors.success },
                    dogru === false && { color: colors.danger },
                  ]}
                  >
                    {dogru === null ? '–' : (dogru ? '✓' : '✗')}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* 4) VERİ BULAMAYAN KRİTERLER — gizlenmez. */}
        {veriYok.length > 0 && (
          <View style={st.kart}>
            <Text style={st.kartBaslik}>Veri Bulamayan Kriterler ({veriYok.length})</Text>
            <Text style={st.kartAlt}>
              Bu kriterler bu maçta konuşmadı; sebebi aşağıda. Eksik veri
              gizlenmez, "bilinmiyor" olarak durur.
            </Text>
            {veriYok.map((v) => (
              <View key={v.key} style={st.vSatir}>
                <Text style={st.vAd}>{v.label}</Text>
                <Text style={st.vNeden}>{v.reason || 'Veri yok'}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={st.altNot}>
          Bu ekran geçmişe bakar; kesin sonuç veya kazanç vaadi değildir.
        </Text>
      </ScrollView>
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
  // TAŞMA KORUMASI (ders §11): başlık uzun takım adlarında satırdan taşıyordu.
  // `flex: 1` tek başına yetmez; flexBasis:0 + minWidth:0 şart.
  ustOrta: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, marginLeft: 4 },
  ustNo: { color: colors.textMuted, fontSize: 10, fontWeight: '800' },
  ustAd: { color: colors.text, fontSize: 14, fontWeight: '800' },

  icerik: { padding: spacing.md, paddingBottom: spacing.xl },
  kart: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  kartBaslik: { color: colors.text, fontSize: 13, fontWeight: '900', marginBottom: 4 },
  kartAlt: { color: colors.textMuted, fontSize: 11, lineHeight: 15, marginBottom: spacing.sm },

  skor: { color: colors.text, fontSize: 30, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  skorAlt: { color: colors.textSoft, fontSize: 12, textAlign: 'center', marginTop: 2 },
  bos: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },

  bekle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  bekleTxt: { color: colors.textMuted, fontSize: 12 },

  tahminSatir: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tahminKutu: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  tahminEtiket: { color: colors.textMuted, fontSize: 10, fontWeight: '800' },
  tahminDeger: { color: colors.text, fontSize: 16, fontWeight: '900' },
  rozet: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm },
  rozetOk: { backgroundColor: colors.successSoft },
  rozetKotu: { backgroundColor: colors.dangerSoft },
  rozetNotr: { backgroundColor: colors.bgAlt },
  rozetTxt: { fontSize: 11.5, fontWeight: '800', color: colors.text },
  satirNot: { color: colors.textSoft, fontSize: 11.5, marginTop: 6 },
  ozet: { color: colors.text, fontSize: 12.5, lineHeight: 17, marginTop: 6 },
  muhur: {
    color: colors.textMuted, fontSize: 10.5, lineHeight: 15, marginTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm,
  },

  kSatir: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 7,
  },
  kSol: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  kAd: { color: colors.text, fontSize: 12.5, fontWeight: '700' },
  kAile: { color: colors.textMuted, fontSize: 10 },
  kYon: { width: 22, textAlign: 'center', color: colors.text, fontSize: 13, fontWeight: '900' },
  kIsaret: { width: 20, textAlign: 'center', fontSize: 15, fontWeight: '900', color: colors.textMuted },

  vSatir: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 6 },
  vAd: { color: colors.text, fontSize: 12, fontWeight: '700' },
  vNeden: { color: colors.textMuted, fontSize: 10.5, lineHeight: 14 },

  altNot: { color: colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: 4 },
});
