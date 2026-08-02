// HAFTANIN ÖZETİ — yayın açılış segmenti: güçlü adaylar + sürpriz adayları +
// zorluk, tek gösterişli koyu ekranda. Yayıncı yayına bu ekranla girer.
//
//   • Tüm veriler bültendeki GERÇEK analizden gelir (weekSummary.js — saf, testli).
//   • Güçlü aday yoksa dürüstçe "yok" denir; liste zorla doldurulmaz.
//   • İddialı dil yok; etiketler displayLabel sözlüğünden geçer.
//
// TASARIM NOTU — iki turluk kullanıcı geri bildirimiyle şekillendi
// ("çok basit, şablon gibi" → "logo mesafesi kötü + tema yapay zeka gösteriyor").
//
// ASIL TEŞHİS: ekranın "yapay zeka yapımı" görünmesinin sebebi renk ya da
// içerik değil, KUTU YIĞINIYDI. Kartın içinde bordürlü kutu, onun içinde
// bordürlü satır, satırın içinde bordürlü hap. Her öğenin kendi zemini,
// kendi 1px çerçevesi ve kendi köşe yarıçapı vardı. Bu, hazır bileşenleri
// üst üste dizmenin imzasıdır.
//
// YÖN: yayın grafiği dili — kutu yerine AYRAÇ, çerçeve yerine BOŞLUK,
// dekorasyon yerine TİPOGRAFİ.
//   1. İç kutular kaldırıldı: zorluk bir bant, maçlar ince çizgiyle ayrılmış
//      liste öğeleri. Ekranda tek kart kaldı.
//   2. Armalar BÜLTENDEKİ DESENE döndü: her arma KENDİ takımının adına
//      yapışık, ev solda / deplasman sağda. Bu maddede iki kez yanıldım —
//      önce deplasman armasını satırın en sağına attım (metin esneyince
//      adından koptu), sonra iki armayı sola bindirmeli koydum (hangisinin
//      hangi takım olduğu okunmaz oldu). Uygulamanın kendi dili
//      (BulletinScreen homeSide/awaySide) baştan doğruydu.
//   3. Maç sayısı bordürlü rozetten iri sayıya döndü; ölçüt hapları
//      çerçevesiz renkli metne. İki kutu daha eksildi.
//   4. Zorluk segmentli gösterge, hafta bileşimi tek yığılmış çubuk —
//      dört eşit sayı kutusu haftanın şeklini anlatmıyordu.
//
// Veri ve kurallar DEĞİŞMEDİ — yalnız sunum.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { api } from '../api';
import { colors, spacing, radius } from '../theme';
import { BRAND_LINE_1, BRAND_LINE_2, LEGAL_FOOTER } from '../brand';
import { buildWeekSummary, takimAdi } from '../weekSummary';
import { displayLabel } from '../labels';
import { crestOf } from '../utils';
import { Logo } from '../ui';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

const NAVY = '#0f2038';
// NOT: eskiden satırların ve zorluk kutusunun zemini olan NAVY_SOFT kaldırıldı —
// artık iç kutu yok, ayraç çizgisi ve boşluk kullanılıyor.
const LINE = '#1c3a5e';
const INK_SOFT = '#9DB0CD';
const AMBER = '#ffb35c';
const YESIL = '#5dd39e';
const KIRMIZI = '#ff7a6e';

const SEGMENT = 5;               // zorluk göstergesi segment sayısı (her biri 20 puan)

/** Zorluk rengi — düşük skor kolay hafta. */
function zorlukRengi(skor) {
  if (skor == null) return INK_SOFT;
  if (skor < 30) return YESIL;
  if (skor < 50) return AMBER;
  return KIRMIZI;
}

/** Segmentli zorluk göstergesi: 100'lük ölçekte nerede olduğunu gösterir. */
function ZorlukGostergesi({ skor, renk }) {
  const dolu = Math.round((Math.min(100, Math.max(0, skor)) / 100) * SEGMENT);
  return (
    <View style={st.segSatir}>
      {Array.from({ length: SEGMENT }, (_, i) => (
        <View
          key={i}
          style={[st.seg, i < dolu ? { backgroundColor: renk } : null]}
        />
      ))}
    </View>
  );
}

/**
 * HAFTANIN BİLEŞİMİ — tek yığılmış çubuk.
 * Sıfır genişlikli dilim ÇİZİLMEZ: bir kategori yoksa çubukta yeri de olmaz,
 * yoksa "var ama küçük" gibi görünürdü.
 */
function BilesimCubugu({ parcalar, toplam }) {
  if (!toplam) return null;
  return (
    <View style={st.bilesim}>
      {parcalar.filter((p) => p.n > 0).map((p) => (
        <View key={p.ad} style={{ flex: p.n, backgroundColor: p.renk }} />
      ))}
    </View>
  );
}

/** Bileşim açıklaması — renk + sayı + ad. */
function Lejant({ parcalar }) {
  return (
    <View style={st.lejant}>
      {parcalar.map((p) => (
        <View key={p.ad} style={st.lejantOge}>
          <View style={[st.lejantNokta, { backgroundColor: p.renk }]} />
          <Text style={st.lejantSayi}>{p.n}</Text>
          <Text style={st.lejantAd}>{p.ad}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Maç satırı — sol kenarda kategori rengi, takım armaları, sağda ölçüt.
 * Arma yoksa Logo bileşeni nötr ⚽ çizer (uydurma görsel yok).
 */
function MacSatiri({ m, renk, altMetin, olcut, sonMu, onPress }) {
  return (
    <TouchableOpacity
      style={[st.mRow, sonMu ? null : st.mAyrac]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* TAKIM SATIRI — bültendeki desenin AYNISI: arma KENDİ takımının adına
          yapışık, ev solda, deplasman sağda. İki farklı deneme başarısız oldu
          ve ikisi de aynı sebepten: armayı adından ayırmak.
            • ilk hâl: ev arması solda, deplasman arması satırın EN SAĞINDA →
              aradaki metin esneyince deplasman arması adından koptu,
            • ikinci hâl: iki arma solda bindirmeli → hangi armanın hangi takım
              olduğu okunmaz oldu.
          Uygulamanın kendi dili (BulletinScreen homeSide/awaySide) zaten doğru
          çözümü taşıyordu; ondan sapmak gereksizdi. */}
      <View style={st.mIcerik}>
        <View style={st.takimSatiri}>
          <View style={st.evTaraf}>
            <Logo uri={crestOf(m, 'home')} name={m.home?.name} size={22} />
            <Text style={st.takimAd} numberOfLines={1}>{takimAdi(m.home)}</Text>
          </View>
          <View style={st.depTaraf}>
            <Text style={[st.takimAd, st.takimAdSag]} numberOfLines={1}>{takimAdi(m.away)}</Text>
            <Logo uri={crestOf(m, 'away')} name={m.away?.name} size={22} />
          </View>
        </View>

        {/* Alt satır: solda sıra no + etiket, sağda ölçüt. Ölçüt çerçevesiz —
            bordürlü hap ekrandaki kutu sayısını artırıyordu. */}
        <View style={st.metaSatiri}>
          <Text style={st.mSub} numberOfLines={1}>
            <Text style={st.mNo}>{m.no}</Text>  ·  {altMetin}
          </Text>
          <Text style={[st.olcut, { color: renk }]}>{olcut}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** Bölüm başlığı — renkli aksan çubuğuyla. */
function BolumBasligi({ renk, baslik, sayi }) {
  return (
    <View style={st.secHead}>
      <View style={[st.secAksan, { backgroundColor: renk }]} />
      <Text style={st.secTitle}>{baslik}</Text>
      {sayi != null ? <Text style={[st.secSayi, { color: renk }]}>{sayi}</Text> : null}
    </View>
  );
}

export default function WeekSummaryScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try { setError(null); setData(await api.bulletin()); }
    catch (e) { setError(e.message || 'Bülten alınamadı.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingState message="Haftanın özeti hazırlanıyor…" />;

  const sum = buildWeekSummary(data.matches || []);
  const diff = data.difficulty || null;
  const weekTxt = [data.season ? `${data.season} Sezonu` : null, data.weekNumber ? `${data.weekNumber}. Hafta` : null]
    .filter(Boolean).join(' · ');
  const diffColor = zorlukRengi(diff?.score);

  // Haftanın bileşimi. "Diğer" = kalanlar; toplamı bültenle tutturur ki
  // çubuk eksik parça göstermesin.
  const diger = Math.max(0, sum.total - sum.strong.length - sum.surprises.length - sum.balanced);
  const parcalar = [
    { ad: 'Güçlü', n: sum.strong.length, renk: YESIL },
    { ad: 'Sürpriz', n: sum.surprises.length, renk: KIRMIZI },
    { ad: 'Denk', n: sum.balanced, renk: AMBER },
    { ad: 'Diğer', n: diger, renk: '#3b5573' },
  ];

  const goMatch = (no) => navigation.navigate('MatchDetail', { no });

  return (
    <ScrollView style={st.container} contentContainerStyle={st.body}>
      <View style={st.card}>
        {/* Marka + hafta */}
        <View style={st.baslikSatir}>
          <View style={{ flex: 1 }}>
            <Text style={st.brand}>
              {BRAND_LINE_1} <Text style={{ color: AMBER }}>{BRAND_LINE_2}</Text>
            </Text>
            <Text style={st.kicker}>HAFTANIN ÖZETİ</Text>
            {weekTxt ? <Text style={st.week}>{weekTxt}</Text> : null}
          </View>
          <View style={st.macRozet}>
            <Text style={st.macRozetN}>{sum.total}</Text>
            <Text style={st.macRozetL}>MAÇ</Text>
          </View>
        </View>

        {/* Haftanın bileşimi — tek bakışta hafta profili */}
        <BilesimCubugu parcalar={parcalar} toplam={sum.total} />
        <Lejant parcalar={parcalar} />

        {/* Zorluk — kutu DEĞİL, ince ayraçla bölünmüş bir bant.
            Kartın içine bordürlü bir kutu daha koymak, ekrandaki "kutu içinde
            kutu" yığınını büyütüyordu. */}
        {diff ? (
          <View style={st.diffBant}>
            <View style={st.diffHead}>
              <Text style={st.diffLabel}>BÜLTEN ZORLUĞU</Text>
              <View style={st.diffDeger}>
                <Text style={[st.diffLevel, { color: diffColor }]}>{diff.level}</Text>
                <Text style={st.diffSkor}>{diff.score}<Text style={st.diffSkorAlt}>/100</Text></Text>
              </View>
            </View>
            <ZorlukGostergesi skor={diff.score} renk={diffColor} />
            {diff.text ? <Text style={st.diffTxt}>{diff.text}</Text> : null}
          </View>
        ) : null}

        {/* Güçlü adaylar */}
        <BolumBasligi renk={YESIL} baslik="GÜÇLÜ ADAYLAR" sayi={sum.strong.length || null} />
        {sum.strong.length ? sum.strong.map((m, i) => (
          <MacSatiri
            key={m.no}
            m={m}
            renk={YESIL}
            altMetin={`${displayLabel(m.analysis.label)} · Sürpriz ${m.analysis.surpriseScore ?? '—'}`}
            olcut={`${String(m.analysis.favorite.symbol).replace('0', 'X')} · %${m.analysis.favorite.percent}`}
            sonMu={i === sum.strong.length - 1}
            onPress={() => goMatch(m.no)}
          />
        )) : (
          <Text style={st.emptyTxt}>Bu hafta güçlü aday çıkmadı — zorla aday üretilmez; temkinli hafta.</Text>
        )}

        {/* Sürpriz adayları */}
        <BolumBasligi renk={KIRMIZI} baslik="SÜRPRİZ ADAYLARI" sayi={sum.surprises.length || null} />
        {sum.surprises.length ? sum.surprises.map((m, i) => (
          <MacSatiri
            key={m.no}
            m={m}
            renk={KIRMIZI}
            altMetin={`${displayLabel(m.analysis.label)}${m.analysis.favorite ? ` · Favori ${String(m.analysis.favorite.symbol).replace('0', 'X')} yalnız %${m.analysis.favorite.percent}` : ''}`}
            olcut={`Sürpriz ${m.analysis.surpriseScore}`}
            sonMu={i === sum.surprises.length - 1}
            onPress={() => goMatch(m.no)}
          />
        )) : (
          <Text style={st.emptyTxt}>Sürprize açık maç işareti yok.</Text>
        )}

        {sum.startedCount > 0 ? (
          <Text style={st.startedNote}>ℹ️ {sum.startedCount} maç başladığı için aday listelerinde gösterilmiyor.</Text>
        ) : null}

        <View style={st.footDivider} />
        <Text style={st.disc}>{LEGAL_FOOTER}</Text>
      </View>

      <TouchableOpacity style={st.cta} onPress={() => navigation.navigate('MatchDetail', { no: (sum.strong[0] || sum.surprises[0] || { no: 1 }).no })}>
        <Text style={st.ctaTxt}>İlk Maçın Analizine Git ›</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.md, alignItems: 'center', paddingBottom: spacing.xl },
  card: { width: '100%', maxWidth: 560, backgroundColor: NAVY, borderRadius: 22, borderWidth: 1, borderColor: LINE, padding: spacing.lg },

  baslikSatir: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  brand: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  kicker: { color: AMBER, fontSize: 12, fontWeight: '900', letterSpacing: 2.5, marginTop: 2 },
  week: { color: INK_SOFT, fontSize: 12.5, fontWeight: '800', marginTop: 4 },
  // Maç sayısı: kutu değil, sağa hizalı iri sayı. Bordürlü rozet, ekrandaki
  // kutu sayısını artıran unsurlardan biriydi.
  macRozet: { alignItems: 'flex-end', justifyContent: 'flex-start' },
  macRozetN: { color: '#fff', fontSize: 40, fontWeight: '900', lineHeight: 40, letterSpacing: -1.5 },
  macRozetL: { color: INK_SOFT, fontSize: 9.5, fontWeight: '900', letterSpacing: 2, marginTop: -2 },

  bilesim: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: spacing.md, backgroundColor: LINE },
  lejant: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  lejantOge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lejantNokta: { width: 8, height: 8, borderRadius: 4 },
  lejantSayi: { color: '#fff', fontSize: 12, fontWeight: '900' },
  lejantAd: { color: INK_SOFT, fontSize: 11, fontWeight: '700' },

  // Bant: zemin ve bordür YOK; üstünde ince bir ayraç çizgisi var.
  diffBant: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: LINE },
  diffHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  diffLabel: { color: INK_SOFT, fontSize: 10.5, fontWeight: '900', letterSpacing: 1.4 },
  diffDeger: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  diffLevel: { fontSize: 15, fontWeight: '900' },
  diffSkor: { color: '#fff', fontSize: 15, fontWeight: '900' },
  diffSkorAlt: { color: INK_SOFT, fontSize: 11, fontWeight: '800' },
  segSatir: { flexDirection: 'row', gap: 5, marginTop: 10 },
  seg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: LINE },
  diffTxt: { color: INK_SOFT, fontSize: 11.5, marginTop: 9, lineHeight: 16 },

  secHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.lg, marginBottom: 9 },
  secAksan: { width: 3, height: 15, borderRadius: 2 },
  secTitle: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1.2, flex: 1 },
  secSayi: { fontSize: 13, fontWeight: '900' },

  // SATIR: kart değil, LİSTE ÖĞESİ. Her satırın kendi zemini + bordürü +
  // köşesi olması, ekranı "kutu içinde kutu" yığınına çeviriyordu. Ayırma
  // işini ince bir çizgi yapıyor; boşluk ve tipografi yükü taşıyor.
  mRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13,
  },
  mAyrac: { borderBottomWidth: 1, borderBottomColor: '#17304f' },

  // BÜLTENDEKİ DESEN: arma kendi adına yapışık, ev solda / deplasman sağda.
  // (BulletinScreen'deki homeSide/awaySide ile aynı yapı.)
  mIcerik: { flex: 1, minWidth: 0 },
  takimSatiri: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  evTaraf: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  depTaraf: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 7, minWidth: 0 },
  takimAd: { color: '#fff', fontSize: 14, fontWeight: '800', flexShrink: 1 },
  takimAdSag: { textAlign: 'right' },

  metaSatiri: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 6 },
  mNo: { color: '#7f93b4', fontWeight: '900' },
  mSub: { color: INK_SOFT, fontSize: 11, fontWeight: '700', letterSpacing: 0.2, flex: 1 },

  // Ölçüt: çerçevesiz, renkli ve kalın. Bordürlü hap bir kutu daha demekti.
  olcut: { fontSize: 13.5, fontWeight: '900', letterSpacing: -0.2 },

  emptyTxt: { color: INK_SOFT, fontSize: 12.5, fontStyle: 'italic', lineHeight: 18 },
  startedNote: { color: INK_SOFT, fontSize: 11.5, marginTop: spacing.md, fontStyle: 'italic' },
  footDivider: { height: 1, backgroundColor: LINE, marginVertical: spacing.md },
  disc: { color: '#8fa3bd', fontSize: 10.5, fontStyle: 'italic', lineHeight: 15 },
  cta: { marginTop: spacing.md, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 36 },
  ctaTxt: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
