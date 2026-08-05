// TAKIM SEÇ EKRANI — profildeki "Takımım" için lig → takım seçimi.
// (Kullanıcı isteği, 2026-08-04: serbest yazı kaldırıldı; kullanıcı listeden
// kendi takımını seçer. Ligler backend kataloğundan gelir: Süper Lig, Premier
// League, La Liga, Serie A, Bundesliga, Liga Portugal, Eredivisie...)
//
// DÜRÜSTLÜK: liste yalnız backend'in GERÇEK kataloğundan gelir; yüklenemeyen
// lig "yüklenemedi" der, takım uydurulmaz. Takım adı kaynaktaki gibi kaydedilir.
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { api } from '../api';
import { refreshUser } from '../auth';
import { colors, spacing, radius, shadow } from '../theme';
import { Logo } from '../ui';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

export default function TeamPickerScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [acikLig, setAcikLig] = useState(null); // tek seferde bir lig açık
  const [arama, setArama] = useState('');
  const [kaydedilen, setKaydedilen] = useState(null); // kaydedilmekte olan takım adı

  useEffect(() => {
    let alive = true;
    api.favoriteTeams()
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []);

  const sec = async (name) => {
    if (kaydedilen) return; // çifte tıklama koruması
    setKaydedilen(name);
    try {
      await api.updateProfile({ favoriteTeam: name });
      await refreshUser();
      navigation.goBack();
    } catch (e) {
      alert(e.message);
      setKaydedilen(null);
    }
  };

  // Arama: tüm liglerde takım adına göre süzer (Türkçe küçük/büyük duyarsız).
  const aranan = arama.trim().toLocaleLowerCase('tr-TR');
  const ligler = useMemo(() => {
    const list = data?.leagues || [];
    if (!aranan) return list;
    return list
      .map((l) => ({ ...l, teams: l.teams.filter((t) => t.name.toLocaleLowerCase('tr-TR').includes(aranan)) }))
      .filter((l) => l.teams.length);
  }, [data, aranan]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState message="Takım listesi yükleniyor…" />;

  return (
    <ScrollView style={st.kok} contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}>
      <Text style={st.baslik}>Takımını Seç</Text>
      <Text style={st.altBaslik}>Ligini aç, takımına dokun — profilinde görünür.</Text>

      <TextInput
        style={st.arama}
        value={arama}
        onChangeText={setArama}
        placeholder="🔍 Takım ara (tüm liglerde)"
        placeholderTextColor={colors.textMuted}
      />

      {ligler.map((lig) => {
        const acik = aranan ? true : acikLig === lig.key; // aramada hepsi açık
        return (
          <View key={lig.key} style={st.ligKart}>
            <TouchableOpacity
              style={st.ligBaslik}
              activeOpacity={0.85}
              onPress={() => setAcikLig(acik ? null : lig.key)}
            >
              <Logo uri={lig.image} name={lig.label} size={24} />
              <Text style={st.ligAd} numberOfLines={1}>{lig.label}</Text>
              <Text style={st.ligSayi}>{lig.error ? '—' : lig.teams.length}</Text>
              <Text style={st.ligOk}>{acik ? '▾' : '▸'}</Text>
            </TouchableOpacity>

            {acik ? (
              lig.error ? (
                <Text style={st.ligHata}>Bu ligin takım listesi yüklenemedi.</Text>
              ) : (
                <View style={st.takimListe}>
                  {lig.teams.map((t) => (
                    <TouchableOpacity
                      key={`${lig.key}-${t.name}`}
                      style={st.takimSatir}
                      activeOpacity={0.8}
                      onPress={() => sec(t.name)}
                      disabled={!!kaydedilen}
                    >
                      <Logo uri={t.image} name={t.name} size={26} />
                      <Text style={st.takimAd} numberOfLines={1}>{t.name}</Text>
                      {kaydedilen === t.name
                        ? <ActivityIndicator size="small" color={colors.primary} />
                        : <Text style={st.takimSecTxt}>Seç ›</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              )
            ) : null}
          </View>
        );
      })}

      {aranan && !ligler.length ? (
        <Text style={st.bosArama}>"{arama}" için sonuç yok. Takımın listedeki liglerde olmayabilir.</Text>
      ) : null}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  kok: { flex: 1, backgroundColor: colors.bg },
  baslik: { color: colors.text, fontSize: 20, fontWeight: '900' },
  altBaslik: { color: colors.textMuted, fontSize: 12.5, marginTop: 4, marginBottom: 12 },
  arama: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9,
    color: colors.text, fontSize: 13.5, marginBottom: 12,
  },
  ligKart: {
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.border, marginBottom: 8, overflow: 'hidden', ...shadow.soft,
  },
  ligBaslik: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  ligAd: { flex: 1, color: colors.text, fontSize: 13.5, fontWeight: '900' },
  ligSayi: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  ligOk: { color: colors.textMuted, fontSize: 13, fontWeight: '900' },
  ligHata: { color: colors.warning, fontSize: 12, fontWeight: '700', paddingHorizontal: 13, paddingBottom: 12 },
  takimListe: { borderTopWidth: 1, borderTopColor: colors.border },
  takimSatir: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 13, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  takimAd: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
  takimSecTxt: { color: colors.accent, fontSize: 12, fontWeight: '900' },
  bosArama: { color: colors.textMuted, fontSize: 12.5, textAlign: 'center', marginTop: 16 },
});
