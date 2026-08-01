// GÖLGE KAYIT DEPOSU (T10) — motorun çıktısı YALNIZ buraya yazılır.
//
// Neden gölge: λ (kalabalık yoğunlaşması) haftada 4 sayıdan öğrenilir ve ≥30
// hafta öncesi güvenilir değildir. Bu süre boyunca motor çalışır, tahmin üretir
// ve her hafta gerçekleşenle kıyaslanır — ama kullanıcıya HİÇBİR SAYI
// GÖSTERİLMEZ. Böylece "ileriye dönük gölge test" verisi birikir; geriye dönük
// backtest yalan söyleyebilir, ileriye dönük kayıt söyleyemez.
//
// Bu dosyaların hiçbir API ucundan dönmediği testle güvence altına alınmıştır.
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const SHADOW_DIR = process.env.EV_SHADOW_DIR || join(here, '..', '..', 'data', 'ev-shadow');

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
