// HAKKINDA — marka, sürüm, telif, bağımsızlık bildirimi ve yasal bağlantılar.
//
// Buradaki metinlerin hiçbiri elle yazılmaz; hepsi src/brand.js'ten okunur.
// Kurum/operatör logosu, amblemi veya başka uygulamanın simgesi KULLANILMAZ.
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { uyari } from '../components/Uyari';
import { colors, spacing, radius } from '../theme';
import ScreenBackdrop from '../components/ScreenBackdrop';
import { API_BASE } from '../config';
import {
  APP_NAME,
  APP_TAGLINE,
  APP_VERSION,
  COPYRIGHT,
  INDEPENDENCE_NOTICE,
  NO_GUARANTEE_NOTICE,
  OFFICIAL_RESULT_NOTICE,
  legalUrls,
} from '../brand';

function Card({ title, children }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export default function AboutScreen({ navigation }) {
  const links = legalUrls(API_BASE);

  const open = async (url, ad) => {
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) throw new Error('açılamadı');
      await Linking.openURL(url);
    } catch {
      uyari.alert(ad, `Sayfa açılamadı. Tarayıcından şu adresi ziyaret edebilirsin:\n\n${url}`);
    }
  };

  return (
    <ScreenBackdrop>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl * 2 }}
      >
        <Text style={styles.appName}>{APP_NAME}</Text>
        <Text style={styles.version}>Sürüm {APP_VERSION}</Text>
        <Text style={styles.tagline}>{APP_TAGLINE}</Text>

        <Card title="Bağımsızlık">
          <Text style={styles.body}>{INDEPENDENCE_NOTICE}</Text>
          <Text style={styles.body}>
            Uygulamada kullanılan simge, renk ve görsellerin tamamı bu uygulamaya özgüdür.
            Hiçbir kurumun logosu veya amblemi kullanılmaz.
          </Text>
        </Card>

        <Card title="Analiz dürüstlüğü">
          <Text style={styles.body}>{NO_GUARANTEE_NOTICE}</Text>
          <Text style={styles.body}>{OFFICIAL_RESULT_NOTICE}</Text>
          <Text style={styles.body}>
            Analizler, oynanma yüzdeleri ve oran hareketleri yalnızca karar desteğidir; kesin
            sonuç değildir. Veri eksikse "veri yok" yazılır, tahmin uydurulmaz.
          </Text>
        </Card>

        <Card title="Bahis ve ödeme">
          <Text style={styles.body}>
            Bu uygulama bahis veya şans oyunu hizmeti değildir. Bahis oynatmaz, para kabul
            etmez, ödeme almaz; herhangi bir operatöre üyelik, para yatırma veya oyun
            yönlendirmesi yapmaz.
          </Text>
        </Card>

        <Card title="Yasal">
          <TouchableOpacity style={styles.linkBtn} onPress={() => open(links.privacy, 'Gizlilik Politikası')}>
            <Text style={styles.linkTxt}>🔒  Gizlilik Politikası</Text>
          </TouchableOpacity>
          {/* Topluluk Kuralları: yorum yazan herkesi bağlar. Bildirme ve
              engelleme yolları uygulamanın içinde; kuralların kendisi ise
              uygulama kurulmadan da açılabilen bir sayfada durur. */}
          <TouchableOpacity style={styles.linkBtn} onPress={() => open(links.rules, 'Topluluk Kuralları')}>
            <Text style={styles.linkTxt}>📋  Topluluk Kuralları</Text>
          </TouchableOpacity>
          {/* Sorumlu Oyun sayfası: kazanç garantisi olmadığı beyanı. Mağaza
              incelemesi için uygulama dışından da açılabilir bir sayfadır
              (backend/legal/sorumlu-oyun.html).
              Destek hattı numarası bağlantı METNİNDEN kaldırıldı (kullanıcı
              kararı, 2 Ağustos 2026); sayfanın kendisi yerinde duruyor. */}
          <TouchableOpacity style={styles.linkBtn} onPress={() => open(links.responsibleGaming, 'Sorumlu Oyun')}>
            <Text style={styles.linkTxt}>🛟  Sorumlu Oyun</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('DeleteAccount')}>
            <Text style={styles.linkTxt}>🗑️  Hesabımı Sil</Text>
          </TouchableOpacity>
          <Text style={styles.small}>
            Hesabını uygulamayı kurmadan da silebilirsin: {links.deleteAccount}
          </Text>
        </Card>

        <Text style={styles.copyright}>{COPYRIGHT}</Text>
      </ScrollView>
    </ScreenBackdrop>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  appName: { color: colors.text, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  version: { color: colors.textMuted, fontSize: 12.5, textAlign: 'center', marginTop: 4 },
  tagline: {
    color: colors.textMuted, fontSize: 14, textAlign: 'center',
    lineHeight: 20, marginTop: 12, marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: 8 },
  body: { color: colors.textMuted, fontSize: 13.5, lineHeight: 20, marginBottom: 8 },
  small: { color: colors.textMuted, fontSize: 11.5, lineHeight: 17, marginTop: 8 },
  linkBtn: {
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: radius.sm,
    backgroundColor: colors.cardAlt, marginBottom: 8,
  },
  linkTxt: { color: colors.text, fontSize: 14, fontWeight: '700' },
  copyright: {
    color: colors.textMuted, fontSize: 12, textAlign: 'center',
    marginTop: spacing.lg, marginBottom: spacing.md,
  },
});
