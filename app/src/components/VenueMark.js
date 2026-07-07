// EV SAHİBİ / DEPLASMAN işareti — takım adının yanında tutarlı ikon.
// Ev = ev ikonu, Deplasman = uçak. (PNG'ler alfa'sız/opak olduğundan tintColor
// KULLANILMAZ — kutu gibi dolar; ikonlar olduğu gibi, beyaz kart üstünde gösterilir.)
import React from 'react';
import { Image } from 'react-native';

const EV = require('../../assets/venue/home-win.png');    // ev ikonu
const UCAK = require('../../assets/venue/away-win.png');   // uçak ikonu

export default function VenueMark({ side = 'home', size = 15, style }) {
  const isAway = side === 'away' || side === '2' || side === 'dep';
  return <Image source={isAway ? UCAK : EV} style={[{ width: size, height: size }, style]} resizeMode="contain" />;
}
