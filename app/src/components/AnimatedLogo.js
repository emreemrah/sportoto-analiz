import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';
import { colors } from '../theme';

// Marka logosu: 3 çubuğun sırayla büyüyüp bir "grafik kupa" siluetine
// oturması, sonra sıfırlanıp döngüyle tekrarlaması. Yeni paket gerekmez,
// sadece React Native'in kendi Animated API'si kullanılır.
const BAR_RATIOS = [0.5, 0.75, 1];
const BAR_COLORS_KEY = ['accent', 'white', 'accent'];

export default function AnimatedLogo({ size = 72 }) {
  const anims = useRef(BAR_RATIOS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const growUp = Animated.stagger(
      130,
      anims.map((a) =>
        Animated.timing(a, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        })
      )
    );
    const shrinkDown = Animated.parallel(
      anims.map((a) =>
        Animated.timing(a, {
          toValue: 0,
          duration: 300,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        })
      )
    );

    const loop = Animated.loop(
      Animated.sequence([growUp, Animated.delay(550), shrinkDown, Animated.delay(180)])
    );
    loop.start();
    return () => loop.stop();
  }, [anims]);

  const barW = size * 0.16;
  const maxH = size * 0.5;
  const minH = size * 0.08;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: size * 0.6, gap: size * 0.13 }}>
      {BAR_RATIOS.map((ratio, i) => (
        <Animated.View
          key={i}
          style={{
            width: barW,
            borderRadius: barW / 2,
            backgroundColor: BAR_COLORS_KEY[i] === 'white' ? '#ffffff' : colors.accent,
            height: anims[i].interpolate({
              inputRange: [0, 1],
              outputRange: [minH, maxH * ratio],
            }),
          }}
        />
      ))}
    </View>
  );
}
