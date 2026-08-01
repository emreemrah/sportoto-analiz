// ---------------------------------------------------------------------------
// İNCELEME EKRANI — yalnız operatör (E9 / Google Play üçüncü şart)
// ---------------------------------------------------------------------------
// Topluluk Kuralları sayfası "her bildirim elle incelenir" diye söz veriyor.
// Bu ekran, o sözü tutmanın yeridir: bekleyen bildirimleri listeler, yorumu
// GİZLE / GERİ AL, bildirimi YOK SAY.
//
// ═══ YETKİ UYGULAMADA DEĞİL, SUNUCUDA ═══
// Bu dosyada hiçbir e-posta, kullanıcı adı veya kimlik YAZILI DEĞİLDİR. Ekran
// açılırken `api.moderationAccess()` sorulur ve karar sunucudan gelir. Yetki
// listesi `backend/.env` içindedir; uygulamanın paketine hiç girmez — Android
// paketi açılıp okunabilir bir dosyadır, oraya yazılan her şey herkese açıktır.
//
// Yetkisiz hesap buraya normalde HİÇ GELMEZ (Profil'deki giriş de aynı cevaba
// bağlıdır). Yine de gelirse ham bir 403 hatası değil, sade bir bilgi görür.
//
// ═══ GİZLİLİK ═══
// Sunucu bildiren kişinin kimliğini döndürmez; bu ekran da öyle bir alan
// okumaz. Operatör kararı verirken yorumun METNİNE, sebeplere ve nota bakar —
// kimin bildirdiğine değil.
//
// ═══ DÜRÜSTLÜK ═══
// Sayılar olduğu gibi yazılır. Silinmiş yoruma ait bildirimler ve listenin
// kesildiği durum ayrıca söylenir; "hepsi bu" izlenimi verilmez.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { colors, spacing, radius } from '../theme';
import ScreenBackdrop from '../components/ScreenBackdrop';
import { api } from '../api';
import { sebepEtiketi } from '../moderationReasons';
import {
  ozetSatirlari, sebepOzeti, gizlemeDurumu, eylemler, tarihKisa, bildirimOzeti,
} from '../moderationView';

const ROZET_RENGI = { kirmizi: colors.red, turuncu: colors.orange, yesil: colors.green };

function Rozet({ durum }) {
  const renk = ROZET_RENGI[durum.renk] || colors.muted;
  return (
    <View style={[styles.rozet, { borderColor: renk }]}>
      <Text style={[styles.rozetTxt, { color: renk }]}>{durum.etiket}</Text>
    </View>
  );
}

export default function ModerationScreen() {
  const [yetki, setYetki] = useState(null);      // null = bilinmiyor, {operator, sebep}
  const [veri, setVeri] = useState(null);
  const [hata, setHata] = useState(null);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [mesgul, setMesgul] = useState(null);     // 'yorum:12' | 'bildirim:5'
  const [onay, setOnay] = useState(null);         // yok sayma onayı bekleyen bildirim

  const yukle = useCallback(async () => {
    setHata(null);
    try {
      const erisim = await api.moderationAccess();
      setYetki(erisim);
      // Yetki yoksa liste ucu HİÇ çağrılmaz: reddedilecek bir isteği yollamak,
      // sunucu kayıtlarını gereksiz 403'lerle doldurmaktan başka işe yaramaz.
      if (!erisim?.operator) { setVeri(null); return; }
      setVeri(await api.moderationReports());
    } catch (e) {
      setHata(e.message);
    }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  const yenile = async () => { setYenileniyor(true); await yukle(); setYenileniyor(false); };

  // Her işlemden sonra liste YENİDEN OKUNUR. Ekranı yerel olarak güncellemek
  // daha hızlı görünürdü ama yanıltıcı olurdu: bir bildirimi yok saymak, eşiğin
  // altına düşen BAŞKA bir yorumu da görünür yapabilir. Doğru olan, sunucunun
  // yeni durumunu göstermektir.
  const islet = async (anahtar, calistir) => {
    setMesgul(anahtar); setHata(null); setOnay(null);
    try { await calistir(); await yukle(); }
    catch (e) { setHata(e.message); }
    finally { setMesgul(null); }
  };

  const gizle = (id) => islet(`yorum:${id}`, () => api.hideComment(id));
  const geriAl = (id) => islet(`yorum:${id}`, () => api.unhideComment(id));
  const yokSay = (id) => islet(`bildirim:${id}`, () => api.dismissReport(id));

  const items = veri?.items || [];

  return (
    <ScreenBackdrop>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl * 2 }}
        refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={yenile} tintColor={colors.primary} />}
      >
        <Text style={styles.baslik}>İnceleme</Text>
        <Text style={styles.yardim}>
          Bildirilen yorumlar burada elle incelenir. Kararın herkesi etkiler: gizlenen yorumu
          yazarı dışında kimse göremez. Bildirimi yapan kişinin kimliği bu ekranda gösterilmez.
        </Text>

        {hata && <Text style={styles.hata}>{hata}</Text>}

        {yetki === null && !hata && (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.lg }} />
        )}

        {yetki && !yetki.operator && (
          <View style={styles.bilgiKutu}>
            <Text style={styles.bilgiBaslik}>Bu ekran inceleme yetkisi ister.</Text>
            <Text style={styles.bilgi}>
              {yetki.sebep === 'eposta-dogrulanmamis'
                ? 'Hesabın listede görünüyor ama e-posta adresin henüz doğrulanmamış. Doğruladıktan sonra bu ekran açılır.'
                : 'Hesabında inceleme yetkisi yok. Yorumları bildirme ve kullanıcı engelleme yolları herkese açıktır.'}
            </Text>
          </View>
        )}

        {yetki?.operator && veri === null && !hata && (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.lg }} />
        )}

        {yetki?.operator && veri && (
          <View style={styles.ozetKutu}>
            {ozetSatirlari(veri).map((s) => (
              <Text key={s} style={styles.ozet}>{s}</Text>
            ))}
          </View>
        )}

        {items.map((item) => {
          const durum = gizlemeDurumu(item);
          const yorumMesgul = mesgul === `yorum:${item.commentId}`;
          return (
            <View key={String(item.commentId)} style={styles.kart}>
              <View style={styles.ustSatir}>
                <Rozet durum={durum} />
                <Text style={styles.sayac}>{bildirimOzeti(item)}</Text>
              </View>

              <Text style={styles.yazar} numberOfLines={1}>{item.author?.username}</Text>
              <Text style={styles.meta}>
                Yorum: {tarihKisa(item.createdAt)}
                {item.matchId ? `  ·  Maç: ${item.matchId}` : ''}
              </Text>

              {/* Yorum metni KISALTILMAZ: karar metnin tamamına bakılarak verilir. */}
              <View style={styles.metinKutu}>
                <Text style={styles.metin}>{item.text}</Text>
              </View>

              {sebepOzeti(item.reasons) ? (
                <Text style={styles.sebepler}>{sebepOzeti(item.reasons)}</Text>
              ) : null}

              {/* Bildirimler — tek tek yok sayılabilir. Notlar, bildiren kişiyi
                  değil bildirimin GEREKÇESİNİ taşır. */}
              {(item.reports || []).map((r) => {
                const bildirimMesgul = mesgul === `bildirim:${r.id}`;
                const onaydaMi = onay === r.id;
                return (
                  <View key={String(r.id)} style={styles.bildirim}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bildirimBaslik}>
                        {sebepEtiketi(r.reason)}  ·  {tarihKisa(r.createdAt)}
                      </Text>
                      {r.note ? <Text style={styles.not}>“{r.note}”</Text> : null}
                    </View>
                    {onaydaMi ? (
                      <View style={styles.onayGrup}>
                        <TouchableOpacity
                          style={[styles.kucukDugme, styles.kucukTehlike]}
                          onPress={() => yokSay(r.id)}
                          disabled={bildirimMesgul}
                        >
                          <Text style={styles.kucukTehlikeTxt}>Evet, yok say</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.kucukDugme} onPress={() => setOnay(null)}>
                          <Text style={styles.kucukTxt}>Vazgeç</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.kucukDugme}
                        onPress={() => setOnay(r.id)}
                        disabled={bildirimMesgul}
                      >
                        {bildirimMesgul
                          ? <ActivityIndicator size="small" color={colors.primary} />
                          : <Text style={styles.kucukTxt}>Yok say</Text>}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              {/* Yok sayma geri alınamaz; onay bu yüzden istenir. */}
              {onay != null && (item.reports || []).some((r) => r.id === onay) && (
                <Text style={styles.onayNot}>
                  Yok sayılan bildirim listeden kalıcı olarak düşer; bu adım geri alınamaz.
                </Text>
              )}

              <View style={styles.eylemSatiri}>
                {eylemler(item).map((e) => (
                  <TouchableOpacity
                    key={e.key}
                    style={[styles.dugme, e.tehlike ? styles.dugmeTehlike : styles.dugmeSakin]}
                    onPress={() => (e.key === 'hide' ? gizle(item.commentId) : geriAl(item.commentId))}
                    disabled={yorumMesgul}
                  >
                    {yorumMesgul
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Text style={e.tehlike ? styles.dugmeTehlikeTxt : styles.dugmeSakinTxt}>{e.label}</Text>}
                  </TouchableOpacity>
                ))}
              </View>
              {/* Her düğmenin ne yaptığı ALTINDA yazar: "Gizli Kalsın" adı
                  tek başına, kararın mühürlendiğini anlatmaz. */}
              {eylemler(item).map((e) => (
                <Text key={`not-${e.key}`} style={styles.eylemNot}>{e.label}: {e.aciklama}</Text>
              ))}
            </View>
          );
        })}

        {yetki?.operator && veri && items.length === 0 && (
          <Text style={styles.bosNot}>
            Şu an incelenmeyi bekleyen yorum yok. Yeni bir bildirim geldiğinde burada görünür.
          </Text>
        )}
      </ScrollView>
    </ScreenBackdrop>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  baslik: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 6 },
  yardim: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18, marginBottom: spacing.md },
  hata: { color: colors.red, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm },
  bilgiKutu: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm,
  },
  bilgiBaslik: { color: colors.text, fontSize: 14.5, fontWeight: '800', marginBottom: 6 },
  bilgi: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  ozetKutu: {
    backgroundColor: colors.cardAlt, borderRadius: radius.sm,
    padding: spacing.md, marginBottom: spacing.md,
  },
  ozet: { color: colors.text, fontSize: 12.5, lineHeight: 18 },
  kart: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md,
  },
  ustSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rozet: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  rozetTxt: { fontSize: 11, fontWeight: '800' },
  sayac: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700' },
  yazar: { color: colors.text, fontSize: 14.5, fontWeight: '800', marginTop: 10 },
  meta: { color: colors.textMuted, fontSize: 11.5, marginTop: 3 },
  metinKutu: {
    backgroundColor: colors.bgAlt, borderRadius: radius.sm, borderWidth: 1,
    borderColor: colors.border, padding: spacing.sm, marginTop: 8,
  },
  metin: { color: colors.text, fontSize: 13.5, lineHeight: 20 },
  sebepler: { color: colors.orange, fontSize: 12, fontWeight: '700', marginTop: 8 },
  bildirim: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 8,
  },
  bildirimBaslik: { color: colors.text, fontSize: 12.5, fontWeight: '700' },
  not: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  onayGrup: { flexDirection: 'row', gap: 6 },
  kucukDugme: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 9, paddingVertical: 6,
  },
  kucukTxt: { color: colors.textSoft, fontSize: 11.5, fontWeight: '800' },
  kucukTehlike: { borderColor: colors.red },
  kucukTehlikeTxt: { color: colors.red, fontSize: 11.5, fontWeight: '800' },
  onayNot: { color: colors.red, fontSize: 11.5, lineHeight: 17, marginTop: 8 },
  eylemSatiri: { flexDirection: 'row', gap: 8, marginTop: spacing.md, flexWrap: 'wrap' },
  dugme: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 9 },
  dugmeTehlike: { borderColor: colors.red, backgroundColor: colors.dangerSoft },
  dugmeTehlikeTxt: { color: colors.red, fontSize: 12.5, fontWeight: '800' },
  dugmeSakin: { borderColor: colors.primary },
  dugmeSakinTxt: { color: colors.primary, fontSize: 12.5, fontWeight: '800' },
  eylemNot: { color: colors.textMuted, fontSize: 11.5, lineHeight: 17, marginTop: 6 },
  bosNot: {
    color: colors.textMuted, fontSize: 12.5, lineHeight: 18,
    textAlign: 'center', marginTop: spacing.lg,
  },
});
