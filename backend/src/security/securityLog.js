// GÜVENLİK OLAY KAYDI — security_logs tablosuna yazar.
//
// KESİN KURALLAR
//   1. ŞİFRE, TOKEN, YENİLEME ANAHTARI veya BENZERİ HASSAS VERİ ASLA yazılmaz.
//      meta alanı BEYAZ LİSTE ile süzülür; listede olmayan anahtar atılır.
//   2. Kayıt yazılamazsa uygulama akışı BOZULMAZ (best effort) — ama hata
//      konsola düşer ki sessizce kaybolmasın.
//   3. Migration 006 henüz uygulanmadıysa (tablo yok) kayıt sessizce atlanır;
//      uygulama çalışmaya devam eder. Bu durum açık madde olarak raporlanır.

// meta içinde yazılmasına İZİN VERİLEN anahtarlar. Bunların dışındaki her şey
// (ör. password, token, refreshToken...) süzülür.
const META_ALLOW = new Set([
  'sessionId', 'deviceName', 'platform', 'reason', 'email_masked', 'count', 'route',
]);

/** "ali@ornek.com" → "a***@ornek.com" — log'da tam e-posta tutulmaz. */
export function maskEmail(email) {
  const s = String(email || '');
  const at = s.indexOf('@');
  if (at <= 0) return '***';
  return `${s[0]}***@${s.slice(at + 1)}`;
}

export function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(meta)) {
    if (!META_ALLOW.has(k)) continue;               // beyaz liste dışı → atılır
    if (v == null) continue;
    const s = String(v);
    // Savunma derinliği: JWT/uzun sır görünümlü değerler meta'ya giremez.
    if (s.length > 120 || /^ey[A-Za-z0-9_-]{10,}/.test(s)) continue;
    out[k] = s;
  }
  return Object.keys(out).length ? out : null;
}

let tableMissingWarned = false;

/** Güvenlik olayı kaydeder (best effort — akışı asla bozmaz). */
export async function logSecurityEvent(sbAdmin, { userId = null, event, req = null, meta = null }) {
  if (!sbAdmin || !event) return;
  try {
    const row = {
      user_id: userId || null,
      event: String(event).slice(0, 60),
      ip: req ? String(req.ip || req.socket?.remoteAddress || '').slice(0, 60) : null,
      user_agent: req ? String(req.headers?.['user-agent'] || '').slice(0, 200) : null,
      meta: sanitizeMeta(meta),
    };
    const { error } = await sbAdmin.from('security_logs').insert(row);
    if (error) {
      // 42P01 = tablo yok (migration 006 bekleniyor) → bir kez uyar, akışı bozma.
      if (/does not exist|42P01/i.test(error.message || '')) {
        if (!tableMissingWarned) {
          tableMissingWarned = true;
          console.warn('[güvenlik] security_logs tablosu yok — migration 006 uygulanınca kayıt başlayacak.');
        }
        return;
      }
      console.warn('[güvenlik] olay kaydedilemedi:', error.message);
    }
  } catch (e) {
    console.warn('[güvenlik] olay kaydedilemedi:', e.message);
  }
}
