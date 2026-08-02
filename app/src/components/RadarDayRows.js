// RADAR 3 / RADAR 4 GÜN SATIRLARI — seçili günün mühürlü değeri + önceki güne
// göre yön oku.
//
// NEDEN AYRI DOSYA: RadarScreen'de bu iki satır çizicisi, kendi yardımcı
// haritalarıyla (gün/kaynak eşlemeleri, önceki-gün arayıcıları) birlikte
// ekranın ortasına dağılmıştı. Bileşenler artık uç yanıtını olduğu gibi alıp
// kendi türetmesini yapıyor; ekran yalnız "hangi gün seçili" ve "hangi satır
// açık" bilgisini veriyor.
//
// İKİ RADAR KARIŞTIRILMAZ:
//  * Radar 4 = gerçek 1/X/2 ORANI (1.61 · 3.20 · 4.25)
//  * Radar 3 = kullanıcıların oynama YÜZDESİ (%62 · %21 · %17)
// Aynı ok/renk dili kullanılır ama birimler farklıdır; metinler bunu her
// yerde ayrıca söyler (bkz. RadarTabHeaders.js).
//
// UYDURMA YOK: değeri olmayan satır boş bırakılmaz, KENDİ sebebini yazar.
// Sebep arka uçta üretilir (notes) — burada üretilmez.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { providerLabel, providerColor } from './RadarTabHeaders';
import PlayedDnaPanel from './PlayedDnaPanel';

const fmtOdd = (v) => (v == null ? '—' : Number(v).toFixed(2));

// Yön oku: yükseliş yeşil ▲ · düşüş kırmızı ▼ · sabit sarı =.
// Sabit değer de BİR BİLGİDİR; ok basmamak "veri yok" ile karışırdı.
export function yonOku(cur, prev) {
  if (prev == null || cur == null) return null;
  const d = cur - prev;
  if (Math.abs(d) < 0.005) return { s: '=', c: colors.warning };
  return d > 0 ? { s: '▲', c: colors.success } : { s: '▼', c: colors.danger };
}

// Seçili günden ÖNCEKİ en yakın dolu günü bulur (kıyas için).
// "Bir önceki gün" değil "bir önceki KAYITLI gün": arada boş gün varsa
// kıyas atlanmaz, yoksa hareket görünmez olurdu.
function oncekiDoluGun(days, selIdx, sec) {
  for (let i = selIdx - 1; i >= 0; i -= 1) {
    const v = sec(days[i]);
    if (v) return v;
  }
  return null;
}

function SatirBasi({ item }) {
  return (
    <View style={styles.memTop}>
      <Text style={styles.memNo}>{item.no}</Text>
      <Text style={styles.memTeams} numberOfLines={1}>{item.home} – {item.away}</Text>
    </View>
  );
}

/** 1/X/2 üçlüsü + önceki kayıtlı güne göre yön oku. */
export function OddsTriple({ odds, prev }) {
  return (
    <View style={styles.oddsLine}>
      {[['1', 'home'], ['X', 'draw'], ['2', 'away']].map(([lbl, key]) => {
        const v = odds?.[key];
        const a = yonOku(v, prev?.[key]);
        return (
          <View key={lbl} style={styles.oddsCell}>
            <Text style={styles.oddsK}>{lbl}</Text>
            <Text style={styles.oddsV}>{fmtOdd(v)}</Text>
            {a ? <Text style={[styles.oddsArrow, { color: a.c }]}>{a.s}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

/**
 * RADAR 4 — bir maçın seçili gündeki mühürlü oranı.
 * @param data /api/radar/daily-odds yanıtı (gün listesi + maç hücreleri)
 */
export function MarketRow({ item, data, day }) {
  const days = data?.days || [];
  const selIdx = days.findIndex((d) => d.date === day);
  const cells = (data?.matches || []).find((m) => m.no === item.no)?.cells || {};
  const notes = (data?.matches || []).find((m) => m.no === item.no)?.notes || {};
  const cell = cells[day] || null;
  // Arka uç sebebi vermiyorsa (eski sürüm) tek jenerik cümleye düşülür.
  const why = cell ? null : (notes[day] || null);
  const prev = cell ? oncekiDoluGun(days, selIdx, (d) => cells?.[d.date]) : null;

  return (
    <View style={styles.memRow}>
      <SatirBasi item={item} />
      {cell ? (
        <View style={styles.oddsWrap}>
          <OddsTriple odds={cell.odds} prev={prev?.odds} />
          <Text style={styles.oddsHint}>{prev ? 'Bir önceki güne göre değişim' : 'İlk kayıtlı gün (kıyas yok)'}</Text>
        </View>
      ) : (
        <View>
          <Text style={styles.memNone}>{why?.text ? `${why.text}.` : 'Bu gün için oran kaydı yok.'}</Text>
          {why?.detail ? <Text style={styles.memWhy}>{why.detail}</Text> : null}
        </View>
      )}
    </View>
  );
}

// Bu hafta veri veren sağlayıcılar SABİT sırayla listelenir; sıra yanıttan
// gelen rastgele diziliş olsaydı aynı maç her yenilemede farklı görünürdü.
const PROVIDER_ORDER = ['nesine', 'misli', 'bilyoner', 'oley'];
export function aktifSaglayicilar(sources) {
  return (sources || []).slice()
    .sort((a, b) => ((PROVIDER_ORDER.indexOf(a) + 1) || 99) - ((PROVIDER_ORDER.indexOf(b) + 1) || 99));
}

/**
 * RADAR 3 — bir maçın seçili gündeki oynanma yüzdeleri, HER KAYNAK AYRI SATIR.
 * Kaynaklar ortalanmaz: iki site farklı yüzde veriyorsa bu bir bilgidir,
 * tek sayıya indirilirse kaybolur.
 * @param data     /api/radar/daily-played yanıtı
 * @param openKey  açık DNA paneli anahtarı ("<maçNo>|<kaynak>")
 */
export function PublicRow({ item, data, day, openKey, onToggleDna, roundId, tick }) {
  const days = data?.days || [];
  const gun = days.find((d) => d.date === day);

  // Seçili gün henüz gelmediyse yüzde BASILMAZ (uydurma yerine dürüst not).
  if (gun?.future) {
    return (
      <View style={styles.memRow}>
        <SatirBasi item={item} />
        <Text style={styles.memNone}>Bu gün henüz gelmedi — yüzde o gün oluştukça dolar.</Text>
      </View>
    );
  }

  const selIdx = days.findIndex((d) => d.date === day);
  const cells = (data?.matches || []).find((m) => m.no === item.no)?.cells || {};
  const bySource = cells[day]?.bySource || null;
  const saglayicilar = aktifSaglayicilar(data?.sources);

  return (
    <View style={styles.memRow}>
      <SatirBasi item={item} />
      {saglayicilar.length ? saglayicilar.map((pv) => {
        const c = bySource?.[pv] || null;
        const prev = c ? oncekiDoluGun(days, selIdx, (d) => cells?.[d.date]?.bySource?.[pv]) : null;
        const key = `${item.no}|${pv}`;
        const acik = openKey === key;
        return (
          <View key={pv}>
            {/* Kaynak satırı: dokununca o kaynağın GEÇMİŞ Oynanma DNA'sı açılır. */}
            <TouchableOpacity
              style={styles.provRow}
              activeOpacity={c ? 0.7 : 1}
              disabled={!c}
              onPress={() => onToggleDna(acik ? null : key)}
            >
              {/* KAYNAK ADI YERİNE RENKLİ NOKTA: sarı=Nesine, turuncu=Misli,
                  yeşil=Bilyoner. Satır kısalır, 15 maç × 3 kaynak okunur kalır.
                  Hangi rengin hangi site olduğu panel başlığındaki "Aktif
                  kaynak" satırında ADIYLA yazılır — kaynak gizlenmez.
                  Erişilebilirlik: renk tek ayırt edici olmasın diye
                  accessibilityLabel kaynağın ADINI söyler. */}
              <View
                style={[styles.provDot, { backgroundColor: providerColor(pv) }]}
                accessibilityLabel={providerLabel(pv)}
                testID={`kaynak-nokta-${pv}`}
              />
              {c ? (
                <View style={styles.provVals}>
                  {['1', 'X', '2'].map((k) => {
                    const v = c.percentages?.[k];
                    const a = yonOku(v, prev?.percentages?.[k]);
                    return (
                      <Text key={k} style={styles.provVal}>
                        {k} %{Math.round(Number(v))}
                        {a ? <Text style={{ color: a.c, fontWeight: '900' }}> {a.s}</Text> : null}
                      </Text>
                    );
                  })}
                  <Text style={styles.provChev}>{acik ? '▾' : '›'}</Text>
                </View>
              ) : <Text style={styles.provNone}>bu gün kayıt yok</Text>}
            </TouchableOpacity>
            {acik ? (
              <PlayedDnaPanel roundId={roundId} no={item.no} source={pv} day={day} tick={tick} />
            ) : null}
          </View>
        );
      }) : <Text style={styles.memNone}>Bu gün için oynanma yüzdesi kaydı yok.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  memRow: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  memTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  memNo: { color: colors.textMuted, fontSize: 15, fontWeight: '800', width: 22, textAlign: 'center' },
  memTeams: { color: colors.text, fontSize: 14, fontWeight: '800', flex: 1 },
  memNone: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic', marginTop: 6, marginLeft: 34 },
  memWhy: { color: colors.textMuted, fontSize: 11, marginTop: 2, marginLeft: 34, opacity: 0.85 },

  oddsWrap: { marginTop: 8, marginLeft: 34 },
  oddsLine: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  oddsCell: { flexDirection: 'row', alignItems: 'baseline', gap: 4, backgroundColor: colors.surfaceSoft, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 5 },
  oddsK: { color: colors.textMuted, fontSize: 11, fontWeight: '900' },
  oddsV: { color: colors.text, fontSize: 14, fontWeight: '900' },
  oddsArrow: { fontSize: 11, fontWeight: '900' },
  oddsHint: { color: colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 5 },

  provRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginLeft: 34, flexWrap: 'wrap' },
  // Kaynak noktası: ad yerine renk. Çerçeve açık zeminde sarıyı görünür tutar.
  provDot: { width: 11, height: 11, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.18)' },
  provVals: { flexDirection: 'row', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' },
  provVal: { color: colors.textSoft, fontSize: 13, fontWeight: '800' },
  provNone: { color: colors.textMuted, fontSize: 11, fontStyle: 'italic' },
  provChev: { color: colors.textMuted, fontSize: 13, fontWeight: '900' },
});
