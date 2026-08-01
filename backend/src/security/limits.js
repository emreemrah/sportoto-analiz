// MALİYETLİ UÇLAR İÇİN ORAN SINIRLARI — tek yerde, sayılarıyla.
//
// /api/auth altındaki kaba-kuvvet sınırları auth rotasında ayrıca durur;
// buradakiler İÇERİK ve KAYNAK-TÜKETİMİ uçlarıdır (güvenlik denetimi O-2):
// yorum spam'i, 1000 kuponluk PUT, 2 MB base64 avatar, pahalı backtest.
// trust proxy açık olduğu için req.ip gerçek istemci IP'sidir (T1).
import { makeRateLimiter, rateLimitMiddleware } from './rateLimit.js';

const DK = 60 * 1000;
const SAAT = 60 * DK;

// Sınır değerleri — değişecekse BURADAN değişir (tarif: T8).
export const LIMIT_DEGERLERI = {
  yorumEkleme: { windowMs: DK, limit: 5, blockMs: DK },        // dakikada 5 yorum
  kuponYazma: { windowMs: DK, limit: 10, blockMs: DK },        // dakikada 10 kupon PUT'u
  avatarYukleme: { windowMs: SAAT, limit: 5, blockMs: SAAT },  // saatte 5 avatar
  backtest: { windowMs: DK, limit: 2, blockMs: DK },           // dakikada 2 backtest
};

const mw = (ad) => rateLimitMiddleware(makeRateLimiter(LIMIT_DEGERLERI[ad]));

// Yalnız belirli HTTP metodlarında sınırlayan sarmalayıcı: GET'ler serbest kalır.
export function yalnizMetod(metodlar, aramw) {
  const set = new Set(Array.isArray(metodlar) ? metodlar : [metodlar]);
  return (req, res, next) => (set.has(req.method) ? aramw(req, res, next) : next());
}

export const yorumEklemeLimiti = yalnizMetod('POST', mw('yorumEkleme'));
export const kuponYazmaLimiti = yalnizMetod(['PUT', 'POST'], mw('kuponYazma'));
export const avatarLimiti = yalnizMetod(['PUT', 'POST'], mw('avatarYukleme'));
export const backtestLimiti = yalnizMetod('POST', mw('backtest'));
