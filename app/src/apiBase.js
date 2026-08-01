// API ADRESİ ÇÖZÜMLEME — saf mantık, React Native bağımlılığı YOKTUR
// (bu yüzden düz Node testlerinde doğrudan çalıştırılabilir).
//
// YAYIN GÜVENLİĞİ (KESİN KURAL)
// Yayın (release) derlemesinde localhost / LAN IP / şifresiz http adresi
// KULLANILMAZ. Kişisel veri yalnız HTTPS üzerinden taşınır. Yanlış
// yapılandırma sessizce yerel adrese düşmez; açık hata verir.

export const DEV_LAN_IP = '192.168.1.100'; // telefon testinde PC'nin IP'si
export const DEV_PORT = 4000;

// Yayında yasak adres kalıpları: localhost, loopback ve özel ağ blokları.
const FORBIDDEN_IN_RELEASE =
  /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i;

export function resolveApiBase({ envBase = '', isDev = false, platform = 'web' } = {}) {
  const env = String(envBase || '').trim();

  // 1) Geliştirme: eski davranış aynen korunur (yerel / LAN / tünel).
  if (isDev) {
    return env || `http://${platform === 'web' ? 'localhost' : DEV_LAN_IP}:${DEV_PORT}`;
  }

  // 2) Yayın + adres verilmemiş.
  if (!env) {
    // Web'de aynı origin geçerlidir: sayfa HTTPS ise istekler de HTTPS olur.
    if (platform === 'web') return '';
    throw new Error(
      'YAPILANDIRMA HATASI: Yayın derlemesi için EXPO_PUBLIC_API_BASE tanımlanmalıdır ' +
        '(https:// ile başlayan gerçek sunucu adresi). Yerel adrese düşülmez.',
    );
  }

  // 3) Yayın + adres verilmiş: yerel/şifresiz adreslere izin verilmez.
  if (FORBIDDEN_IN_RELEASE.test(env)) {
    throw new Error(
      `YAPILANDIRMA HATASI: Yayın derlemesinde yerel adres kullanılamaz (${env}). ` +
        'https:// ile başlayan gerçek sunucu adresi gereklidir.',
    );
  }
  if (!/^https:\/\//i.test(env)) {
    throw new Error(
      `YAPILANDIRMA HATASI: Yayın derlemesinde API adresi HTTPS olmalıdır (${env}). ` +
        'Kişisel veri şifresiz bağlantı üzerinden taşınmaz.',
    );
  }
  return env.replace(/\/+$/, '');
}
