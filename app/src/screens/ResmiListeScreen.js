// RESMÎ LİSTE — haftanın bülteni, resmî sitedeki düzenle.
//
// Sıra · Maç (arma + takımlar + arma) · Maç Günü · Maç Saati · Skor · Sonuç,
// altında "Açıklanan Sonuçlar": 15/14/13/12 Bilen · Kapanış · Açıklamalar.
//
// NEDEN AYRI EKRAN: Bülten ekranı analiz/tahmin gösterir; burası HAM RESMÎ
// LİSTEDİR — hiçbir analiz, tahmin, rozet ya da yorum yoktur. Kullanıcı
// "resmî listede ne yazıyor?" diye baktığında araya bizim görüşümüz girmez.
//
// VERİ: /api/rounds (hafta listesi) + /api/history/:roundId (maçlar + skor +
// resmî 1/X/2 + ikramiye + kapanış). Hepsi resmî Spor Toto kaynağından gelir;
// bu ekranda hiçbir sayı ÜRETİLMEZ, yalnız biçimlendirilir.
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { api } from '../api';
import { colors, spacing, radius } from '../theme';
import { Logo } from '../ui';
import { crestOf } from '../utils';
import { INDEPENDENCE_NOTICE } from '../brand';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import {
  macGunu, macSaati, skorMetni, sonucMetni,
  kademeSatirlari, altSatirlar, haftaSecenekleri, sezonMetni,
} from '../resmiListe';

export default function ResmiListeScreen({ navigation }) {
  const [rounds, setRounds] = useState(null);
  const [seciliId, setSeciliId] = useState(null);
  const [seciliSezon, setSeciliSezon] = useState(null);
  const [hafta, setHafta] = useState(null);        // /api/history yanıtı
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState(null);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [acikSecici, setAcikSecici] = useState(null);   // 'sezon' | 'hafta' | null

  // 1) Hafta listesi
  useEffect(() => {
    let iptal = false;
    api.rounds()
      .then((r) => {
        if (iptal) return;
        setRounds(r);
        setSeciliId((onceki) => onceki ?? r?.currentRoundId ?? null);
      })
      .catch((e) => { if (!iptal) setHata(e.message || 'Hafta listesi alınamadı.'); });
    return () => { iptal = true; };
  }, []);

  // 2) Seçili haftanın listesi
  const haftaYukle = useCallback(async (rid, { taze = false } = {}) => {
    if (rid == null) return;
    setYukleniyor(true);
    try {
      setHata(null);
      setHafta(await api.history(rid, taze));
    } catch (e) {
      setHata(e.message || 'Liste alınamadı.');
    } finally { setYukleniyor(false); }
  }, []);
  useEffect(() => { haftaYukle(seciliId); }, [seciliId, haftaYukle]);

  const yenile = async () => {
    setYenileniyor(true);
    await haftaYukle(seciliId, { taze: true });
    setYenileniyor(false);
  };

  const { sezonlar, seciliSezon: sezon, haftalar } = haftaSecenekleri(rounds, seciliSezon);
  const seciliHafta = haftalar.find((h) => Number(h.id) === Number(seciliId))
    || (rounds?.rounds || []).find((h) => Number(h.id) === Number(seciliId))
    || null;

  if (hata && !hafta) return <ErrorState message={hata} onRetry={() => haftaYukle(seciliId)} />;
  if (!rounds) return <LoadingState message="Resmî liste yükleniyor…" />;

  const maclar = hafta?.matches || [];

  return (
    <ScrollView
      style={st.kok}
      contentContainerStyle={st.govde}
      refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={yenile} tintColor={colors.primary} />}
    >
      {/* ÜST ŞERİT — "Liste 1 Haftalıktır" + sezon/hafta seçicileri */}
      <View style={st.ustSerit}>
        <Text style={st.ustNot}>Liste 1 Haftalıktır</Text>
        <View style={st.seciciSatir}>
          <Secici
            etiket={sezonMetni(sezon)}
            acik={acikSecici === 'sezon'}
            onPress={() => setAcikSecici(acikSecici === 'sezon' ? null : 'sezon')}
          />
          <Secici
            etiket={seciliHafta?.name || '—'}
            acik={acikSecici === 'hafta'}
            onPress={() => setAcikSecici(acikSecici === 'hafta' ? null : 'hafta')}
          />
        </View>
      </View>

      {acikSecici === 'sezon' ? (
        <SeciciListe
          ogeler={sezonlar.map((y) => ({ id: y, ad: sezonMetni(y) }))}
          seciliId={sezon}
          onSec={(y) => { setSeciliSezon(y); setAcikSecici(null); }}
        />
      ) : null}
      {acikSecici === 'hafta' ? (
        <SeciciListe
          ogeler={haftalar.map((h) => ({ id: h.id, ad: h.name }))}
          seciliId={seciliId}
          onSec={(id) => { setSeciliId(id); setAcikSecici(null); }}
        />
      ) : null}

      {/* TABLO BAŞLIĞI */}
      <View style={[st.satir, st.baslikSatiri]}>
        <Text style={[st.hSira, st.baslikYazi]}>Sıra</Text>
        <Text style={[st.hMac, st.baslikYazi]}>Maç</Text>
        <Text style={[st.hGun, st.baslikYazi]}>Maç Günü</Text>
        <Text style={[st.hSaat, st.baslikYazi]}>Maç Saati</Text>
        <Text style={[st.hSkor, st.baslikYazi]}>Skor</Text>
        <Text style={[st.hSonuc, st.baslikYazi]}>Sonuç</Text>
      </View>

      {yukleniyor && !maclar.length ? (
        <View style={st.orta}><ActivityIndicator color={colors.primary} /></View>
      ) : !maclar.length ? (
        <Text style={st.bosNot}>Bu hafta için resmî liste bulunamadı.</Text>
      ) : maclar.map((m, i) => (
        <View key={m.no ?? i} style={[st.satir, i % 2 === 1 && st.zebra]} testID={`resmi-satir-${m.no}`}>
          <Text style={st.hSira}>{m.no}</Text>
          <View style={[st.hMac, st.macHucre]}>
            <Logo uri={crestOf(m, 'home')} name={m.home?.name} size={22} />
            <Text style={st.macYazi} numberOfLines={1}>
              {m.home?.mediumName || m.home?.name} – {m.away?.mediumName || m.away?.name}
            </Text>
            <Logo uri={crestOf(m, 'away')} name={m.away?.name} size={22} />
          </View>
          <Text style={st.hGun}>{macGunu(m.date)}</Text>
          <Text style={st.hSaat}>{macSaati(m.date)}</Text>
          <Text style={st.hSkor}>{skorMetni(m)}</Text>
          <Text style={st.hSonuc}>{sonucMetni(m)}</Text>
        </View>
      ))}

      {/* AÇIKLANAN SONUÇLAR */}
      <View style={st.kirmiziBant}>
        <Text style={st.kirmiziBantYazi}>Açıklanan Sonuçlar</Text>
      </View>
      {[...kademeSatirlari(hafta?.prize), ...altSatirlar(hafta?.prize, seciliHafta?.closeDate)]
        .map((s, i) => (
          <View key={s.etiket} style={[st.altSatir, i % 2 === 1 && st.zebra]}>
            <Text style={st.altEtiket}>{s.etiket}</Text>
            <Text style={st.altDeger}>{s.deger}</Text>
          </View>
        ))}

      {/* Bu ekran resmî listeyi YANSITIR ama resmî bir kaynak DEĞİLDİR. */}
      <Text style={st.kaynak}>
        Kaynak: {hafta?.source || 'Spor Toto'}
        {hafta?.checkedAt ? ` · son kontrol ${macSaati(hafta.checkedAt)}` : ''}
      </Text>
      <Text style={st.bagimsizlik}>{INDEPENDENCE_NOTICE}</Text>
    </ScrollView>
  );
}

function Secici({ etiket, acik, onPress }) {
  return (
    <TouchableOpacity style={st.secici} onPress={onPress} activeOpacity={0.8} accessibilityRole="button">
      <Text style={st.seciciYazi} numberOfLines={1}>{etiket}</Text>
      <Text style={st.seciciOk}>{acik ? '▴' : '▾'}</Text>
    </TouchableOpacity>
  );
}

function SeciciListe({ ogeler, seciliId, onSec }) {
  return (
    <View style={st.seciciListe}>
      {ogeler.map((o) => {
        const secili = String(o.id) === String(seciliId);
        return (
          <TouchableOpacity
            key={String(o.id)}
            style={[st.seciciOge, secili && st.seciciOgeSecili]}
            onPress={() => onSec(o.id)}
            activeOpacity={0.8}
          >
            <Text style={[st.seciciOgeYazi, secili && st.seciciOgeYaziSecili]}>{o.ad}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  kok: { flex: 1, backgroundColor: colors.bg },
  govde: { padding: spacing.md, paddingBottom: spacing.xxl },
  orta: { paddingVertical: spacing.xl, alignItems: 'center' },

  ustSerit: { marginBottom: spacing.sm },
  ustNot: { color: colors.textSoft, fontSize: 12.5, fontWeight: '700' },
  seciciSatir: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  secici: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingVertical: 5, paddingHorizontal: 4, minWidth: 130,
  },
  seciciYazi: { color: colors.text, fontSize: 12.5, fontWeight: '700', flex: 1 },
  seciciOk: { color: colors.textMuted, fontSize: 11 },
  seciciListe: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, overflow: 'hidden',
  },
  seciciOge: { paddingVertical: 9, paddingHorizontal: spacing.md },
  seciciOgeSecili: { backgroundColor: colors.bgAlt },
  seciciOgeYazi: { color: colors.textSoft, fontSize: 12.5, fontWeight: '700' },
  seciciOgeYaziSecili: { color: colors.primary, fontWeight: '900' },

  satir: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 6, borderRadius: radius.sm,
  },
  zebra: { backgroundColor: colors.bgAlt },
  baslikSatiri: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 8 },
  baslikYazi: { color: colors.textMuted, fontSize: 11, fontWeight: '900' },

  hSira: { width: 34, textAlign: 'center', color: colors.textSoft, fontSize: 12, fontWeight: '800' },
  hMac: { flex: 1, minWidth: 120 },
  hGun: { width: 118, textAlign: 'center', color: colors.textSoft, fontSize: 11.5 },
  hSaat: { width: 54, textAlign: 'center', color: colors.textSoft, fontSize: 11.5 },
  hSkor: { width: 44, textAlign: 'center', color: colors.text, fontSize: 12, fontWeight: '800' },
  hSonuc: { width: 44, textAlign: 'center', color: colors.text, fontSize: 12, fontWeight: '900' },

  macHucre: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  macYazi: { flex: 1, color: colors.text, fontSize: 12.5, fontWeight: '700', textAlign: 'center' },

  kirmiziBant: {
    backgroundColor: colors.danger, borderRadius: radius.sm,
    paddingVertical: 9, alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  kirmiziBantYazi: { color: '#fff', fontSize: 13, fontWeight: '900' },

  altSatir: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: spacing.md, borderRadius: radius.sm,
  },
  altEtiket: { width: 120, color: colors.textSoft, fontSize: 12.5, fontWeight: '700' },
  altDeger: { flex: 1, color: colors.text, fontSize: 12.5, fontWeight: '700' },

  kaynak: { color: colors.textMuted, fontSize: 10.5, fontWeight: '700', marginTop: spacing.md },
  bagimsizlik: { color: colors.textMuted, fontSize: 10, lineHeight: 14, marginTop: 4 },
  bosNot: { color: colors.textMuted, fontSize: 12.5, fontStyle: 'italic', paddingVertical: spacing.lg, textAlign: 'center' },
});
