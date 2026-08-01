// ORTAK UYARI / ONAY PENCERESİ — her platformda GERÇEKTEN görünür.
//
// NEDEN VAR: React Native'in `Alert.alert`'i web'de ÇALIŞMAZ. react-native-web
// paketi onu boş gövdeli bir taslak olarak yayınlar:
//     class Alert { static alert() {} }
// Yani web sürümünde "Sil" düğmesine basılınca pencere açılmaz, onay düğmesinin
// `onPress`'i hiç çağrılmaz ve kupon SESSİZCE silinmez. Kullanıcı düğmeye basar,
// hiçbir şey olmaz, sebebini de göremez.
//
// PROJE İLKESİ: "SEBEPSİZ KAPALI DÜĞME, SESSİZ DÜĞMEDEN BETERDİR." Sessiz düğme
// bu yüzden kabul edilemez; düğme ya işini yapar ya da NEDEN yapmadığını yazar.
//
// KURAL: Uygulama kodunda doğrudan `Alert.alert` KULLANILMAZ; bunun yerine
// buradaki `uyari.alert(...)` çağrılır. İmza React Native'inkiyle AYNIDIR:
//     uyari.alert(baslik, mesaj?, dugmeler?, secenekler?)
//     dugmeler: [{ text, onPress?, style?: 'cancel' | 'destructive' | 'default' }]
//
// DAVRANIŞ:
//   • Telefon (iOS/Android) → işletim sisteminin kendi penceresi (Alert.alert).
//   • Web → aşağıdaki <UyariHost /> uygulama kökünde bir Modal çizer.
//   • Host bağlı değilse → tarayıcının kendi confirm/alert'i (yedek yol).
// Karar mantığı uyariKuyruk.js'te; burada yalnız ÇİZİM vardır.
import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Platform, Alert as RNAlert } from 'react-native';
import { colors } from '../theme';
import { aboneOl, kapat as kuyruktanKapat, webUyari } from './uyariKuyruk';

const web = Platform.OS === 'web';

export const uyari = {
  alert(baslik, mesaj, dugmeler, secenekler) {
    if (!web) { RNAlert.alert(baslik, mesaj, dugmeler, secenekler); return; }
    webUyari(baslik, mesaj, dugmeler, secenekler);
  },
};

/**
 * Uygulama kökünde BİR KEZ çizilir (App.js). Web'de pencereyi asıl çizen budur;
 * telefonda hiçbir şey çizmez (orada işletim sisteminin penceresi kullanılır).
 */
export function UyariHost() {
  const [liste, setListe] = useState([]);
  useEffect(() => {
    if (!web) return undefined;
    return aboneOl((l) => setListe(l));
  }, []);

  if (!web) return null;
  const aktif = liste[0];
  if (!aktif) return null;

  const kapaniyor = () => { if (aktif.kapatilabilir) kuyruktanKapat(aktif.id); };
  const bas = (b) => { kuyruktanKapat(aktif.id); b.onPress?.(); };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={kapaniyor}>
      <View style={st.perde} testID="uyari-perde">
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={kapaniyor} />
        <View style={st.kutu} accessibilityViewIsModal accessibilityRole="alert" testID="uyari-kutu">
          {!!aktif.baslik && <Text style={st.baslik}>{aktif.baslik}</Text>}
          {!!aktif.mesaj && <Text style={st.mesaj}>{aktif.mesaj}</Text>}
          <View style={st.serit}>
            {aktif.dugmeler.map((b, i) => (
              <TouchableOpacity
                key={`${b.text}-${i}`}
                style={[st.dugme, b.style === 'destructive' && st.dugmeKotu, b.style === 'cancel' && st.dugmeSade]}
                onPress={() => bas(b)}
                accessibilityRole="button"
                testID={`uyari-dugme-${i}`}
              >
                <Text style={[st.dugmeYazi, b.style === 'cancel' && st.dugmeYaziSade]}>{b.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  perde: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7,19,41,0.55)', padding: 22 },
  kutu: { width: '100%', maxWidth: 380, backgroundColor: colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: colors.border },
  baslik: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 6 },
  mesaj: { fontSize: 13.5, lineHeight: 20, color: colors.textSoft },
  serit: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  dugme: { paddingVertical: 9, paddingHorizontal: 15, borderRadius: 9, backgroundColor: colors.primary },
  dugmeKotu: { backgroundColor: colors.danger },
  dugmeSade: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  dugmeYazi: { color: colors.white, fontWeight: '800', fontSize: 13 },
  dugmeYaziSade: { color: colors.textSoft },
});

export default uyari;
