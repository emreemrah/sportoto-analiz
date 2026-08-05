// TAKIM LOGOSU ZEMİN FİLİGRANI — favori takımın arması, ekranın arkasında
// büyük ve çok soluk (kullanıcı isteği, 2026-08-04).
// ---------------------------------------------------------------------------
// Arma, takım kataloğundan ada göre bulunur (ProfileScreen ile aynı kural:
// eşleşme yoksa HİÇBİR görsel konmaz — başka kulübün arması yasak).
// Katalog isteği modül içinde TEK KEZ yapılır; her ekran tekrar sormaz.
// Opaklık 0.06 — içerik okunur kalır. pointerEvents kapalı: tıklamayı yemez.
import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { api } from '../api';
import { useAuth } from '../auth';

let katalogSoz = null; // tek uçuş: tüm ekranlar aynı sözü paylaşır

function useTakimLogo() {
  const { user } = useAuth();
  const ad = user?.favorite_team || '';
  const [logo, setLogo] = useState(null);
  useEffect(() => {
    let iptal = false;
    if (!ad) { setLogo(null); return undefined; }
    if (!katalogSoz) katalogSoz = api.favoriteTeams().catch((e) => { katalogSoz = null; throw e; });
    katalogSoz.then((d) => {
      if (iptal) return;
      const kucuk = ad.toLocaleLowerCase('tr-TR');
      for (const lig of d?.leagues || []) {
        const t = (lig.teams || []).find((x) => x.name.toLocaleLowerCase('tr-TR') === kucuk
          || (x.cleanName || '').toLocaleLowerCase('tr-TR') === kucuk);
        if (t?.image) { setLogo(t.image); return; }
      }
      setLogo(null);
    }).catch(() => { if (!iptal) setLogo(null); });
    return () => { iptal = true; };
  }, [ad]);
  return logo;
}

export default function TakimLogoZemin() {
  const logo = useTakimLogo();
  if (!logo) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image source={{ uri: logo }} style={st.logo} resizeMode="contain" />
    </View>
  );
}

const st = StyleSheet.create({
  // Boyut serüveni: 320px sabit → ekran boyu (%100) → iki tık küçültüldü
  // (%70, kullanıcı isteği 2026-08-06). Ortalanmış durur, oranı bozulmaz.
  logo: {
    position: 'absolute',
    top: '15%',
    left: '15%',
    width: '70%',
    height: '70%',
    opacity: 0.1,
  },
});
