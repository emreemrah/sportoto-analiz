// Basit dosya tabanlı cache (cache/ klasöründe JSON dosyaları).
// İleride istenirse SQLite/Postgres'e yükseltilebilir; arayüz aynı kalır.
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// CACHE_DIR: test izolasyonu için geçici dizin verilebilir; üretimde boş bırakılır.
const cacheDir = process.env.CACHE_DIR || join(here, '..', 'cache');

mkdirSync(cacheDir, { recursive: true });

// Cache klasörünün yolu. JSON dışında ikili dosya da tutulabilsin diye dışa
// verilir (ör. arma vekilinin indirdiği görseller: cache/crests/). Yol tek
// yerde hesaplansın; CACHE_DIR ile taşındığında hepsi birlikte taşınsın.
export const CACHE_DIR = cacheDir;

export function save(key, data) {
  const payload = { savedAt: new Date().toISOString(), data };
  writeFileSync(join(cacheDir, `${key}.json`), JSON.stringify(payload));
}

// Kayıtlı tahmin snapshot'ı olan round id'leri (sistem karnesi için).
export function listSnapshotRounds() {
  try {
    return readdirSync(cacheDir)
      .filter((f) => /^snapshot-\d+\.json$/.test(f))
      .map((f) => Number(f.replace(/\D/g, '')));
  } catch {
    return [];
  }
}

// Kayıtlı radar arşivi olan round id'leri (geçmiş radar sekmeleri için).
export function listRadarRounds() {
  try {
    return readdirSync(cacheDir)
      .filter((f) => /^radar-\d+\.json$/.test(f))
      .map((f) => Number(f.replace(/\D/g, '')));
  } catch {
    return [];
  }
}

export function load(key) {
  const file = join(cacheDir, `${key}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * UCUZ VARLIK KONTROLÜ — dosyayı OKUMADAN "hazır mı?" sorusunu yanıtlar.
 * load() 1,2 MB'lık bülteni senkron okuyup ayrıştırır (Node'un tek thread'ini
 * bloklar); yalnız varlığı merak edildiğinde bu bedel ödenmemelidir.
 */
export function has(key) {
  return existsSync(join(cacheDir, `${key}.json`));
}
