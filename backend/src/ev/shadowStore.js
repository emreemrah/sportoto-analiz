// GÖLGE KAYIT DEPOSU (T10) — motorun çıktısı YALNIZ buraya yazılır.
//
// Neden gölge: λ (kalabalık yoğunlaşması) haftada 4 sayıdan öğrenilir ve ≥30
// hafta öncesi güvenilir değildir. Bu süre boyunca motor çalışır, tahmin üretir
// ve her hafta gerçekleşenle kıyaslanır — ama kullanıcıya HİÇBİR SAYI
// GÖSTERİLMEZ. Böylece "ileriye dönük gölge test" verisi birikir; geriye dönük
// backtest yalan söyleyebilir, ileriye dönük kayıt söyleyemez.
//
// Bu dosyaların hiçbir API ucundan dönmediği testle güvence altına alınmıştır.
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// TEST GÜVENLİĞİ: gölge kayıt artık bülten KİLİDİNE bağlı (ev/weekly.js), yani
// bülten donduran HER test dosyası kayıt üretir. EV_SHADOW_DIR'i ayarlamayı
// unutan bir test gerçek data/ev-shadow klasörüne sahte hafta yazardı ve bu
// kirlilik sonraki koşularda "already_exists" olarak geri gelirdi. Test
// koşucusu altında varsayılan bilerek geçici klasördür — unutmak artık zarar
// veremez, bilinçli kullanan test EV_SHADOW_DIR'i yine kendisi verir.
const underTest = process.env.NODE_TEST_CONTEXT != null;
export const SHADOW_DIR = process.env.EV_SHADOW_DIR
  || (underTest ? mkdtempSync(join(tmpdir(), 'ev-shadow-test-')) : join(here, '..', '..', 'data', 'ev-shadow'));

function ensureDir() {
  mkdirSync(SHADOW_DIR, { recursive: true });
}

/** Haftalık gölge kaydı yazar (varsa üzerine yazmaz — mühür mantığı). */
export function writeShadowRecord(roundId, record) {
  ensureDir();
  const file = join(SHADOW_DIR, `${String(roundId).replace(/[^0-9A-Za-z_-]/g, '_')}.json`);
  if (existsSync(file)) return { written: false, reason: 'already_exists', file };
  writeFileSync(file, JSON.stringify({ ...record, writtenAt: new Date().toISOString() }, null, 2));
  return { written: true, file };
}

/**
 * SONUÇ SATIRI — kayda BİR KEZ eklenir. Tahmin bölümüne DOKUNULMAZ (mühür
 * bozulmaz); yalnız daha önce olmayan `settlement` alanı yazılır. İkinci çağrı
 * sessizce reddedilir — sonuç açıklandıktan sonra kayıt yeniden yazılabilirse
 * gölge testin ileriye dönüklüğü anlamını yitirir.
 */
export function appendShadowSettlement(roundId, settlement) {
  const file = join(SHADOW_DIR, `${String(roundId).replace(/[^0-9A-Za-z_-]/g, '_')}.json`);
  if (!existsSync(file)) return { written: false, reason: 'no_record' };
  let rec;
  try { rec = JSON.parse(readFileSync(file, 'utf8')); } catch { return { written: false, reason: 'unreadable' }; }
  if (rec.settlement) return { written: false, reason: 'already_settled' };
  writeFileSync(file, JSON.stringify({ ...rec, settlement }, null, 2));
  return { written: true, file };
}

export function readShadowRecord(roundId) {
  const file = join(SHADOW_DIR, `${String(roundId).replace(/[^0-9A-Za-z_-]/g, '_')}.json`);
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}

export function listShadowRounds() {
  if (!existsSync(SHADOW_DIR)) return [];
  return readdirSync(SHADOW_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
}
