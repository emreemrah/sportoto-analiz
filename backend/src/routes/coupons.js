// Kullanıcının kuponları — hesaba bağlı KALICI saklama (tarayıcı/tünel adresi
// değişse de kaybolmaz). Basit dosya deposu: backend/data/coupons.json içinde
// { [userId]: coupons[] }. İstemci tüm listeyi gönderir (kaynak app'tir), sunucu
// hesap bazında saklar. Kupon MANTIĞI app'te; burası sadece kalıcı depo.
import { Router } from 'express';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuth } from '../mw.js';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', '..', 'data'); // backend/data
mkdirSync(dataDir, { recursive: true });
const FILE = join(dataDir, 'coupons.json');

function readMap() {
  if (!existsSync(FILE)) return {};
  try { return JSON.parse(readFileSync(FILE, 'utf8')); } catch { return {}; }
}
function writeMap(m) {
  try { writeFileSync(FILE, JSON.stringify(m)); } catch (e) { console.warn('[coupons] yazılamadı:', e.message); }
}

const router = Router();

// Kullanıcının kuponları
router.get('/', requireAuth, (req, res) => {
  const map = readMap();
  res.json({ coupons: Array.isArray(map[req.user.id]) ? map[req.user.id] : [] });
});

// Kullanıcının kupon listesini KOMPLE değiştir (app kaynak)
router.put('/', requireAuth, (req, res) => {
  const list = Array.isArray(req.body?.coupons) ? req.body.coupons : null;
  if (!list) return res.status(400).json({ error: 'coupons dizisi gerekli.' });
  if (list.length > 1000) return res.status(400).json({ error: 'Çok fazla kupon.' });
  const map = readMap();
  map[req.user.id] = list;
  writeMap(map);
  res.json({ ok: true, count: list.length });
});

export default router;
