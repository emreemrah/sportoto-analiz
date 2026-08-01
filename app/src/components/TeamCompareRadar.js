// TAKIM GÜÇ KARŞILAŞTIRMASI — radar (örümcek ağı) grafiği.
// Eksen mantığı SAF ve TESTLİDİR (src/compareRadar.js). İki takımın da gerçek
// verisi olan eksenler çizilir; 3'ten az eksen varsa bileşen HİÇ görünmez
// (uydurma eksen yok). Normalizasyon ikili kıyastır — mutlak güç iddiası değil.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polygon, Line, Circle, Text as SvgText } from 'react-native-svg';
import { colors, spacing, radius } from '../theme';
import { buildCompareAxes, polygonPoints } from '../compareRadar';

const HOME_C = '#2f6fed';
const AWAY_C = '#e0762c';
const SIZE = 300;
const CX = SIZE / 2;
const CY = 128;
const R = 88;

export default function TeamCompareRadar({ home, away, homeName, awayName }) {
  const axes = buildCompareAxes(home, away);
  if (!axes.length) return null; // yeterli ortak veri yok → dürüstçe gizlenir

  const n = axes.length;
  const angle = (i) => (-90 + (i * 360) / n) * (Math.PI / 180);
  const rings = [33, 66, 100];

  return (
    <View style={st.card}>
      <Text style={st.title}>🕸️ Güç Karşılaştırması</Text>
      <Text style={st.sub}>İki takımın kendi aralarında kıyası — büyük değer 100 kabul edilir; mutlak güç puanı değildir.</Text>

      <View style={st.legend}>
        <View style={st.legItem}><View style={[st.dot, { backgroundColor: HOME_C }]} /><Text style={st.legTxt} numberOfLines={1}>{homeName}</Text></View>
        <View style={st.legItem}><View style={[st.dot, { backgroundColor: AWAY_C }]} /><Text style={st.legTxt} numberOfLines={1}>{awayName}</Text></View>
      </View>

      <View style={{ alignItems: 'center' }}>
        <Svg width={SIZE} height={252}>
          {/* Halkalar */}
          {rings.map((rv) => (
            <Polygon
              key={rv}
              points={polygonPoints(axes.map(() => rv), CX, CY, R)}
              fill="none"
              stroke={colors.border}
              strokeWidth={1}
            />
          ))}
          {/* Eksen çizgileri + etiketler */}
          {axes.map((ax, i) => {
            const a = angle(i);
            const x2 = CX + R * Math.cos(a);
            const y2 = CY + R * Math.sin(a);
            const lx = CX + (R + 20) * Math.cos(a);
            const ly = CY + (R + 20) * Math.sin(a);
            return (
              <React.Fragment key={ax.key}>
                <Line x1={CX} y1={CY} x2={x2} y2={y2} stroke={colors.border} strokeWidth={1} />
                <SvgText
                  x={lx}
                  y={ly + 4}
                  fontSize="10.5"
                  fontWeight="bold"
                  fill={colors.textMuted}
                  textAnchor="middle"
                >
                  {ax.label}
                </SvgText>
              </React.Fragment>
            );
          })}
          {/* Takım çokgenleri */}
          <Polygon points={polygonPoints(axes.map((a) => a.home), CX, CY, R)} fill={HOME_C + '33'} stroke={HOME_C} strokeWidth={2} />
          <Polygon points={polygonPoints(axes.map((a) => a.away), CX, CY, R)} fill={AWAY_C + '2e'} stroke={AWAY_C} strokeWidth={2} />
          <Circle cx={CX} cy={CY} r={2.5} fill={colors.textMuted} />
        </Svg>
      </View>

      {/* Gerçek değerler — grafik kıyas, sayılar gerçek */}
      <View style={st.rawWrap}>
        {axes.map((ax) => (
          <View key={ax.key} style={st.rawRow}>
            <Text style={[st.rawVal, { color: HOME_C }]}>{fmt(ax.rawHome, ax.key)}</Text>
            <Text style={st.rawLabel}>{ax.label}</Text>
            <Text style={[st.rawVal, { color: AWAY_C, textAlign: 'right' }]}>{fmt(ax.rawAway, ax.key)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function fmt(v, key) {
  if (key === 'clean') return `%${Math.round(v)}`;
  return (Math.round(v * 100) / 100).toString();
}

const st = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  title: { color: colors.text, fontSize: 15, fontWeight: '900' },
  sub: { color: colors.textMuted, fontSize: 10.5, fontStyle: 'italic', marginTop: 3, lineHeight: 14 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 8 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '45%' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legTxt: { color: colors.textSoft, fontSize: 12, fontWeight: '800' },
  rawWrap: { marginTop: 4 },
  rawRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border },
  rawVal: { flex: 1, fontSize: 12.5, fontWeight: '900' },
  rawLabel: { flex: 1, color: colors.textMuted, fontSize: 11.5, fontWeight: '700', textAlign: 'center' },
});
