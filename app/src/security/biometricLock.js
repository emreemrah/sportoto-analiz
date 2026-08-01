// BİYOMETRİK KİLİT — cihaz sarmalayıcısı (expo-local-authentication).
// Saf karar mantığı bioLockPolicy.js'tedir; burada yalnız cihaz erişimi var.
//
//   • Doğrulamayı cihazın güvenli sistemi (Keystore/Secure Enclave) yapar;
//     uygulamaya biyometrik VERİ değil, yalnız SONUÇ döner.
//   • Tercih anahtarı: 'sportoto.bioLock' — mobilde SecureStore'da tutulur.
//   • Web'de özellik tümüyle kapalıdır (canOfferBiometrics=false).
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { canOfferBiometrics, shouldLockOnLaunch, outcomeFromResult } from './bioLockPolicy';

const KEY_BIOLOCK = 'sportoto.bioLock';
const isWeb = Platform.OS === 'web';

// ---------------------------------------------------------------------------
// Tercih (kullanıcı kilidi açtı mı?)
// ---------------------------------------------------------------------------
export async function isBioLockEnabled() {
  if (isWeb) return false;
  try { return (await SecureStore.getItemAsync(KEY_BIOLOCK)) === '1'; } catch { return false; }
}

export async function setBioLockEnabled(on) {
  if (isWeb) return;
  try {
    if (on) await SecureStore.setItemAsync(KEY_BIOLOCK, '1');
    else await SecureStore.deleteItemAsync(KEY_BIOLOCK);
  } catch { /* tercih yazılamazsa kilit kapalı kalır (güvenli varsayılan: erişim kaybettirmez) */ }
}

// ---------------------------------------------------------------------------
// Cihaz yeteneği
// ---------------------------------------------------------------------------
export async function biometricsSupported() {
  if (isWeb) return false;
  try {
    const [hasHardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return canOfferBiometrics({ platform: Platform.OS, hasHardware, enrolled });
  } catch { return false; }
}

/** Açılışta kilit gerekli mi? (girişli + tercih açık + cihaz destekli) */
export async function needsLockOnLaunch(loggedIn) {
  if (isWeb || !loggedIn) return false;
  const [enabled, supported] = await Promise.all([isBioLockEnabled(), biometricsSupported()]);
  return shouldLockOnLaunch({ loggedIn, enabled, supported });
}

/**
 * Cihazın biyometrik doğrulamasını başlatır → 'unlocked' | 'locked'.
 * disableDeviceFallback=false: cihaz PIN'i de güvenli alternatif olarak kalır.
 */
export async function authenticate() {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Uygulama kilidini aç',
      cancelLabel: 'Vazgeç',
      disableDeviceFallback: false,
    });
    return outcomeFromResult(result);
  } catch {
    return 'locked'; // cihaz hatasında kilit AÇILMAZ (güvenli taraf)
  }
}
