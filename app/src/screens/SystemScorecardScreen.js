// SİSTEM MASTER ANALİZ KARNESİ — yalnız DOĞRULANMIŞ resmî ileri-test verisi.
// * Ana kart: TEKLİ ana tahmin (1/X/2) isabeti — kapalı tercihler (1X/X2/12/1X2)
//   ana başarıya GİRMEZ; onlar AYRI "Kapsama Başarısı" bölümündedir.
// * YENİ BAŞLANGIÇ: eski/backfill/retrospektif kayıtlar KULLANICIYA HİÇBİR
//   ekranda gösterilmez (Retrospektif sekmesi kaldırıldı); teknikte yalnız
//   "resmî başarıdan ayrılmıştır" notu vardır. Karneler sıfırdan başlar.
// * Resmî veri yoksa dürüst boş durum gösterilir — sahte yüzde üretilmez.
import React, { useState, useCallback } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing, radius, shadow } from '../theme';
import { matchDate } from '../utils';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { DashboardHero, DashboardSection, FilterBar, MetricBar, DashboardEmpty } from '../components/DashboardUI';
import {
  hasOfficialData, officialHeadline, weekRecordLabel,
  COVERAGE_NOTE, OFFICIAL_EMPTY_TITLE, OFFICIAL_EMPTY_MESSAGE, LEGACY_SEPARATION_NOTE, USER_SECTIONS,
} from '../scorecardLogic';

// SEKMELER: yalnız resmî bölümler — Retrospektif sekmesi KULLANICIYA YOKTUR.
// Eski %69/%64/%73 tarzı legacy başarılar bu ekranın hiçbir yerinde görünmez.
const SECTIONS = USER_SECTIONS;

const rateColor = (r) => (r >= 60 ? colors.success : r >= 45 ? colors.warning : colors.danger);
const fmtT = (iso) => (iso ? `${matchDate(iso).day} ${matchDate(iso).time}` : '—');

export default function SystemScorecardScreen({ navigation }) {
  const [sc, setSc] = useState(null);          // sistem (resmî + kapsama + provenance)
  const [radar, setRadar] = useState(null);    // resmî radar karnesi
  const [crit, setCrit] = useState(null);      // resmî kriter karnesi
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState('official');

  const load = useCallback(async () => {
    try {
      setError(null);
      const s = await api.scorecardsSystem();
      setSc(s);
      // Yan karneler ayrı ayrı — biri düşerse diğerleri görünmeye devam eder.
      // (Retrospektif uç ÇAĞRILMAZ — legacy başarılar kullanıcıya gösterilmez.)
      api.scorecardsRadar().then(setRadar).catch(() => {});
      api.scorecardsCriteria().then(setCrit).catch(() => {});
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading && !sc) return <LoadingState message="Sistem karnesi doğrulanıyor…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const official = hasOfficialData(sc);
  const head = officialHeadline(sc);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.pad}>
      <DashboardHero
        kicker="Analiz Merkezi · yalnız doğrulanmış ileri-test"
        title="Sistem Master Analiz Karnesi"
        subtitle={official
          ? `${head.weeks} resmî hafta · ${head.total} resmî maç · tekli ana tahmin (1/X/2)`
          : 'Resmî ileri-test verisi bekleniyor'}
        metrics={official ? [
          { value: head.correct, label: 'Doğru', tone: 'success' },
          { value: head.wrong, label: 'Yanlış', tone: 'danger' },
          { value: `%${head.accuracy}`, label: 'Tekli İsabet' },
        ] : [
          { value: '—', label: 'Doğru' }, { value: '—', label: 'Yanlış' }, { value: '—', label: 'İsabet' },
        ]}
      />

      <FilterBar options={SECTIONS} value={section} onChange={setSection} />

      {/* 1) RESMÎ KARNE */}
      {section === 'official' && (official ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{head.title}</Text>
            <MetricBar label="Tekli ana tahmin isabeti" value={head.accuracy} suffix="%" />
            <Row k="Resmî ileri-test haftası" v={`${head.weeks}${sc.pendingWeeks ? ` (+${sc.pendingWeeks} sonuç bekliyor)` : ''}`} />
            <Row k="Toplam resmî maç" v={String(head.total)} />
            <Row k="Tekli ana tahmin doğru" v={String(head.correct)} />
            <Row k="Tekli ana tahmin yanlış" v={String(head.wrong)} />
            <Row k="Son 5 hafta" v={head.last5?.total ? `${head.last5.correct}/${head.last5.total} · %${head.last5.accuracy}` : '—'} />
            <Row k="En iyi resmî hafta" v={head.bestWeek ? `${head.bestWeek.round || head.bestWeek.roundId} · ${head.bestWeek.record} (%${head.bestWeek.accuracy})` : '—'} />
            <Row k="Metodoloji" v={head.methodologyVersions.join(', ') || '—'} last />
          </View>
          <Text style={styles.honestNote}>{sc.note}</Text>
        </>
      ) : (
        <DashboardEmpty
          icon="🔏"
          title={OFFICIAL_EMPTY_TITLE}
          message={OFFICIAL_EMPTY_MESSAGE}
          actionLabel="Bültenleri Gör"
          onAction={() => navigation.navigate('BulletinTab')}
        />
      ))}

      {/* 2) HAFTA HAFTA */}
      {section === 'weeks' && (official && sc.weeks?.length ? (
        <>
          <DashboardSection title="Resmî Hafta Performansı" sub="Yalnız mühürlü ileri-test haftaları. Kısmi haftalar açıkça işaretlenir; sonuçlanmamış hafta başarıya yazılmaz." />
          {sc.weeks.map((w) => (
            <View key={w.roundId} style={styles.weekCard}>
              <View style={styles.weekHead}>
                <Text style={styles.weekName}>{w.round || `#${w.roundId}`}</Text>
                <Text style={[styles.weekStatus, w.status === 'complete' ? styles.stOk : w.status === 'partial' ? styles.stWarn : styles.stMuted]}>
                  {w.status === 'complete' ? 'tam' : w.status === 'partial' ? 'kısmi' : 'sonuç bekleniyor'}
                </Text>
                <Text style={[styles.weekPct, { color: w.status === 'pending' ? colors.textMuted : rateColor(w.accuracy) }]}>
                  {w.status === 'pending' ? '—' : `${weekRecordLabel(w)} · %${w.accuracy}`}
                </Text>
              </View>
              <Text style={styles.weekMeta}>
                Tahminli {w.predicted}/{w.matchCount} · resmî sonuç {w.resolved}/{w.matchCount} · kapsama {w.coverage.covered}/{w.coverage.total}
              </Text>
              <Text style={styles.weekMeta}>
                Mühür {fmtT(w.snapshotAt)} · donma {fmtT(w.freezeAt)} · #{w.verificationHashShort || '—'} · {w.methodologyVersion || '—'}
              </Text>
            </View>
          ))}
        </>
      ) : <EmptyLine text="Resmî hafta kaydı yok." />)}

      {/* 3) 1/X/2 */}
      {section === 'byResult' && (official ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Resmî sonuca göre tekli isabet</Text>
          <MetricBar label={`1 · Ev sahibi (n=${sc.byResult['1'].t})`} value={sc.byResult['1'].rate} color={colors.primary} />
          <MetricBar label={`X · Beraberlik (n=${sc.byResult.X.t})`} value={sc.byResult.X.rate} color={colors.gray} />
          <MetricBar label={`2 · Deplasman (n=${sc.byResult['2'].t})`} value={sc.byResult['2'].rate} color={colors.warning} />
          {sc.errors?.length ? (
            <>
              <Text style={[styles.cardTitle, { marginTop: 10 }]}>Sistemin yanlışları ({sc.errors.length})</Text>
              {sc.errors.slice(0, 15).map((e, i) => (
                <Text key={i} style={styles.errLine}>
                  {e.round || e.roundId} #{e.no} · {e.home} - {e.away} → sistem <Text style={styles.errSys}>{e.system}</Text>, sonuç <Text style={styles.errRes}>{e.result}</Text>{e.score ? ` (${e.score})` : ''}
                </Text>
              ))}
            </>
          ) : null}
        </View>
      ) : <EmptyLine text="Resmî 1/X/2 verisi yok." />)}

      {/* 4) KAPSAMA — ana başarı DEĞİL */}
      {section === 'coverage' && (
        <>
          <DashboardSection title="Kapsama Başarısı" sub="Mühürlü kupon tercihlerinin (tek/çift/üçlü) resmî sonucu kapsama oranı." />
          {sc?.coverage?.hasData ? (
            <View style={styles.card}>
              <MetricBar label={`Genel kapsama (n=${sc.coverage.total})`} value={sc.coverage.rate} suffix="%" />
              <MetricBar label={`Tekli tercihler (n=${sc.coverage.single.total})`} value={sc.coverage.single.rate} color={colors.primary} />
              <MetricBar label={`Çoklu tercihler 1X/X2/12/1X2 (n=${sc.coverage.multi.total})`} value={sc.coverage.multi.rate} color={colors.warning} />
            </View>
          ) : <EmptyLine text="Resmî kapsama verisi yok." />}
          <Text style={styles.warnNote}>{COVERAGE_NOTE}</Text>
        </>
      )}

      {/* 5) RADAR KARNESİ (resmî) */}
      {section === 'radar' && (radar?.hasData ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Resmî Radar Karnesi (mühürlü ileri-test)</Text>
          <MetricBar label={`Ana tahmin (n=${radar.master.allTime.mainAccuracy.total})`} value={radar.master.allTime.mainAccuracy.rate ?? 0} suffix="%" />
          <MetricBar label={`Güçlü aday (n=${radar.master.allTime.strongCandidate.total})`} value={radar.master.allTime.strongCandidate.rate ?? 0} color={colors.success} />
          <MetricBar label={`Sürpriz yakalama (n=${radar.master.allTime.surpriseCandidate.total})`} value={radar.master.allTime.surpriseCandidate.catchRate ?? 0} color={colors.danger} />
          <MetricBar label={`Kesin sürpriz yönü (n=${radar.master.allTime.surpriseCandidate.total})`} value={radar.master.allTime.surpriseCandidate.exactRate ?? 0} color={colors.warning} />
          <Row k="Hafta / hariç tutulan" v={`${radar.includedCount ?? radar.roundsCounted} / ${radar.excludedCount ?? 0}`} />
          <Row k="Metodoloji" v={(radar.methodologyVersions || []).join(', ') || '—'} last />
          {radar.note ? <Text style={styles.honestNote}>{radar.note}</Text> : null}
        </View>
      ) : (
        <EmptyLine text={radar?.note || 'Henüz resmî Radar ileri-test verisi yok. Gerçek bültenler mühürlenip sonuçlandıkça karne oluşacaktır.'} />
      ))}

      {/* 6) KRİTER KARNESİ (resmî) */}
      {section === 'criteria' && (crit?.hasData ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Resmî Kriter Karnesi (mühürlü değerlendirme × resmî sonuç)</Text>
          {crit.criteria.filter((c) => !c.informational && c.signals > 0).slice(0, 12).map((c) => (
            <View key={c.key} style={styles.critRow}>
              <Text style={styles.critName} numberOfLines={1}>{c.label}</Text>
              <Text style={styles.critVal}>%{c.accuracy ?? 0} · n={c.signals}{c.sample?.usable ? '' : ' · az örnek'}</Text>
            </View>
          ))}
          {crit.note ? <Text style={styles.honestNote}>{crit.note}</Text> : null}
        </View>
      ) : (
        <EmptyLine text={crit?.note || 'Henüz resmî kriter verisi yok — rozetler gerçek bültenler mühürlenip sonuçlandıkça dolacaktır.'} />
      ))}

      {/* 7) TEKNİK / KAYNAK ŞEFFAFLIĞI — eski başarı yüzdeleri YOKTUR. */}
      {section === 'tech' && sc && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kaynak Şeffaflığı</Text>
          <Row k="Tahmin kaynağı" v={sc.predictionSource} />
          <Row k="Tahmin türü" v="Tekli ana tahmin (1/X/2) — mühürlü" />
          <Row k="Sonuç kaynağı" v={sc.resultSource} />
          <Row k="Dahil edilen kayıt" v={String(sc.includedCount ?? 0)} />
          <Row k="Hariç tutulan kayıt" v={String(sc.excludedCount ?? 0)} />
          <Row k="Metodoloji sürümleri" v={(sc.methodologyVersions || []).join(', ') || '—'} />
          <Row k="Resmî profil sürümleri" v={(sc.officialProfileVersions || []).join(', ') || '—'} />
          <Row k="Hesaplama zamanı" v={fmtT(sc.generatedAt)} last />
          <Text style={styles.honestNote}>{sc.legacySeparationNote || LEGACY_SEPARATION_NOTE}</Text>
          <Text style={styles.honestNote}>
            Sonuçlar resmî Spor Toto kaynağından alınmıştır. Ancak yalnız maç öncesi mühürlendiği doğrulanan tahminler Resmî Karneye dahil edilmiştir.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function Row({ k, v, last }) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.rowK}>{k}</Text>
      <Text style={styles.rowV} numberOfLines={2}>{v ?? '—'}</Text>
    </View>
  );
}

function EmptyLine({ text }) {
  return <View style={styles.card}><Text style={styles.emptyTxt}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm, ...shadow.soft },
  cardTitle: { color: colors.text, fontSize: 13.5, fontWeight: '900', marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowK: { color: colors.textMuted, fontSize: 12, fontWeight: '700', flexShrink: 0 },
  rowV: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  honestNote: { color: colors.textMuted, fontSize: 10.5, fontWeight: '600', marginTop: 8, lineHeight: 15 },
  warnNote: { color: colors.warning, fontSize: 11, fontWeight: '800', marginTop: 8, lineHeight: 15 },
  emptyTxt: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700', lineHeight: 18 },

  weekCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm, ...shadow.soft },
  weekHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weekName: { color: colors.text, fontSize: 13, fontWeight: '900', flex: 1 },
  weekStatus: { fontSize: 10.5, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },
  stOk: { backgroundColor: 'rgba(46,160,90,0.12)', color: colors.success },
  stWarn: { backgroundColor: 'rgba(240,160,40,0.14)', color: colors.warning },
  stMuted: { backgroundColor: colors.bgAlt, color: colors.textMuted },
  weekPct: { fontSize: 12.5, fontWeight: '900' },
  weekMeta: { color: colors.textMuted, fontSize: 10.5, fontWeight: '600', marginTop: 4 },

  errLine: { color: colors.textSoft, fontSize: 11.5, fontWeight: '600', marginTop: 4, lineHeight: 16 },
  errSys: { color: colors.danger, fontWeight: '900' },
  errRes: { color: colors.success, fontWeight: '900' },

  critRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  critName: { flex: 1, color: colors.text, fontSize: 12.5, fontWeight: '700' },
  critVal: { color: colors.textSoft, fontSize: 12, fontWeight: '900' },

});
