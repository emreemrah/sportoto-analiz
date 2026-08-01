// KUPON SONUCU — GERÇEK veriyle (mock değil).
// KURALLAR:
// • Değerlendirme kilit anındaki FINAL versiyonla yapılır (couponEval) —
//   sonradan değişen analiz/tahmin sonucu ETKİLEMEZ.
// • Yalnız RESMİ 90 dakika sonucu (1/X/2) esas alınır; gelmeyen maç ⏳ bekler.
// • Sistem sütunu = maç-öncesi KAYITLI sistem tahmini (snapshot).
//   Radar sütunu = kayıtlı radar favorisi (yalnız güncel bültende mevcutsa;
//   kayıt yoksa dürüstçe "—" gösterilir, uydurulmaz).
//
// GÖRÜNÜM (kullanıcı isteği: "kuponlarım kısmını da yayıncı modundaki gibi
// görsellerden yapalım"): yayın stüdyosunun RESMÎ BÜLTEN TABLOSU. Satır =
// sıra no · ev arması · takım adları · konuk arması · skor · resmî sonuç.
// Tablo parçaları couponStudioParts.js'ten gelir; burada ikinci bir tablo
// yazılmaz. Armalar zaten geçmiş hafta verisiyle geliyordu (m.home.logo /
// m.away.logo) — yalnız çizilmiyordu.
//
// YAZIM: seçimler ve sonuçlar stüdyodaki gibi RESMÎ yazımla gösterilir
// (1 - 0 - 2; "0" beraberlik). Saklanan değer değişmez, yalnız gösterim.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { api } from '../api';
import { S, R, SP, TABLE } from '../studioTheme';
import { fontOf, TABULAR } from '../studioFonts';
import {
  Tablo, Thead, Th, Tfoot, MacSatiri, AltBilgi, SayiKutu, Not, useKuponOlcek,
} from './couponStudioParts';
import { toOfficial } from '../couponConfig';
import { getCoupon, getRankedCoupon } from '../coupon/store';
import { evalCoupon } from '../couponEval';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { EmptyState } from '../ui';

const MARK = { true: '✅', false: '❌', null: '⏳' };
const MARK_ETIKET = { true: 'tuttu', false: 'yattı', null: 'resmî sonuç bekleniyor' };

// Resmî bülten yazımı: 'X' → '0', çoklu seçim tire ile ayrılır ('1X' → '1-0').
const resmi = (sym) => (sym ? String(sym).split('').map(toOfficial).join('-') : null);

export default function CouponResultScreen({ route }) {
  const { roundId, couponId, roundName, season } = route.params || {};
  const [hist, setHist] = useState(null);
  const [radarMap, setRadarMap] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (roundId == null) { setError('Hafta bilgisi eksik.'); setLoading(false); return; }
    try {
      setError(null); setLoading(true);
      const h = await api.history(roundId);
      setHist(h);
      // Radar favorisi yalnız güncel bültende kayıtlı — varsa maça bağla.
      try {
        const b = await api.bulletin();
        if (b?.roundId === roundId) {
          const rm = {};
          for (const m of b.matches || []) {
            const fav = m.radarCenter?.master?.favorite?.symbol;
            if (fav) rm[m.no] = fav;
          }
          setRadarMap(rm);
        } else setRadarMap({});
      } catch { setRadarMap({}); }
    } catch (e) { setError(e.message || 'Sonuç bilgisi alınamadı.'); }
    finally { setLoading(false); }
  }, [roundId]);
  useEffect(() => { load(); }, [load]);

  // Ölçek/punto/font — koşullu return'lerden ÖNCE (kanca sırası bozulmasın).
  const { k, t, f, dar } = useKuponOlcek();

  const coupon = couponId ? getCoupon(couponId) : getRankedCoupon(roundId);

  if (loading && !hist) return <LoadingState message="Kupon sonucu yükleniyor…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!coupon) {
    return <EmptyState icon="🎟️" title="Kupon yok" message="Bu bülten için kaydedilmiş bir kuponun yok." />;
  }

  const matches = hist?.matches || [];
  const byNo = new Map(matches.map((m) => [m.no, m]));
  const resultMap = new Map(matches.filter((m) => m.result && m.score).map((m) => [m.no, m.result]));
  const ev = evalCoupon(coupon, resultMap);
  if (!ev) {
    return <EmptyState icon="🎟️" title="Kupon boş" message="Bu kuponun kayıtlı seçimi bulunamadı." />;
  }

  // 15/14/13/12 satırı — yalnız tüm resmi sonuçlar gelince kesin konuşulur.
  const tierLine = ev.allResolved
    ? (ev.tier != null
      ? `🎯 ${ev.tier} bildin — 12+ barajının üstünde`
      : `12 barajının altında (${ev.correct} doğru)`)
    : `${ev.resolved}/${ev.total} resmî sonuç geldi — kalan maçlar ⏳`;

  const scoreOf = (m) => (m?.score && m.score.home != null ? `${m.score.home}-${m.score.away}` : null);

  const sagGenislik = dar ? 66 : 80;

  const satir = (item, i) => {
    const m = byNo.get(item.no);
    const sys = resmi(m?.prediction?.symbol);
    const radar = resmi(radarMap[item.no]);
    const sen = item.outcomes?.length ? resmi(item.outcomes.join('')) : null;
    const skor = scoreOf(m);
    const senRenk = item.hit === true ? S.good : item.hit === false ? S.bad : S.inkSoft;
    return (
      <MacSatiri
        key={item.no}
        k={k}
        zebra={i % 2 === 1}
        sira={item.no}
        home={m?.home?.mediumName || m?.home?.name}
        away={m?.away?.mediumName || m?.away?.name}
        homeLogo={m?.home?.logo}
        awayLogo={m?.away?.logo}
        testID={`kupon-sonuc-satir-${item.no}`}
        alt={(
          <>
            <AltBilgi k={k} text={`Sen ${sen || '—'}`} color={senRenk} sayi />
            <AltBilgi k={k} text={`Sistem ${sys || '—'}`} sayi />
            <AltBilgi k={k} text={`Radar ${radar || '—'}`} sayi />
            {dar && skor ? <AltBilgi k={k} text={`Skor ${skor}`} color={S.ink} sayi /> : null}
          </>
        )}
        ek={dar ? null : (
          <Text style={[st.skor, fontOf(700, f), TABULAR, { fontSize: t.orta }]} numberOfLines={1}>
            {skor || '—'}
          </Text>
        )}
        ekGenislik={dar ? undefined : 54}
        sag={(
          <View style={st.sonucHucre}>
            <View style={[st.sonucKutu, item.actual ? st.sonucVar : null]}>
              <Text style={[st.sonucTxt, fontOf(700, f), TABULAR, { fontSize: t.orta }]}>
                {item.actual ? resmi(item.actual) : '—'}
              </Text>
            </View>
            <Text
              style={[st.im, { fontSize: t.orta }]}
              accessibilityLabel={MARK_ETIKET[String(item.hit)]}
            >
              {MARK[String(item.hit)]}
            </Text>
          </View>
        )}
        sagGenislik={sagGenislik}
      />
    );
  };

  return (
    <View style={st.root}>
      <View style={st.header}>
        <Text style={[st.baslik, fontOf(700, f), { fontSize: t.baslik }]} numberOfLines={1}>
          Kupon {coupon.couponNo} Sonucu
        </Text>
        <Text style={[st.altBaslik, fontOf(500, f), { fontSize: t.kucuk }]} numberOfLines={1}>
          {[roundName, season ? `${season} Sezonu` : null].filter(Boolean).join(' · ') || 'Hafta bilgisi yok'}
        </Text>

        <View style={st.sumRow}>
          <SayiKutu k={k} etiket="DOĞRU" deger={`${ev.correct}/${ev.resolved}`} tone={S.good}
            alt={`${ev.total} maçta`} testID="kupon-sonuc-dogru" />
          <SayiKutu k={k} etiket="YANLIŞ" deger={String(ev.wrong)} tone={ev.wrong ? S.bad : S.inkDim} />
          <SayiKutu k={k} etiket="BEKLEYEN" deger={String(ev.pending)} tone={ev.pending ? S.warn : S.inkDim}
            alt={ev.pending ? 'resmî sonuç yok' : null} />
        </View>

        <Text style={[st.tier, fontOf(700, f), { fontSize: t.metin }]}>{tierLine}</Text>
        <Not k={k} text={`Değerlendirme: kilitli final versiyon (V${ev.versionNo}) · yalnız resmî 90 dakika sonucu`} />
      </View>

      <ScrollView contentContainerStyle={st.listPad}>
        {ev.misses.length > 0 ? (
          <View style={st.missBox}>
            <Text style={[st.missTitle, fontOf(700, f), { fontSize: t.metin }]}>
              Nereden yattım? ({ev.misses.length} maç)
            </Text>
            {ev.misses.map((r) => {
              const m = byNo.get(r.no);
              const sys = resmi(m?.prediction?.symbol);
              const radar = resmi(radarMap[r.no]);
              // Hata hangi karar noktasından? Kilit anındaki kayıtlı sinyallerle kıyas.
              const sysHit = sys ? sys.split('-').includes(resmi(r.actual)) : null;
              const radHit = radar ? radar === resmi(r.actual) : null;
              const ctx = [
                sys ? `Sistem ${sys} demişti (${sysHit ? 'tutmuş' : 'o da yatmış'})` : 'Sistem kaydı yok',
                radar ? `Radar ${radar} demişti (${radHit ? 'tutmuş' : 'o da yatmış'})` : 'Radar kaydı yok',
              ].join(' · ');
              return (
                <Text key={r.no} style={[st.missLine, fontOf(500, f), { fontSize: t.kucuk }]}>
                  {r.no}. {m ? `${m.home?.mediumName || ''} - ${m.away?.mediumName || ''}` : 'maç'}: Sen {resmi(r.outcomes.join(''))} seçmiştin, sonuç {resmi(r.actual)} geldi{scoreOf(m) ? ` (${scoreOf(m)})` : ''}. {ctx}.
                </Text>
              );
            })}
          </View>
        ) : ev.allResolved && ev.wrong === 0 ? (
          <View style={[st.missBox, st.cleanBox]}>
            <Text style={[st.missTitle, fontOf(700, f), { color: S.good, fontSize: t.metin }]}>
              Hiç yatan maç yok — tüm seçimler tuttu.
            </Text>
          </View>
        ) : null}

        <Tablo testID="kupon-sonuc-tablo">
          <Thead k={k}>
            <Th text="SIRA" k={k} style={{ width: Math.round(32 * k), paddingHorizontal: 5 }} center />
            <Th text="EV SAHİBİ - KONUK TAKIM" k={k} style={{ flex: 1, minWidth: 0 }} />
            {!dar ? <Th text="SKOR" k={k} style={{ width: Math.round(54 * k) }} /> : null}
            <Th text="SONUÇ" k={k} style={{ width: Math.round(sagGenislik * k) }} center />
          </Thead>

          {ev.rows.map((r, i) => satir(r, i))}

          <Tfoot k={k}>
            Sen / Sistem / Radar satırları maç-öncesi KAYITLI değerlerdir; kayıt
            yoksa "—" yazar, uydurulmaz. Seçim ve sonuçlar resmî bülten yazımıyla
            gösterilir: 1 - 0 - 2 ("0" beraberlik). Bir maç yalnız resmî 90
            dakika sonucu geldiğinde ✅/❌ olur; gelmeyen maç ⏳ bekler. Bu ekran
            analiz amaçlıdır; kesin sonuç veya kazanç vaadi değildir.
          </Tfoot>
        </Tablo>
      </ScrollView>
    </View>
  );
}

/* STİL — yayın stüdyosunun paleti (studioTheme). Genel uygulama teması
   (theme.js) burada KULLANILMAZ; iki palet karışırsa aynı ekranda iki farklı
   gri, iki farklı köşe yarıçapı çıkıyor. */
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: S.bg },

  header: {
    backgroundColor: S.panel, borderBottomWidth: TABLE.hair, borderBottomColor: S.line,
    paddingHorizontal: SP.md, paddingVertical: SP.sm, gap: 2,
  },
  baslik: { color: S.ink },
  altBaslik: { color: S.inkDim },
  sumRow: { flexDirection: 'row', gap: SP.lg, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: SP.sm },
  tier: { color: S.accent, marginTop: SP.xs },

  listPad: { padding: SP.md, paddingBottom: 40 },

  missBox: {
    backgroundColor: S.badSoft, borderWidth: TABLE.hair, borderColor: S.bad, borderRadius: R.md,
    padding: SP.md, marginBottom: SP.md, gap: 2,
  },
  cleanBox: { backgroundColor: S.goodSoft, borderColor: S.good },
  missTitle: { color: S.bad },
  missLine: { color: S.ink, lineHeight: 17 },

  skor: { color: S.ink },

  sonucHucre: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sonucKutu: {
    minWidth: 22, paddingHorizontal: 4, paddingVertical: 1, borderRadius: R.sm,
    borderWidth: TABLE.hair, borderColor: S.line, backgroundColor: S.panel2, alignItems: 'center',
  },
  sonucVar: { borderColor: S.lineStrong, backgroundColor: S.panel3 },
  sonucTxt: { color: S.ink },
  im: {},
});
