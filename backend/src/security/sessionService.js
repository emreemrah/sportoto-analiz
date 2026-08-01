// OTURUM SERVİSİ — süreli, yenilenebilir, uzaktan iptal edilebilir oturumlar.
//
// MODEL
//   • Kimlik Supabase Auth'tadır: kısa ömürlü erişim belirteci (JWT) + tek
//     kullanımlık dönen (rotasyonlu) yenileme anahtarı Supabase üretir.
//   • Her giriş burada bir OTURUM SATIRI açar (sessions) ve cihaza bağlanır
//     (devices). İstemci her istekte oturum kimliğini (X-Session-Id) gönderir.
//   • Yenileme ve korumalı istekler, oturum satırı İPTAL EDİLMEMİŞSE çalışır.
//     Böylece "cihazdan çıkış", "tüm oturumları kapat" ve "şifre değişince
//     diğerlerini kapat" SUNUCUDA kesin olarak uygulanır — istemcinin elindeki
//     belirteç geçerli görünse bile API onu reddeder.
//   • Şifre cihazda ASLA saklanmaz; burada da saklanmaz. Yenileme anahtarı
//     veritabanına YAZILMAZ (yalnız istemcide, mobilde Keychain/Keystore'da).
//
// GÜVENLİ DÜŞÜŞ: migration 006 uygulanmadıysa (tablo yok) servis kendini
// "devre dışı" sayar: uygulama eski davranışla çalışmaya devam eder, ama
// cihaz listesi/uzaktan kapatma özellikleri migration uygulanana dek kapalıdır.

// Kullanılmayan oturum bu süreden sonra yenilenemez (kendiliğinden düşer).
export const SESSION_IDLE_MAX_MS = 60 * 24 * 60 * 60 * 1000; // 60 gün

let tablesAvailable = null; // null = bilinmiyor, sonra true/false
let lastMissingAt = 0;
// "Tablo yok" durumu KALICI ezberlenmez: migration sonradan uygulanırsa
// backend yeniden başlatılmadan, en geç bu süre içinde kendiliğinden toparlar.
const MISSING_RETRY_MS = 10 * 60 * 1000;

function missingTable(error) {
  return /does not exist|42P01/i.test(error?.message || '');
}

function markMissing() { tablesAvailable = false; lastMissingAt = Date.now(); }

// tablesAvailable === false yerine kullanılır: süre dolduysa yeniden dener.
function unavailable() {
  if (tablesAvailable !== false) return false;
  if (Date.now() - lastMissingAt > MISSING_RETRY_MS) { tablesAvailable = null; return false; }
  return true;
}

export function sessionsEnabled() { return tablesAvailable !== false; }

/** Test/yeniden deneme için durumu sıfırlar. */
export function _resetAvailability() { tablesAvailable = null; lastMissingAt = 0; }

/** Cihazı bul/oluştur ve oturum satırı aç. Dönen: sessionId (veya null). */
export async function createSession(sbAdmin, { userId, clientDeviceId, deviceName, platform, req }) {
  if (!sbAdmin || unavailable()) return null;
  try {
    let deviceId = null;
    const devId = String(clientDeviceId || '').slice(0, 80);
    if (devId) {
      const devRow = {
        user_id: userId,
        client_device_id: devId,
        name: String(deviceName || '').slice(0, 80) || null,
        platform: String(platform || '').slice(0, 20) || null,
        last_seen_at: new Date().toISOString(),
      };
      const { data: dev, error: de } = await sbAdmin
        .from('devices')
        .upsert(devRow, { onConflict: 'user_id,client_device_id' })
        .select('id')
        .maybeSingle();
      if (de) throw de;
      deviceId = dev?.id || null;
    }
    const nowIso = new Date().toISOString();
    const { data: ses, error: se } = await sbAdmin
      .from('sessions')
      .insert({
        user_id: userId,
        device_id: deviceId,
        created_at: nowIso,      // varsayılana bırakılmaz: zaman tek kaynaktan
        last_seen_at: nowIso,
        ip: req ? String(req.ip || '').slice(0, 60) : null,
        user_agent: req ? String(req.headers?.['user-agent'] || '').slice(0, 200) : null,
      })
      .select('id')
      .maybeSingle();
    if (se) throw se;
    tablesAvailable = true;
    return ses?.id || null;
  } catch (e) {
    if (missingTable(e)) { markMissing(); return null; }
    console.warn('[oturum] oturum açılamadı:', e.message);
    return null;
  }
}

/**
 * Oturumu doğrular: kullanıcının, iptal edilmemiş ve süresi geçmemiş oturumu mu?
 * Dönen: { ok:true } | { ok:false, reason } . Tablo yoksa { ok:true, degraded:true }.
 */
export async function verifySession(sbAdmin, { userId, sessionId, touch = true }) {
  if (!sbAdmin || unavailable()) return { ok: true, degraded: true };
  if (!sessionId) return { ok: false, reason: 'oturum-kimliği-yok' };
  try {
    const { data: s, error } = await sbAdmin
      .from('sessions')
      .select('id,user_id,revoked_at,last_seen_at')
      .eq('id', String(sessionId))
      .maybeSingle();
    if (error) throw error;
    tablesAvailable = true;
    if (!s || s.user_id !== userId) return { ok: false, reason: 'oturum-bulunamadı' };
    if (s.revoked_at) return { ok: false, reason: 'oturum-kapatılmış' };
    const idle = Date.now() - new Date(s.last_seen_at || 0).getTime();
    if (idle > SESSION_IDLE_MAX_MS) {
      await sbAdmin.from('sessions')
        .update({ revoked_at: new Date().toISOString(), revoke_reason: 'expired' })
        .eq('id', s.id);
      return { ok: false, reason: 'oturum-süresi-doldu' };
    }
    if (touch) {
      // last_seen çok sık yazılmasın: 5 dk'dan eskiyse güncelle.
      if (idle > 5 * 60 * 1000) {
        await sbAdmin.from('sessions')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', s.id);
      }
    }
    return { ok: true };
  } catch (e) {
    if (missingTable(e)) { markMissing(); return { ok: true, degraded: true }; }
    console.warn('[oturum] doğrulanamadı:', e.message);
    // Veritabanı geçici hatasında kullanıcıyı dışarı ATMA (yanlış negatif daha kötü).
    return { ok: true, degraded: true };
  }
}

/** Tek oturumu iptal eder (kendi oturumu ya da uzaktan başka cihaz). */
export async function revokeSession(sbAdmin, { userId, sessionId, reason = 'logout' }) {
  if (!sbAdmin || unavailable() || !sessionId) return false;
  try {
    const { data, error } = await sbAdmin
      .from('sessions')
      .update({ revoked_at: new Date().toISOString(), revoke_reason: reason })
      .eq('id', String(sessionId))
      .eq('user_id', userId)        // yalnız KENDİ oturumu — başkasınınki imkânsız
      .is('revoked_at', null)
      .select('id');
    if (error) throw error;
    return (data || []).length > 0;
  } catch (e) {
    if (missingTable(e)) { markMissing(); return false; }
    console.warn('[oturum] iptal edilemedi:', e.message);
    return false;
  }
}

/** Kullanıcının TÜM oturumlarını iptal eder; istisna olarak biri korunabilir. */
export async function revokeAllSessions(sbAdmin, { userId, exceptSessionId = null, reason = 'logout_all' }) {
  if (!sbAdmin || unavailable()) return 0;
  try {
    let q = sbAdmin
      .from('sessions')
      .update({ revoked_at: new Date().toISOString(), revoke_reason: reason })
      .eq('user_id', userId)
      .is('revoked_at', null);
    if (exceptSessionId) q = q.neq('id', String(exceptSessionId));
    const { data, error } = await q.select('id');
    if (error) throw error;
    return (data || []).length;
  } catch (e) {
    if (missingTable(e)) { markMissing(); return 0; }
    console.warn('[oturum] toplu iptal edilemedi:', e.message);
    return 0;
  }
}

/** Kullanıcının etkin oturumlarını cihaz bilgisiyle listeler. */
export async function listSessions(sbAdmin, { userId, currentSessionId = null }) {
  if (!sbAdmin || unavailable()) return { degraded: true, sessions: [] };
  try {
    const { data, error } = await sbAdmin
      .from('sessions')
      .select('id,created_at,last_seen_at,ip,user_agent,device_id,devices(name,platform,last_seen_at)')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .order('last_seen_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    tablesAvailable = true;
    return {
      degraded: false,
      sessions: (data || []).map((s) => ({
        id: s.id,
        createdAt: s.created_at,
        lastSeenAt: s.last_seen_at,
        deviceName: s.devices?.name || 'Bilinmeyen cihaz',
        platform: s.devices?.platform || null,
        current: currentSessionId ? s.id === currentSessionId : false,
      })),
    };
  } catch (e) {
    if (missingTable(e)) { markMissing(); return { degraded: true, sessions: [] }; }
    console.warn('[oturum] listelenemedi:', e.message);
    return { degraded: true, sessions: [] };
  }
}
