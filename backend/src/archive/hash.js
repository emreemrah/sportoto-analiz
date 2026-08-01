// SNAPSHOT DOĞRULAMA HASH'İ
// Kanonik JSON (anahtarlar özyinelemeli sıralı) + sha256. Aynı payload her zaman
// aynı hash'i üretir; alan sırası/whitespace farkları sonucu değiştirmez.
// Sonuçlar (match_official_results) payload'a HİÇ girmediği için sonuç eklemek
// hash'i değiştirmez — testler bunu kanıtlar.
import { createHash } from 'node:crypto';

export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') {
    if (value === undefined) return 'null';
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  }
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

export const HASH_ALGO = 'sha256-canonical-json-v1';

export function hashPayload(payload) {
  return createHash('sha256').update(canonicalJson(payload), 'utf8').digest('hex');
}

// Saklanan snapshot'ın bütünlük kontrolü: payload'ı yeniden hash'le, kayıtla kıyasla.
export function verifyPayloadHash(payload, expectedHash) {
  return hashPayload(payload) === expectedHash;
}
