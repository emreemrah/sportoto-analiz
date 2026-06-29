// Mobil uygulama SADECE kendi backend'ine bağlanır (FootyStats'e asla doğrudan).
//
// API_BASE = backend sunucunun adresi.
// • Web'de test (npm run web): tarayıcı bu bilgisayarda olduğu için localhost.
// • Telefonda test: bilgisayarınla aynı Wi-Fi'da olmalı; aşağıdaki LAN_IP doğru olmalı.
//   IP değişirse (router yeniden başlarsa) LAN_IP'yi güncelle.
//   PC'nin IP'sini öğrenmek için: bilgisayarda "ipconfig" → IPv4 adresi.
import { Platform } from 'react-native';

const LAN_IP = '192.168.1.100'; // telefon testinde PC'nin IP'si
const HOST = Platform.OS === 'web' ? 'localhost' : LAN_IP;

// API_BASE önceliği:
//  1) EXPO_PUBLIC_API_BASE doluysa onu kullan (tünel/paylaşım: tam adres).
//  2) Üretim web build'i (expo export → __DEV__ false) ise aynı origin (göreli ''):
//     Render'da web + API tek adresten servis edilir, ekstra ayar gerekmez.
//  3) Aksi halde yerel geliştirme (localhost/LAN:4000).
const ENV_BASE = process.env.EXPO_PUBLIC_API_BASE;
let resolvedBase;
if (ENV_BASE) {
  resolvedBase = ENV_BASE;
} else if (Platform.OS === 'web' && typeof __DEV__ !== 'undefined' && !__DEV__) {
  resolvedBase = '';
} else {
  resolvedBase = `http://${HOST}:4000`;
}
export const API_BASE = resolvedBase;
