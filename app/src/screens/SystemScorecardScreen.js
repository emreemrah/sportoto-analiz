// SİSTEM MASTER ANALİZ KARNESİ — yalnız DOĞRULANMIŞ resmî ileri-test verisi.
// * Ana kart: TEKLİ ana tahmin (1/X/2) isabeti — kapalı tercihler (1X/X2/12/1X2)
//   ana başarıya GİRMEZ; onlar AYRI "Kapsama Başarısı" bölümündedir.
// * YENİ BAŞLANGIÇ: eski/backfill/retrospektif kayıtlar KULLANICIYA HİÇBİR
//   ekranda gösterilmez (Retrospektif sekmesi kaldırıldı); teknikte yalnız
//   "resmî başarıdan ayrılmıştır" notu vardır. Karneler sıfırdan başlar.
// * Resmî veri yoksa dürüst boş durum gösterilir — sahte yüzde üretilmez.
import React, { useState, useCallback } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
import {
  hasCalibrationData, calibrationHeadline, marketDerivedNotice, independentTestText,
  scoreRows, curveRows, curveUnavailableText,
  EXPECTATION_NOTE, CALIBRATION_EMPTY_MESSAGE,
} from '../calibrationLogic';

// SEKMELER: yalnız resmî bölümler — Retrospektif sekmesi KULLANICIYA YOKTUR.
// Eski %69/%64/%73 tarzı legacy başarılar bu ekranın hiçbir yerinde görünmez.
const SECTIONS = USER_SECTIONS;

const rateColor = (r) => (r >= 60 ? colors.success : r >= 45 ? colors.warning : colors.danger);
const fmtT = (iso) => (iso ? `${matchDate(iso).day} ${matchDate(iso).time}` : '—');

export default function SystemScorecardScreen({ navigation }) {
  const [sc, setSc] = useState(null);          // sistem (resmî + kapsama + provenance)
  const [radar, setRadar] = useState(null);    // resmî radar karnesi
  const [crit, setCrit] = useState(null);      // resmî kriter karnesi
  const [cal, setCal] = useState(null);        // kalibrasyon (olasılık kalitesi)
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState('ozet'); // sade özet varsayılan (2026-08-06)
  const [critDonem, setCritDonem] = useState('allTime'); // kriter dönem penceresi

  const load = useCallback(async () => {
    try {
      setError(null);
      const s = await api.scorecardsSystem();
      setSc(s);
      // Yan karneler ayrı ayrı — biri düşerse diğerleri görünmeye devam eder.
      // (Retrospektif uç ÇAĞRILMAZ — legacy başarılar kullanıcıya gösterilmez.)
      api.scorecardsRadar().then(setRadar).catch(() => {});
      api.scorecardsCriteria().then(setCrit).catch(() => {});
      api.scorecardsCalibration().then(setCal).catch(() => {});
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

      {/* 0) ÖZET — sıradan kullanıcı için sade Türkçe (2026-08-06). Sayılar
          birebir resmî karneden gelir; burada YENİ hesap yapılmaz. */}
      {section === 'ozet' && (official ? (() => {
        const sonHafta = (sc.weeks || []).filter((w) => w.status !== 'pending').slice(-1)[0] || null;
        const yanlislar = (sc.errors || []).slice(0, 6);
        return (
          <>
            <View style={styles.card}>
              <Text style={styles.ozetBuyuk}>
                Sistem şimdiye kadar <Text style={styles.ozetVurgu}>{head.total}</Text> tahminin{' '}
                <Text style={[styles.ozetVurgu, { color: colors.success }]}>{head.correct}</Text>'ini bildi
                {' '}(<Text style={styles.ozetVurgu}>%{head.accuracy}</Text>).
              </Text>
              {sonHafta ? (
                <Text style={styles.ozetSatir}>
                  Son hafta ({sonHafta.round || `#${sonHafta.roundId}`}): {weekRecordLabel(sonHafta)} doğru · %{sonHafta.accuracy}
                </Text>
              ) : null}
              <Text style={styles.ozetAciklama}>
                Buradaki her tahmin maç başlamadan önce kilitlenip mühürlenir —
                sonradan değiştirilemez. Sonuçlar yalnız resmî Spor Toto
                verisiyle karşılaştırılır. Yani bu sayılar şişirilemez; sistemin
                gerçek, kanıtlı isabetidir.
              </Text>
            </View>

            {yanlislar.length ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Sistemin bilemedikleri (son {yanlislar.length})</Text>
                {yanlislar.map((e) => (
                  <Text key={`${e.roundId}-${e.no}`} style={styles.ozetSatir}>
                    {e.home} - {e.away}: sistem <Text style={styles.errSys}>{String(e.system).replace('0', 'X')}</Text> dedi,
                    {' '}maç <Text style={styles.errRes}>{e.result}</Text> bitti{e.score ? ` (${e.score})` : ''}.
                  </Text>
                ))}
                <Text style={styles.ozetAciklama}>
                  Yanlışları saklamıyoruz — dürüst ölçümün gereği bu.
                </Text>
              </View>
            ) : null}

            <Text style={styles.honestNote}>
              Daha fazla ayrıntı isteyen için üstteki sekmeler var: hafta hafta
              dökümler, 1/X/2 kırılımı ve teknik ölçümler. Geçmiş ölçümdür,
              gelecek sonuç vaadi değildir.
            </Text>
          </>
        );
      })() : (
        <DashboardEmpty
          icon="🔏"
          title={OFFICIAL_EMPTY_TITLE}
          message={OFFICIAL_EMPTY_MESSAGE}
          actionLabel="Bültenleri Gör"
          onAction={() => navigation.navigate('BulletinTab')}
        />
      ))}

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
                <Text style={styles.weekName} numberOfLines={1}>{w.round || `#${w.roundId}`}</Text>
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
          <MetricBar label={`1 · Ev sahibi (${sc.byResult['1'].t} maç)`} value={sc.byResult['1'].rate} color={colors.primary} />
          <MetricBar label={`X · Beraberlik (${sc.byResult.X.t} maç)`} value={sc.byResult.X.rate} color={colors.gray} />
          <MetricBar label={`2 · Deplasman (${sc.byResult['2'].t} maç)`} value={sc.byResult['2'].rate} color={colors.warning} />
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
              <MetricBar label={`Genel kapsama (${sc.coverage.total} maç)`} value={sc.coverage.rate} suffix="%" />
              <MetricBar label={`Tekli tercihler (${sc.coverage.single.total} maç)`} value={sc.coverage.single.rate} color={colors.primary} />
              <MetricBar label={`Çoklu tercihler 1X/X2/12/1X2 (${sc.coverage.multi.total} maç)`} value={sc.coverage.multi.rate} color={colors.warning} />
            </View>
          ) : <EmptyLine text="Resmî kapsama verisi yok." />}
          <Text style={styles.warnNote}>{COVERAGE_NOTE}</Text>
        </>
      )}

      {/* 5) RADAR KARNESİ (resmî) */}
      {section === 'radar' && (radar?.hasData ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Resmî Radar Karnesi (mühürlü ileri-test)</Text>
          <MetricBar label={`Ana tahmin (${radar.master.allTime.mainAccuracy.total} maç)`} value={radar.master.allTime.mainAccuracy.rate ?? 0} suffix="%" />
          <MetricBar label={`Güçlü aday (${radar.master.allTime.strongCandidate.total} maç)`} value={radar.master.allTime.strongCandidate.rate ?? 0} color={colors.success} />
          <MetricBar label={`Sürpriz yakalama (${radar.master.allTime.surpriseCandidate.total} maç)`} value={radar.master.allTime.surpriseCandidate.catchRate ?? 0} color={colors.danger} />
          <MetricBar label={`Kesin sürpriz yönü (${radar.master.allTime.surpriseCandidate.total} maç)`} value={radar.master.allTime.surpriseCandidate.exactRate ?? 0} color={colors.warning} />
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
          <Text style={styles.cardTitle}>Kriter Başarıları</Text>
          {/* DÖNEM SEÇİCİ (kullanıcı isteği, 2026-08-06): Genel / Son Hafta /
              Son 5 / Son 10 / Son 15. Pencereler backend'den mühürlü veriyle
              gelir; arşiv büyüdükçe kendiliğinden dolar. */}
          <View style={styles.donemSatir}>
            {[['allTime', 'Genel'], ['last1', 'Son Hafta'], ['last5', 'Son 5'], ['last10', 'Son 10'], ['last15', 'Son 15']].map(([kk, etiket]) => (
              <TouchableOpacity
                key={kk}
                style={[styles.donemBtn, critDonem === kk && styles.donemBtnAcik]}
                onPress={() => setCritDonem(kk)}
              >
                <Text style={[styles.donemTxt, critDonem === kk && styles.donemTxtAcik]}>{etiket}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* DÖNEM UYARISI: arşivde pencereden az hafta varsa dönemler aynı
              veriyi gösterir — kullanıcı bunu "bozuk" sanmasın (2026-08-06). */}
          {Number(crit.includedCount) > 0 && Number(crit.includedCount) < 5 ? (
            <Text style={styles.ozetAciklama}>
              ℹ️ Arşivde şu an {crit.includedCount} resmî hafta var — bu yüzden
              tüm dönemler aynı sayıları gösterir. Haftalar mühürlenip
              sonuçlandıkça Son 5/10/15 pencereleri kendiliğinden ayrışacak.
            </Text>
          ) : null}
          {/* TÜM kriterler (kullanıcı isteği): sinyal üretmeyenler de listede,
              dürüstçe "sinyal yok" der — gizlenmez, oran uydurulmaz. */}
          {[...crit.criteria]
            .filter((c) => !c.informational)
            .sort((a, b) => (b.windows?.[critDonem]?.total || 0) - (a.windows?.[critDonem]?.total || 0))
            .map((c) => {
              const w = c.windows?.[critDonem] || { rate: null, hits: 0, total: 0 };
              return (
                // TIKLANABİLİR (2026-08-07). Kullanıcı bildirimi: "bu kriter
                // başarılı ama favori maçlarda mı, zor maçlarda mı bilmiyorum —
                // yoksa yanıltıcı oluyor." Tek ortalama, birbirinin zıddı iki
                // gerçeği tek sayıya eziyor. Satıra basınca kırılım açılır.
                <TouchableOpacity
                  key={c.key}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('KriterKirilim', { key: c.key, ad: c.label })}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.label} kriterinin kırılımını aç`}
                  style={styles.critRow}
                >
                  <Text style={styles.critName} numberOfLines={1}>{c.label}</Text>
                  {/* "1008 maçta 809 başarı" biçimi (kullanıcı isteği, 2026-08-06):
                      yüzdenin yanında ham sayılar da görünür — n tek başına
                      soyut kalıyordu. */}
                  <Text style={[styles.critVal, w.rate == null && { color: colors.textMuted }]}>
                    {w.rate != null
                      ? `${w.total} maçta ${w.hits} başarı · %${w.rate}`
                      : (c.noData >= c.evaluated ? 'veri yok' : 'sinyal yok')}
                  </Text>
                  <Text style={styles.critChevron}>›</Text>
                </TouchableOpacity>
              );
            })}
          <Text style={styles.honestNote}>
            Bir kritere dokun: hangi maç tipinde (ağır favori / denk / açık),
            kalabalık ne derken ve hangi sırada başarılı olduğunu ayrı ayrı
            gösterir. Tek ortalama bunları gizler.
          </Text>
          <Text style={styles.honestNote}>
            "X maçta Y başarı" = kriterin yön gösterdiği maç sayısı ve doğru
            çıkan yön sayısı. Az maçta yüzde yanıltıcı olabilir — sayılarla
            birlikte okunmalı. "Sinyal yok": kriter o dönemde yön göstermedi;
            "veri yok": kaynak veri hiç yoktu.
          </Text>
          {crit.note ? <Text style={styles.honestNote}>{crit.note}</Text> : null}
        </View>
      ) : (
        <EmptyLine text={crit?.note || 'Henüz resmî kriter verisi yok — rozetler gerçek bültenler mühürlenip sonuçlandıkça dolacaktır.'} />
      ))}

      {/* 7) KALİBRASYON — "kaç tuttu" DEĞİL, söylenen olasılığın kalitesi.
          ANA RAKAM skill score'dur; isabet oranı bilerek başlıkta değildir
          (bkz. src/calibrationLogic.js sunum kuralları). */}
      {section === 'calibration' && (hasCalibrationData(cal) ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kalibrasyon — söylediğimiz olasılık ne kadar doğruydu?</Text>

          {/* Ana rakam: piyasaya karşı beceri */}
          {(() => {
            const h = calibrationHeadline(cal);
            const t = h?.vsMarket;
            return (
              <>
                <Text style={[styles.calBig, t?.tone === 'success' ? { color: colors.success }
                  : t?.tone === 'danger' ? { color: colors.danger } : { color: colors.textSoft }]}>
                  {h?.marketMissing ? 'Piyasa referansı yok (oran bulunamadı)' : t?.metin}
                </Text>
                <Text style={styles.calSub}>
                  {h?.n} maç · {h?.weeks} hafta
                  {h?.vsBaseline ? ` · lig taban oranına göre: ${h.vsBaseline.metin.replace('Piyasadan', '')}` : ''}
                </Text>
              </>
            );
          })()}

          {/* Model = piyasa uyarısı (bu üründe kritik) */}
          {(() => {
            const n = marketDerivedNotice(cal);
            if (!n) return null;
            return (
              <View style={styles.calNotice}>
                <Text style={styles.calNoticeTitle}>{n.title}</Text>
                <Text style={styles.calNoticeBody}>{n.body}</Text>
              </View>
            );
          })()}

          {/* Gerçek sınav: oranı olmayan maçlar */}
          {(() => {
            const t = independentTestText(cal);
            if (!t) return null;
            return (
              <View style={styles.calNotice}>
                <Text style={styles.calNoticeTitle}>{t.title} · {t.n} maç</Text>
                <Text style={styles.calNoticeBody}>{t.body}</Text>
              </View>
            );
          })()}

          {/* Skor tablosu */}
          <Text style={styles.calSection}>Skorlar (düşük = iyi)</Text>
          {scoreRows(cal).map((r) => (
            <View key={r.ad} style={styles.critRow}>
              <Text style={styles.critName} numberOfLines={1}>{r.ad}{r.not ? ` · ${r.not}` : ''}</Text>
              <Text style={styles.critVal}>log-loss {r.logLoss ?? '—'} · Brier {r.brier ?? '—'}{r.n ? ` · ${r.n}` : ''}</Text>
            </View>
          ))}

          {/* Kalibrasyon eğrisi ya da dürüst yokluk cümlesi */}
          <Text style={styles.calSection}>Kalibrasyon</Text>
          {curveRows(cal).length ? curveRows(cal).map((b, i) => (
            <View key={i} style={styles.critRow}>
              <Text style={styles.critName} numberOfLines={2}>{b.metin}</Text>
              <Text style={styles.critVal}>{b.durumMetni}</Text>
            </View>
          )) : <Text style={styles.honestNote}>{curveUnavailableText(cal)}</Text>}

          {/* Beklenti ayarı — zorunlu */}
          <Text style={styles.honestNote}>{EXPECTATION_NOTE}</Text>
          {cal.conventions ? (
            <Text style={styles.calFine}>
              Ölçüm: Brier [0,2] · log-loss doğal logaritma · marj temizleme multiplicative
            </Text>
          ) : null}
        </View>
      ) : (
        <EmptyLine text={cal?.insufficientNote || CALIBRATION_EMPTY_MESSAGE} />
      ))}

      {/* 8) TEKNİK / KAYNAK ŞEFFAFLIĞI — eski başarı yüzdeleri YOKTUR. */}
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
  // Özet sekmesi (sade dil, 2026-08-06)
  ozetBuyuk: { color: colors.text, fontSize: 17, fontWeight: '800', lineHeight: 24 },
  ozetVurgu: { fontWeight: '900' },
  ozetSatir: { color: colors.textSoft, fontSize: 13, fontWeight: '600', marginTop: 8, lineHeight: 18 },
  ozetAciklama: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 10 },
  warnNote: { color: colors.warning, fontSize: 11, fontWeight: '800', marginTop: 8, lineHeight: 15 },
  emptyTxt: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700', lineHeight: 18 },

  weekCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm, ...shadow.soft },
  weekHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weekName: { color: colors.text, fontSize: 13, fontWeight: '900', flex: 1, minWidth: 0 },
  weekStatus: { fontSize: 10.5, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },
  stOk: { backgroundColor: 'rgba(46,160,90,0.12)', color: colors.success },
  stWarn: { backgroundColor: 'rgba(240,160,40,0.14)', color: colors.warning },
  stMuted: { backgroundColor: colors.bgAlt, color: colors.textMuted },
  weekPct: { fontSize: 12.5, fontWeight: '900' },
  weekMeta: { color: colors.textMuted, fontSize: 10.5, fontWeight: '600', marginTop: 4 },

  errLine: { color: colors.textSoft, fontSize: 11.5, fontWeight: '600', marginTop: 4, lineHeight: 16 },
  errSys: { color: colors.danger, fontWeight: '900' },
  errRes: { color: colors.success, fontWeight: '900' },

  // Beş çip 360px'e sığmayıp sonuncusu alt satıra düşüyordu. Dolgu ve punto
  // indirildi; sarma yine açık ama artık tek satırda duruyor.
  donemSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8, marginBottom: 10 },
  donemBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 5, backgroundColor: colors.surfaceSoft },
  donemBtnAcik: { backgroundColor: colors.primary, borderColor: colors.primary },
  donemTxt: { color: colors.textSoft, fontSize: 10.5, fontWeight: '800' },
  donemTxtAcik: { color: '#fff' },
  critRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  critChevron: { color: colors.textMuted, fontSize: 17, fontWeight: '900' },
  // Değer metni ('1008 maçta 809 başarı · %80') sabit davranıp kriter adını
  // eziyordu; ikisi de kısalabilir oldu, satır tek satır kalır.
  critName: { flex: 1, minWidth: 0, color: colors.text, fontSize: 12.5, fontWeight: '700' },
  critVal: { color: colors.textSoft, fontSize: 11.5, fontWeight: '900', flexShrink: 1, marginLeft: 8 },

  // KALİBRASYON — ana rakam bilerek en büyük punto; isabet oranı burada YOK.
  calBig: { fontSize: 18, fontWeight: '900', marginTop: 4 },
  calSub: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  calSection: { color: colors.text, fontSize: 12, fontWeight: '900', marginTop: 12, marginBottom: 2 },
  calNotice: { backgroundColor: colors.bgAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, marginTop: 10 },
  calNoticeTitle: { color: colors.text, fontSize: 11.5, fontWeight: '900' },
  calNoticeBody: { color: colors.textSoft, fontSize: 11, fontWeight: '600', marginTop: 3, lineHeight: 16 },
  calFine: { color: colors.textMuted, fontSize: 9.5, fontWeight: '600', marginTop: 6 },
});
