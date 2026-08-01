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
import { spacing } from '../theme';
// Bu ekranın paleti AYRIDIR (resmî listenin görünümü) — bkz. resmiListeTema.js
import { RL, RLO } from '../resmiListeTema';
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
      refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={yenile} tintColor={RL.bant} />}
    >
      {/* Resmî sitedeki gibi en üstte koyu kırmızı ince şerit. */}
      <View style={st.ustCizgi} />

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
        <View style={st.ayrac} />
        <Text style={[st.hMac, st.baslikYazi]}>Maç</Text>
        <View style={st.ayrac} />
        <Text style={[st.hGun, st.baslikYazi]}>Maç Günü</Text>
        <View style={st.ayrac} />
        <Text style={[st.hSaat, st.baslikYazi]}>Maç Saati</Text>
        <View style={st.ayrac} />
        <Text style={[st.hSkor, st.baslikYazi]}>Skor</Text>
        <View style={st.ayrac} />
        <Text style={[st.hSonuc, st.baslikYazi]}>Sonuç</Text>
      </View>

      {yukleniyor && !maclar.length ? (
        <View style={st.orta}><ActivityIndicator color={RL.bant} /></View>
      ) : !maclar.length ? (
        <Text style={st.bosNot}>Bu hafta için resmî liste bulunamadı.</Text>
      ) : maclar.map((m, i) => (
        <View key={m.no ?? i} style={[st.satir, i % 2 === 1 && st.zebra]} testID={`resmi-satir-${m.no}`}>
          <Text style={st.hSira}>{m.no}</Text>
          <View style={st.ayrac} />
          <View style={[st.hMac, st.macHucre]}>
            <Logo uri={crestOf(m, 'home')} name={m.home?.name} size={22} />
            <Text style={st.macYazi} numberOfLines={1}>
              {m.home?.mediumName || m.home?.name} – {m.away?.mediumName || m.away?.name}
            </Text>
            <Logo uri={crestOf(m, 'away')} name={m.away?.name} size={22} />
          </View>
          <View style={st.ayrac} />
          <Text style={st.hGun}>{macGunu(m.date)}</Text>
          <View style={st.ayrac} />
          <Text style={st.hSaat}>{macSaati(m.date)}</Text>
          <View style={st.ayrac} />
          <Text style={st.hSkor}>{skorMetni(m)}</Text>
          <View style={st.ayrac} />
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

// ——— STİL — resmî listenin görünümü. Renkler resmiListeTema.js'te; burada
// tek bir renk sabiti YOKTUR (ince ayar tek dosyadan yapılsın diye). ———
const st = StyleSheet.create({
  kok: { flex: 1, backgroundColor: RL.sayfa },
  govde: { paddingBottom: spacing.xxl },
  orta: { paddingVertical: spacing.xl, alignItems: 'center' },

  // Sayfanın en üstündeki koyu kırmızı şerit (resmî sitedeki gibi).
  ustCizgi: { height: 4, backgroundColor: RL.ustCizgi },

  ustSerit: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  ustNot: { color: RL.metin, fontSize: RLO.yaziBoyu, fontWeight: '600' },
  seciciSatir: { flexDirection: 'row', gap: 14, marginTop: 8, flexWrap: 'wrap' },
  secici: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderBottomWidth: 1, borderBottomColor: RL.cizgi,
    paddingVertical: 6, minWidth: 140,
  },
  seciciYazi: { color: RL.metin, fontSize: RLO.yaziBoyu, fontWeight: '600', flex: 1 },
  seciciOk: { color: RL.soluk, fontSize: 10 },
  seciciListe: {
    backgroundColor: RL.sayfa, borderWidth: 1, borderColor: RL.cizgi,
    borderRadius: RLO.koseYaricapi, marginHorizontal: spacing.md,
    marginBottom: spacing.sm, overflow: 'hidden',
  },
  seciciOge: { paddingVertical: 10, paddingHorizontal: spacing.md },
  seciciOgeSecili: { backgroundColor: RL.satirAlt },
  seciciOgeYazi: { color: RL.metin, fontSize: RLO.yaziBoyu, fontWeight: '600' },
  seciciOgeYaziSecili: { color: RL.guclu, fontWeight: '800' },

  // TABLO — düz, sıkı; uygulamanın genel yuvarlaklığı burada yok.
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

  // Sütunlar arası ince dikey ayraç (resmî listedeki "|" çizgileri).
  ayrac: { width: 1, alignSelf: 'stretch', backgroundColor: RL.cizgi, marginVertical: 10 },

  macHucre: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  macYazi: { flex: 1, color: RL.metin, fontSize: RLO.yaziBoyu, textAlign: 'center' },

  kirmiziBant: {
    backgroundColor: RL.bant, borderRadius: RLO.bantYaricapi,
    paddingVertical: 11, alignItems: 'center',
    marginTop: spacing.lg, marginBottom: spacing.sm, marginHorizontal: spacing.md,
  },
  kirmiziBantYazi: { color: RL.bantYazi, fontSize: 13, fontWeight: '700' },

  // ALT BİLGİ — solda etiket kutusu, sağda değer kutusu (resmî listedeki gibi).
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

  kaynak: { color: RL.soluk, fontSize: 10.5, marginTop: spacing.md, paddingHorizontal: spacing.md },
  bagimsizlik: { color: RL.soluk, fontSize: 10, lineHeight: 14, marginTop: 4, paddingHorizontal: spacing.md },
  bosNot: {
    color: RL.soluk, fontSize: RLO.yaziBoyu, fontStyle: 'italic',
    paddingVertical: spacing.lg, textAlign: 'center',
  },
});
