// TAKIM FİKSTÜRÜ — oynadığı ve oynayacağı maçlar.
// ---------------------------------------------------------------------------
// Maç detayında takım adının altındaki bağlantıdan açılır. Eskiden burada
// sezon istatistikleri vardı; kullanıcı kararıyla fikstüre çevrildi.
//
// TASARIM KARARI — tek liste, tarih sırası, "bugün" çizgisi:
// Oynanmış ve oynanacak maçlar AYRI sekmelere bölünmedi. Bir takımın gidişatı
// okunurken en çok işe yarayan şey, biten maçların hemen ardından sıradaki
// maçı görmek. Ayırmak, kullanıcıyı iki liste arasında gidip gelmeye zorlardı.
// Bunun yerine oynanmışlar ile oynanacaklar arasına "SIRADAKİ" ayracı konur ve
// liste ilk açılışta oraya kaydırılır.
//
// SONUÇ HARFİ YALNIZ BİTMİŞ MAÇTA: G/B/M rozeti oynanmamış maça basılmaz,
// skor yoksa yazılmaz. Sunucu da aynı kuralı uygular (takimFikstur.js).
import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';

import { api } from '../api';
import { colors, spacing, radius } from '../theme';
import { Logo } from '../ui';

const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export function tarihEtiketi(dateUnix) {
  if (!dateUnix) return '—';
  const d = new Date(dateUnix * 1000);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${AY[d.getMonth()]}`;
}

const SONUC_RENGI = { G: colors.green, B: colors.yellow, M: colors.red };

function SatirMac({ f, ligYaz }) {
  const evde = !!f.evde;
  const bizKazandi = f.sonuc;
  return (
    <View style={[st.satir, !f.oynandi && st.satirGelecek]}>
      <View style={st.solSutun}>
        <Text style={st.tarih} numberOfLines={1}>{tarihEtiketi(f.dateUnix)}</Text>
        {/* Turnuva adı YALNIZ birden fazla turnuva varsa yazılır — tek
            turnuvada her satıra aynı adı basmak gürültüden ibaret olurdu. */}
        {ligYaz && f.lig ? <Text style={st.ligTxt} numberOfLines={1}>{f.lig}</Text> : null}
      </View>

      <View style={st.orta}>
        <Text style={[st.takim, evde && st.takimBiz]} numberOfLines={1}>{f.home || '—'}</Text>
        {/* Skor YALNIZ oynanmış maçta; oynanmamışta nötr ayraç. */}
        {f.oynandi && f.score ? (
          <Text style={st.skor}>{f.score.home} - {f.score.away}</Text>
        ) : (
          <Text style={st.skorYok}>v</Text>
        )}
        <Text style={[st.takim, st.takimSag, !evde && st.takimBiz]} numberOfLines={1}>{f.away || '—'}</Text>
      </View>

      {bizKazandi ? (
        <View style={[st.rozet, { backgroundColor: SONUC_RENGI[bizKazandi] || colors.gray }]}>
          <Text style={st.rozetTxt}>{bizKazandi}</Text>
        </View>
      ) : (
        <View style={st.rozetBos} />
      )}
    </View>
  );
}

export default function TakimFiksturModal({ visible, onClose, takim }) {
  const { teamId, seasonId, name, logo, league } = takim || {};
  const [veri, setVeri] = useState(null);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const kaydirmaRef = useRef(null);
  const ayracYRef = useRef(0);

  useEffect(() => {
    if (!visible || !teamId || !seasonId) return undefined;
    let canli = true;
    setVeri(null); setHata(null); setYukleniyor(true);
    api.teamFixtures(teamId, seasonId)
      .then((r) => { if (canli) setVeri(r); })
      .catch((e) => { if (canli) setHata(e.message); })
      .finally(() => { if (canli) setYukleniyor(false); });
    return () => { canli = false; };
  }, [visible, teamId, seasonId]);

  const fikstur = veri?.fikstur || [];
  // Ayraç konumu: ilk oynanmamış maç. Hiç yoksa (sezon bitti) ayraç çizilmez.
  const ilkGelecek = useMemo(() => fikstur.findIndex((f) => !f.oynandi), [fikstur]);
  const ligler = useMemo(
    () => [...new Set(fikstur.map((f) => f.lig).filter(Boolean))],
    [fikstur],
  );

  return (
    <Modal visible={!!visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.overlay}>
        <TouchableOpacity style={st.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={st.sheet}>
          <View style={st.head}>
            <Logo uri={logo} name={name} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={st.ad} numberOfLines={1}>{veri?.takimAdi || name || '—'}</Text>
              <Text style={st.alt} numberOfLines={1}>
                {league || ''}
                {veri ? ` · ${veri.oynanan}/${veri.toplam} maç oynandı` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Kapat"><Text style={st.kapat}>✕</Text></TouchableOpacity>
          </View>

          {yukleniyor ? (
            <View style={st.merkez}><ActivityIndicator color={colors.primary} /></View>
          ) : hata ? (
            // Hata GİZLENMEZ. "Maçı yok" ile "veri alınamadı" farklı şeyler.
            <View style={st.merkez}>
              <Text style={st.hataBaslik}>Fikstür alınamadı</Text>
              <Text style={st.hataTxt}>{hata}</Text>
            </View>
          ) : !fikstur.length ? (
            <View style={st.merkez}>
              <Text style={st.hataTxt}>Bu takım için sezon maçı bulunamadı.</Text>
            </View>
          ) : (
            <ScrollView
              ref={kaydirmaRef}
              contentContainerStyle={{ paddingBottom: spacing.xl }}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => {
                // Sıradaki maçı görünür yap: kullanıcı fikstürü açtığında
                // sezonun başındaki eski maçlara değil, buraya bakmak ister.
                if (ayracYRef.current > 0) {
                  kaydirmaRef.current?.scrollTo({ y: Math.max(0, ayracYRef.current - 60), animated: false });
                }
              }}
            >
              {fikstur.map((f, i) => (
                <View
                  key={`${f.footyMatchId ?? i}`}
                  onLayout={i === ilkGelecek ? (e) => { ayracYRef.current = e.nativeEvent.layout.y; } : undefined}
                >
                  {i === ilkGelecek ? (
                    <View style={st.ayrac}>
                      <View style={st.ayracCizgi} />
                      <Text style={st.ayracTxt}>SIRADAKİ</Text>
                      <View style={st.ayracCizgi} />
                    </View>
                  ) : null}
                  <SatirMac f={f} ligYaz={ligler.length > 1} />
                </View>
              ))}

              {/* KAPSAM NOTU — hangi turnuvaların dahil olduğu YAZILIR.
                  Liste dolu göründüğü için, kupa/Avrupa maçlarının eksik
                  olduğu ancak burada anlaşılır. Sessiz eksik, yanlış bilgiden
                  daha tehlikelidir. */}
              {ligler.length ? (
                <Text style={st.kapsam}>
                  Kapsam: {ligler.join(' · ')}
                </Text>
              ) : null}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    maxHeight: '86%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  ad: { color: colors.text, fontSize: 16, fontWeight: '900' },
  alt: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  kapat: { color: colors.textMuted, fontSize: 18, fontWeight: '900', paddingHorizontal: 4 },

  merkez: { padding: spacing.xl, alignItems: 'center', gap: 6 },
  hataBaslik: { color: colors.text, fontSize: 14, fontWeight: '900' },
  hataTxt: { color: colors.textMuted, fontSize: 12.5, textAlign: 'center' },

  satir: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 9, paddingHorizontal: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  satirGelecek: { backgroundColor: colors.bgAlt },
  solSutun: { width: 76 },
  tarih: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  ligTxt: { color: colors.textMuted, fontSize: 9, fontWeight: '700', marginTop: 1, opacity: 0.8 },
  kapsam: {
    color: colors.textMuted, fontSize: 10.5, fontWeight: '700',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, textAlign: 'center',
  },
  orta: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  takim: { flex: 1, color: colors.text, fontSize: 12.5, fontWeight: '600' },
  takimSag: { textAlign: 'right' },
  takimBiz: { fontWeight: '900' },        // kartı açılan takım kalın
  skor: { width: 46, textAlign: 'center', color: colors.text, fontSize: 12.5, fontWeight: '900' },
  skorYok: { width: 46, textAlign: 'center', color: colors.textMuted, fontSize: 11, fontWeight: '700' },

  rozet: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  rozetTxt: { color: '#fff', fontSize: 10, fontWeight: '900' },
  rozetBos: { width: 20, marginLeft: 8 },

  ayrac: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.lg, paddingVertical: 8 },
  ayracCizgi: { flex: 1, height: 1, backgroundColor: colors.border },
  ayracTxt: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
});
