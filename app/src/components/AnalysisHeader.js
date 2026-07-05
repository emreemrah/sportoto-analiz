import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { G, Rect, Line, Circle, Path } from 'react-native-svg';

// Analiz sekmesi üst paneli: mini saha + X/O taktik işaretleri + başlık.
// RadarScreen'in mevcut header'ının yerine (veya üstüne) konur.
// Props: title, subtitle, children (başlık altına link vb. eklemek için)
export default function AnalysisHeader({
  title = 'Maç Analizi',
  subtitle = 'Form, istatistik, sistem tahmini ve risk sinyalleri',
  children,
}) {
  return (
    <View style={styles.panel}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice">
        <G stroke="rgba(236,244,238,0.16)" strokeWidth={2} fill="none">
          <Rect x={12} y={12} width={376} height={196} rx={4} />
          <Line x1={200} y1={12} x2={200} y2={208} />
          <Circle cx={200} cy={110} r={38} />
          <Rect x={12} y={60} width={60} height={100} />
          <Rect x={328} y={60} width={60} height={100} />
        </G>
        <G stroke="rgba(236,244,238,0.8)" strokeWidth={3.5} strokeLinecap="round" fill="none">
          <Line x1={86} y1={52} x2={98} y2={64} />
          <Line x1={98} y1={52} x2={86} y2={64} />
          <Line x1={120} y1={150} x2={132} y2={162} />
          <Line x1={132} y1={150} x2={120} y2={162} />
        </G>
        <G stroke="#E8A35C" strokeWidth={3.5} fill="none">
          <Circle cx={300} cy={70} r={8} />
          <Circle cx={272} cy={160} r={8} />
        </G>
        <Path
          d="M 132 156 Q 190 120 262 156"
          stroke="#3FA574" strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray={[6, 8]}
        />
      </Svg>
      <View style={styles.scrim}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    height: 150,
    backgroundColor: '#0E3222',
    overflow: 'hidden',
  },
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
    backgroundColor: 'rgba(7,19,23,0.30)',
  },
  title: {
    color: '#ECF4EE',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 2,
    color: 'rgba(236,244,238,0.72)',
    fontSize: 13,
  },
});
