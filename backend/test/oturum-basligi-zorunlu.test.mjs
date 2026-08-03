// OTURUM DOĞRULAMASI KOŞULSUZ — başlığı düşürerek atlatılamaz.
//
// DOĞRULANMIŞ AÇIK: `checkSession` oturumu yalnız `x-session-id` başlığı
// GELDİYSE doğruluyordu:
//
//     if (sessionId) { const v = await verifySession(...); ... }
//
// İstemci başlığı hiç göndermezse blok çalışmıyor ve istek geçiyordu. Yani
// "tüm cihazlardan çıkış" özelliği atlatılabiliyordu: uzaktan kapatılan cihaz,
// başlığı düşürerek belirteç süresi dolana kadar erişimi sürdürüyordu.
//
// Bu testler doğrulamanın KOŞULSUZ çağrıldığını bağlar. Ağ/veritabanı yok:
// mw.checkSession'ın kullandığı verifySession taklit edilir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const kaynak = readFileSync(join(KOK, 'src', 'mw.js'), 'utf8');

// Yorumları çıkar — açıklama metnindeki örnek kod, gerçek kod sanılmasın.
const kod = kaynak.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function blokAl(bas, son) {
  const i = kod.indexOf(bas);
  assert.ok(i > 0, `${bas} bulunamadı`);
  const j = kod.indexOf(son, i);
  assert.ok(j > i, `${son} bulunamadı (blok sınırı)`);
  return kod.slice(i, j);
}

test('checkSession, verifySession\'ı KOŞULSUZ çağırıyor', () => {
  const blok = blokAl('async function checkSession', 'export async function requireAuth');
  // Çağrı var…
  assert.match(blok, /await verifySession\(/, 'verifySession hiç çağrılmıyor');
  // …ve `if (sessionId)` kapısının ARDINDA değil.
  assert.doesNotMatch(
    blok,
    /if\s*\(\s*sessionId\s*\)\s*\{[\s\S]*await verifySession\(/,
    'verifySession hâlâ "başlık varsa" koşuluna bağlı — başlık düşürülerek atlatılabilir',
  );
});

test('doğrulama başarısızsa 401 dönüyor', () => {
  const blok = blokAl('async function checkSession', 'export async function requireAuth');
  assert.match(blok, /if\s*\(!v\.ok\)/, 'doğrulama sonucu kontrol edilmiyor');
  assert.match(blok, /status\(401\)/, '401 dönmüyor');
});

test('çerez modundaki CSRF koruması korunuyor', () => {
  // Bu kural ayrıdır ve kaldırılmamalı: çerezle gelen durum değiştiren istekte
  // başlık zaten zorunluydu.
  const blok = blokAl('async function checkSession', 'export async function requireAuth');
  assert.match(blok, /viaCookie && !SAFE_METHODS\.has\(req\.method\) && !sessionId/);
});

// --- Davranış testi: verifySession'ın sözleşmesi -----------------------------
const { verifySession } = await import('../src/security/sessionService.js');

test('verifySession, oturum kimliği YOKSA reddediyor', async () => {
  // checkSession artık başlıksız durumda da bunu çağırıyor; reddin burada
  // gerçekleştiğini bağlıyoruz.
  const sahteSb = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) };
  const r = await verifySession(sahteSb, { userId: 'u1', sessionId: null });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'oturum-kimliği-yok');
});

test('Supabase yoksa akış BOZULMUYOR (degraded geçiş)', async () => {
  // Oturum tabloları olmayan kurulum çalışmaya devam etmeli; bu davranış
  // bilerek korunuyor, aksi hâlde düzeltme kurulumları kırardı.
  const r = await verifySession(null, { userId: 'u1', sessionId: null });
  assert.equal(r.ok, true);
  assert.equal(r.degraded, true);
});
