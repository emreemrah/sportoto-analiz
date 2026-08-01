// Mobil uygulama SADECE kendi backend'ine bağlanır (FootyStats'e asla doğrudan).
//
// API_BASE = backend sunucunun adresi. Çözümleme mantığı saf modülde:
// src/apiBase.js (RN bağımlılığı yok → testlerde doğrudan çalışır).
//
// • Web'de test (npm run web): tarayıcı bu bilgisayarda olduğu için localhost.
// • Telefonda test: bilgisayarınla aynı Wi-Fi'da olmalı; apiBase.js içindeki
//   DEV_LAN_IP doğru olmalı. IP değişirse (router yeniden başlarsa) güncelle.
//   PC'nin IP'sini öğrenmek için: bilgisayarda "ipconfig" → IPv4 adresi.
//
// YAYIN GÜVENLİĞİ: Yayın derlemesinde localhost / LAN IP / şifresiz http
// adresi KULLANILMAZ; yanlış yapılandırma sessizce yerele düşmez, açık hata
// verir. Ayrıntı: src/apiBase.js.
import { Platform } from 'react-native';
import { resolveApiBase } from './apiBase';

const IS_DEV = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

export const API_BASE = resolveApiBase({
  envBase: process.env.EXPO_PUBLIC_API_BASE,
  isDev: IS_DEV,
  platform: Platform.OS,
});

// DEMO MODU — tek kaynak artık src/demoGate.js (RN bağımlılığı yok, bu yüzden
// servisler ve testler doğrudan oradan sorabiliyor). Buradan yeniden dışa
// aktarılması yalnız geriye uyumluluk içindir; kural ve gerekçe demoGate.js'te.
export { DEMO_MODE } from './demoGate';
