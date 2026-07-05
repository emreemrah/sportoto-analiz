// src/components/BallLoader.js
// Sürekli dönen futbol topu (spinner yerine).
// Sadece transform animasyonu → useNativeDriver:true (web'de de sorunsuz).

import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, Polygon, Line } from 'react-native-svg';
import { colors } from '../theme';

export default function BallLoader({ size = 44, color = colors.primary }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ rotate }] }}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        {/* Dış çember */}
        <Circle cx="24" cy="24" r="21" fill="none" stroke={color} strokeWidth="2.5" />
        {/* Orta pentagon */}
        <Polygon
          points="24,16 31.6,21.5 28.7,30.5 19.3,30.5 16.4,21.5"
          fill={color}
        />
        {/* Dikişler: pentagon köşelerinden dışa */}
        <Line x1="24" y1="16" x2="24" y2="4" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <Line x1="31.6" y1="21.5" x2="43" y2="17.8" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <Line x1="28.7" y1="30.5" x2="35.8" y2="40.2" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <Line x1="19.3" y1="30.5" x2="12.2" y2="40.2" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <Line x1="16.4" y1="21.5" x2="5" y2="17.8" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}
