// PREMIUM KODU EKRANI — kullanıcı, kendisine verilen kodu buraya yazar.
// ---------------------------------------------------------------------------
// AKIŞ: operatör yönetim panelinden kod üretir → kullanıcıya iletir →
// kullanıcı burada kullanır → hak sunucuda yazılır.
//
// DÜRÜSTLÜK KURALLARI
//  • Durum SUNUCUDAN okunur. Uygulama "premium" bilgisini kendi belleğinde
//    tutup göstermez; kapatıp açınca farklı bir şey söylemesin.
//  • Premium sistemi sunucuda henüz kurulmadıysa (tablolar yok) ekran bunu
//    açıkça yazar — "premium değilsin" deyip sebebi gizlemez.
//  • Hata mesajı sunucudan ne geldiyse odur; uydurulmuş "başarılı" yok.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';

import { api } from '../api';
import { colors, spacing, radius } from '../theme';

/** Kullanıcı kodu tireli/küçük harfli yazabilir; sunucuya kanonik biçim gider. */
function kodTemizle(ham) {
  return String(ham || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export default function PremiumCodeScreen() {
  const [durum, setDurum] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kod, setKod] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [mesaj, setMesaj] = useState(null);      // { tur: 'ok'|'hata', metin }

  const durumOku = useCallback(async () => {
    setYukleniyor(true);
    try {
      setDurum(await api.premiumDurum());
    } catch (e) {
      setDurum(null);
      setMesaj({ tur: 'hata', metin: e?.message || 'Durum okunamadı.' });
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => { durumOku(); }, [durumOku]);

  const kullan = useCallback(async () => {
    const temiz = kodTemizle(kod);
    if (temiz.length < 4) { setMesaj({ tur: 'hata', metin: 'Kodu eksiksiz yaz.' }); return; }
    setGonderiliyor(true);
    setMesaj(null);
    try {
      const r = await api.premiumKodKullan(temiz);
      setDurum(r);
      setKod('');
      setMesaj({ tur: 'ok', metin: 'Kod kullanıldı — premium erişimin açıldı.' });
    } catch (e) {
      setMesaj({ tur: 'hata', metin: e?.message || 'Kod kullanılamadı.' });
    } finally {
      setGonderiliyor(false);
    }
  }, [kod]);

  const premium = durum?.premium === true;

  return (
    <ScrollView style={s.kok} contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
      <View style={[s.kart, premium && s.kartPremium]}>
        <Text style={s.baslik}>{premium ? '⭐ Premium erişimin açık' : 'Premium erişimin yok'}</Text>
        {yukleniyor ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
        ) : (
          <Text style={s.aciklama}>
            {durum?.kurulmadi
              ? 'Premium sistemi bu sunucuda henüz kurulmadı.'
              : premium
                ? (durum.suresiz
                  ? 'Süresiz erişimin var.'
                  : `Bitiş: ${durum.bitis ? new Date(durum.bitis).toLocaleDateString('tr-TR') : 'bilinmiyor'}`)
                : 'Elinde bir kod varsa aşağıya yazarak erişimini açabilirsin.'}
          </Text>
        )}
      </View>

      <View style={s.kart}>
        <Text style={s.baslik}>Kodum var</Text>
        <TextInput
          style={s.giris}
          value={kod}
          onChangeText={setKod}
          placeholder="ÖRNEK: A7K2M9P4XR"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={24}
          accessibilityLabel="Premium kodu"
        />
        <TouchableOpacity
          style={[s.dugme, gonderiliyor && { opacity: 0.6 }]}
          onPress={kullan}
          disabled={gonderiliyor}
          activeOpacity={0.85}
        >
          <Text style={s.dugmeTxt}>{gonderiliyor ? 'Kontrol ediliyor…' : 'Kodu kullan'}</Text>
        </TouchableOpacity>

        {mesaj ? (
          <Text style={[s.mesaj, mesaj.tur === 'ok' ? s.mesajOk : s.mesajHata]}>{mesaj.metin}</Text>
        ) : null}

        <Text style={s.not}>
          Kodlar büyük/küçük harf ve tire farkına takılmaz; “a7k2-m9p4” ile “A7K2M9P4” aynıdır.
          Bir kodu yalnız bir kez kullanabilirsin.
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  kok: { flex: 1, backgroundColor: colors.bg },
  kart: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md,
  },
  kartPremium: { borderColor: colors.warning, borderWidth: 2 },
  baslik: { color: colors.text, fontSize: 15, fontWeight: '900' },
  aciklama: { color: colors.textSoft, fontSize: 13, marginTop: 6, lineHeight: 18 },
  giris: {
    marginTop: 10, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 11, color: colors.text,
    fontSize: 16, fontWeight: '900', letterSpacing: 2, backgroundColor: colors.surfaceSoft,
  },
  dugme: {
    marginTop: 10, backgroundColor: colors.primary, borderRadius: radius.sm,
    paddingVertical: 12, alignItems: 'center',
  },
  dugmeTxt: { color: '#fff', fontSize: 14, fontWeight: '900' },
  mesaj: { marginTop: 10, fontSize: 13, fontWeight: '800' },
  mesajOk: { color: colors.success },
  mesajHata: { color: colors.accent },
  not: { color: colors.textMuted, fontSize: 11.5, lineHeight: 16, marginTop: 10 },
});
