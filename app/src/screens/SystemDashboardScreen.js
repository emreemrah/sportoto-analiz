import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';
import { useSystemAnalysisDashboard } from '../hooks/useSystemAnalysisDashboard';
import { useAnalysisPerformanceDashboard } from '../hooks/useAnalysisPerformanceDashboard';
import PerformanceStatCard from '../components/PerformanceStatCard';
import DashboardChartCard from '../components/DashboardChartCard';
import AnalysisSectionPerformanceCard from '../components/AnalysisSectionPerformanceCard';
import SignalPerformanceCard from '../components/SignalPerformanceCard';
import ErrorBreakdownCard from '../components/ErrorBreakdownCard';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { EmptyState, Row } from '../ui';
import { ERROR_TAG_LABEL } from '../types/analysis';

// F) Sistem Analiz Dashboard — sistemin kendi başarı oranı, hata dağılımı,
// lig bazlı performans, güven/sürpriz skoru başarı grafiği.
export default function SystemDashboardScreen() {
  const { data, loading, error, reload } = useSystemAnalysisDashboard();
  const { data: ap } = useAnalysisPerformanceDashboard(); // bölüm + sinyal başarıları

  if (loading && !data) return <LoadingState message="Sistem karnesi hazırlanıyor…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    // DEMO KAPALI (üretim): mock başarı ASLA gerçek karne yerine gösterilmez.
    return (
      <EmptyState
        icon="🧪"
        title="Demo karne kapalı"
        message="Bu ekran yalnız demo/geliştirme verisi gösterir ve üretimde kapalıdır. Gerçek başarı için Sistem Karnesi ekranını kullanın — orada yalnız maç öncesi mühürlendiği doğrulanan tahminler sayılır."
      />
    );
  }
  if (data.totalAnalyzed === 0) {
    return (
      <EmptyState
        icon="📊"
        title="Henüz veri yok"
        message="Sonuçlanmış bülten olmadığı için sistem karnesi hesaplanamadı."
      />
    );
  }

  const errorRows = Object.entries(data.errorTagCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, n]) => ({
      label: `${ERROR_TAG_LABEL[tag] || tag} (${n})`,
      value: data.wrong ? Math.round((n / data.wrong) * 100) : 0,
      color: colors.red,
    }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.pad}>
      <Text style={styles.title}>Sistem Analiz Karnesi</Text>
      <Text style={styles.sub}>{data.totalAnalyzed} maç analiz edildi</Text>

      {/* KALICI DEMO ETİKETİ: mock veri hiçbir koşulda gerçek başarı gibi sunulmaz. */}
      <Text style={styles.demoBanner}>
        🧪 DEMO VERİ — GERÇEK BAŞARI DEĞİLDİR. Bu ekran örnek (mock) veriyle çalışır;
        resmî ileri-test karnesi Sistem Karnesi ekranındadır.
      </Text>

      <Row style={styles.statsRow}>
        <PerformanceStatCard label="Genel Başarı" value={`%${data.accuracy}`} tone="primary" icon="🎯" />
        <PerformanceStatCard label="Doğru" value={data.correct} tone="success" icon="✓" />
        <PerformanceStatCard label="Yanlış" value={data.wrong} tone="danger" icon="✗" />
      </Row>

      <DashboardChartCard
        title="1 / X / 2 Önerilerinde Başarı"
        rows={[
          { label: `1 (${data.pick1.total})`, value: data.pick1.rate, color: colors.primary },
          { label: `X (${data.pickX.total})`, value: data.pickX.rate, color: colors.gray },
          { label: `2 (${data.pick2.total})`, value: data.pick2.rate, color: colors.yellow },
        ]}
      />

      <DashboardChartCard
        title="Güven Skoruna Göre Başarı"
        rows={[
          { label: `Yüksek güven (${data.confidenceSplit.high.total})`, value: data.confidenceSplit.high.rate, color: colors.green },
          { label: `Düşük güven (${data.confidenceSplit.low.total})`, value: data.confidenceSplit.low.rate, color: colors.orange },
        ]}
      />

      <DashboardChartCard
        title="Sürpriz Riskine Göre Başarı"
        rows={[
          { label: `Yüksek risk (${data.surpriseRiskSplit.high.total})`, value: data.surpriseRiskSplit.high.rate, color: colors.red },
          { label: `Düşük risk (${data.surpriseRiskSplit.low.total})`, value: data.surpriseRiskSplit.low.rate, color: colors.green },
        ]}
      />

      {data.bestLeagues.length > 0 && (
        <DashboardChartCard
          title="En Başarılı Ligler"
          rows={data.bestLeagues.map((l) => ({ label: `${l.league} (${l.total})`, value: l.rate, color: colors.green }))}
        />
      )}
      {data.worstLeagues.length > 0 && (
        <DashboardChartCard
          title="En Çok Hata Yapılan Ligler"
          rows={data.worstLeagues.map((l) => ({ label: `${l.league} (${l.total})`, value: l.rate, color: colors.red }))}
        />
      )}

      {errorRows.length > 0 && <DashboardChartCard title="Hata Dağılımı" rows={errorRows} />}

      <DashboardChartCard
        title="Uyarı İsabet Oranları"
        rows={[
          { label: 'Kadro riski uyarısı isabetli', value: data.lineupRiskHitRate, color: colors.orange },
          { label: 'Sürpriz riski uyarısı isabetli', value: data.surpriseRiskHitRate, color: colors.red },
        ]}
      />

      {/* ——— Analiz Bölümü + Sinyal Başarıları ——— */}
      {/* GÜVEN KURALI: gerçek section-result verisi yoksa başarı ORANI GÖSTERİLMEZ.
          Kullanıcıya bilgi mesajı; mock yalnızca __DEV__'de "DEMO VERİ" etiketiyle. */}
      {ap && (
        <>
          <Text style={styles.sectionHead}>Analiz Bölümü Başarıları</Text>

          {!ap.hasRealData && (
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Henüz yeterli gerçek analiz verisi yok.</Text>
              <Text style={styles.infoBody}>Bülten sonuçları tamamlandıkça sistem karnesi oluşacak.</Text>
            </View>
          )}

          {(ap.hasRealData || __DEV__) && (
            <>
              {!ap.hasRealData && (
                <Text style={styles.demoTag}>🧪 DEMO VERİ · yalnızca geliştirici · gerçek başarı değildir</Text>
              )}

              <Text style={styles.sectionSub}>
                {ap.totalMeasured} ölçüm · {ap.matchesCovered} maç
                {ap.worstArea ? ` · en zayıf: ${ap.worstArea.title} (%${ap.worstArea.rate})` : ''}
              </Text>
              {ap.sectionPerf.map((sec) => (
                <AnalysisSectionPerformanceCard key={sec.key} section={sec} />
              ))}

              {ap.mostSuccessfulSignals.length > 0 && (
                <>
                  <Text style={styles.sectionHead}>En Başarılı Sinyaller</Text>
                  {ap.mostSuccessfulSignals.map((sig) => (
                    <SignalPerformanceCard key={sig.key} signal={sig} />
                  ))}
                </>
              )}

              {ap.mostMisleadingSignals.length > 0 && (
                <>
                  <Text style={styles.sectionHead}>En Çok Yanıltan Sinyaller</Text>
                  {ap.mostMisleadingSignals.map((sig) => (
                    <SignalPerformanceCard key={sig.key} signal={sig} />
                  ))}
                </>
              )}

              {ap.leaguePerf.length > 0 && (
                <>
                  <Text style={styles.sectionHead}>Lig Bazlı Analiz Başarısı</Text>
                  <DashboardChartCard
                    title="Liglere göre bölüm başarısı"
                    rows={ap.leaguePerf.map((l) => ({
                      label: `${l.league} (${l.total})`,
                      value: l.rate,
                      color: l.rate >= 60 ? colors.green : l.rate >= 50 ? colors.yellow : colors.red,
                    }))}
                  />
                </>
              )}

              <Text style={styles.sectionHead}>Hata Analizi</Text>
              <ErrorBreakdownCard breakdown={ap.errorBreakdown} samples={ap.sampleErrors} />
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 12.5, marginTop: 2, marginBottom: spacing.lg },
  statsRow: { gap: spacing.sm, marginBottom: spacing.lg },
  sectionHead: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: spacing.xl, marginBottom: 4 },
  sectionSub: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: spacing.md },
  infoCard: {
    backgroundColor: colors.card, borderRadius: 16, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border, marginTop: 4,
  },
  infoTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  infoBody: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700', marginTop: 6, lineHeight: 18 },
  demoTag: {
    color: colors.orange, fontSize: 11, fontWeight: '900', letterSpacing: 0.3,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.orange,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 10, marginBottom: 6,
    alignSelf: 'flex-start', overflow: 'hidden',
  },
  demoBanner: {
    color: colors.orange, fontSize: 12, fontWeight: '800', lineHeight: 17,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.orange,
    borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg, overflow: 'hidden',
  },
});
