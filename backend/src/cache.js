// Basit dosya tabanlı cache (cache/ klasöründe JSON dosyaları).
// İleride istenirse SQLite/Postgres'e yükseltilebilir; arayüz aynı kalır.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cacheDir = join(here, '..', 'cache');

mkdirSync(cacheDir, { recursive: true });

export function save(key, data) {
  const payload = { savedAt: new Date().toISOString(), data };
  writeFileSync(join(cacheDir, `${key}.json`), JSON.stringify(payload));
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
