// KALICI OTURUM DEPOSU — platforma göre EN GÜVENLİ yer seçilir:
//
//   • Android / iOS : expo-secure-store → Android Keystore / iOS Keychain.
//                     Belirteçler cihazın donanım destekli güvenli alanında durur.
//   • Web           : üretimde HttpOnly çerez (sunucu yönetir; JS okuyamaz),
//                     geliştirmede localStorage (yalnız kendi makinen).
//
// ŞİFRE HİÇBİR ZAMAN CİHAZDA SAKLANMAZ — yalnız belirteçler saklanır.
//
// ANAHTAR ADLARI: 'sportoto.token' adı KORUNUR (mevcut kurulumlar bu adla
// kayıtlı). Mobilde tek seferlik göç yapılır: AsyncStorage'daki eski belirteç
// SecureStore'a taşınır ve düz depodan SİLİNİR.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { API_BASE } from '../config';

const KEY_TOKEN = 'sportoto.token';        // AD DEĞİŞMEZ (mevcut veriyle uyum)
const KEY_REFRESH = 'sportoto.refresh';    // yeni: yenileme anahtarı
const KEY_SESSION = 'sportoto.session';    // yeni: oturum kimliği
const KEY_DEVICE = 'sportoto.device';      // yeni: kalıcı cihaz kimliği (rastgele)

const isWeb = Platform.OS === 'web';

// SecureStore anahtarları yalnız [A-Za-z0-9._-] içerebilir — mevcut adlar uygun.
async function secureGet(k) { try { return await SecureStore.getItemAsync(k); } catch { return null; } }
async function secureSet(k, v) { try { if (v) await SecureStore.setItemAsync(k, v); else await SecureStore.deleteItemAsync(k); } catch { /* okuma tarafı null görür */ } }

function webGet(k) { try { return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null; } catch { return null; } }
function webSet(k, v) { try { if (typeof localStorage === 'undefined') return; if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch {} }

async function get(k) { return isWeb ? webGet(k) : secureGet(k); }
async function set(k, v) { return isWeb ? webSet(k, v) : secureSet(k, v); }

/**
 * Web'de ÇEREZ MODU: sayfa ile API aynı origin'deyse (üretimde backend web
 * derlemesini kendisi sunar) belirteçler HttpOnly çerezle taşınır — localStorage'a
 * hiç yazılmaz (XSS bir şey çalamaz). Geliştirmede (farklı port) Bearer kullanılır.
 */
export function cookieModeAvailable() {
  if (!isWeb || typeof location === 'undefined') return false;
  if (!API_BASE) return true; // boş taban = aynı origin (yayın web derlemesi)
  try { return new URL(API_BASE).origin === location.origin; } catch { return false; }
}

/** Mobil: eski AsyncStorage belirtecini SecureStore'a tek seferlik taşır. */
async function migrateLegacyToken() {
  if (isWeb) return;
  try {
    const inSecure = await secureGet(KEY_TOKEN);
    if (inSecure) return;
    const legacy = await AsyncStorage.getItem(KEY_TOKEN);
    if (legacy) {
      await secureSet(KEY_TOKEN, legacy);
      await AsyncStorage.removeItem(KEY_TOKEN); // düz metin depoda İZ KALMAZ
    }
  } catch { /* göç başarısızsa kullanıcı yalnızca yeniden giriş yapar */ }
}

/** Uygulama açılışında kalıcı oturumu yükler. */
export async function loadPersisted() {
  await migrateLegacyToken();
  const [token, refreshToken, sessionId] = await Promise.all([
    get(KEY_TOKEN), get(KEY_REFRESH), get(KEY_SESSION),
  ]);
  return { token, refreshToken, sessionId };
}

/** Oturumu kalıcılaştırır. Çerez modunda belirteçler DEPOLANMAZ (çerezdedir). */
export async function persistSession({ token, refreshToken, sessionId, cookieMode }) {
  if (cookieMode) {
    await Promise.all([set(KEY_TOKEN, null), set(KEY_REFRESH, null), set(KEY_SESSION, sessionId || null)]);
    return;
  }
  await Promise.all([
    set(KEY_TOKEN, token || null),
    set(KEY_REFRESH, refreshToken || null),
    set(KEY_SESSION, sessionId || null),
  ]);
}

export async function clearPersisted() {
  await Promise.all([set(KEY_TOKEN, null), set(KEY_REFRESH, null), set(KEY_SESSION, null)]);
}

/** Kalıcı, rastgele cihaz kimliği (kişisel veri DEĞİLDİR; cihaz listesi için). */
export async function getOrCreateDeviceId() {
  let id = await get(KEY_DEVICE);
  if (!id) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    await set(KEY_DEVICE, id);
  }
  return id;
}

/** Cihaz listesinde görünecek ad — kişisel veri içermez. */
export function deviceLabel() {
  if (isWeb) {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Tarayıcı';
    return `Web · ${browser}`;
  }
  return Platform.OS === 'android' ? 'Android' : Platform.OS === 'ios' ? 'iPhone/iPad' : Platform.OS;
}

export function platformName() { return Platform.OS; }
