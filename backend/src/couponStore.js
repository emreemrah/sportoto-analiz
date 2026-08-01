// KUPON DEPOSU — hesaba bağlı kalıcı saklama.
//
// backend/data/coupons.json içinde { [userId]: coupons[] } biçiminde tutulur.
// Kupon MANTIĞI app tarafındadır; burası yalnız depodur.
//
// Bu dosya ayrı bir modüldür çünkü hesap silme akışının da (routes/auth.js)
// aynı depoya erişmesi gerekir; rota dosyasından içeri aktarmak döngüsel
// bağımlılık yaratırdı.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data'); // backend/data
mkdirSync(dataDir, { recursive: true });
export const COUPONS_FILE = join(dataDir, 'coupons.json');

export function readMap() {
  if (!existsSync(COUPONS_FILE)) return {};
  try {
    return JSON.parse(readFileSync(COUPONS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function writeMap(m) {
  try {
    writeFileSync(COUPONS_FILE, JSON.stringify(m));
  } catch (e) {
    console.warn('[coupons] yazılamadı:', e.message);
  }
}
