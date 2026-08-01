// Kullanıcının kuponları — hesaba bağlı KALICI saklama (tarayıcı/tünel adresi
// değişse de kaybolmaz). Depo: src/couponStore.js (sürücülü: Supabase
// user_coupons tablosu; yapılandırılmamışsa dosya). İstemci tüm listeyi
// gönderir (kaynak app'tir), sunucu hesap bazında saklar. Kupon MANTIĞI
// app'te; burası sadece kalıcı depo. API sözleşmesi T12'de DEĞİŞMEDİ.
import { Router } from 'express';
import { requireAuth } from '../mw.js';
import { getCoupons, setCoupons } from '../couponStore.js';
import { safeError } from '../security/safeError.js';
import { sbAdmin, supabaseEnabled } from '../supabase.js';
import { uyelikKapisi } from '../security/supabaseGuard.js';
import { award } from '../gamification/service.js';
import { POINT_RULES } from '../gamification/catalog.js';

const router = Router();
router.use(uyelikKapisi(supabaseEnabled));

// Kupon kaydı puanı: kupon başına BİR KEZ (unique kısıt), ömür boyu en fazla
// 10 kupon puanlanır — "kupon çoğaltarak puan kasma" bu sınırla anlamsızlaşır.
const COUPON_AWARD_LIFETIME_MAX = 10;
async function awardNewCoupons(userId, list) {
  try {
    const { count } = await sbAdmin.from('points_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('kind', 'coupon_saved');
    let room = COUPON_AWARD_LIFETIME_MAX - (count || 0);
    for (const c of list) {
      if (room <= 0) break;
      const id = c && (c.id || c.couponId);
      if (!id) continue;
      const ok = await award(sbAdmin, {
        userId, kind: 'coupon_saved', refId: String(id), points: POINT_RULES.coupon_saved,
      });
      if (ok) room -= 1;
    }
  } catch { /* puanlama fırsatçıdır; kupon kaydını asla engellemez */ }
}

// Kullanıcının kuponları
router.get('/', requireAuth, async (req, res) => {
  try {
    const coupons = await getCoupons(req.user.id);
    res.json({ coupons });
  } catch (e) {
    safeError(res, e, 'Kuponlar şu an okunamadı.');
  }
});

// Kullanıcının kupon listesini KOMPLE değiştir (app kaynak)
router.put('/', requireAuth, async (req, res) => {
  const list = Array.isArray(req.body?.coupons) ? req.body.coupons : null;
  if (!list) return res.status(400).json({ error: 'coupons dizisi gerekli.' });
  if (list.length > 1000) return res.status(400).json({ error: 'Çok fazla kupon.' });
  try {
    await setCoupons(req.user.id, list);
  } catch (e) {
    return safeError(res, e, 'Kuponlar şu an kaydedilemedi.');
  }
  awardNewCoupons(req.user.id, list); // ateşle-unut; yanıtı bloklamaz
  res.json({ ok: true, count: list.length });
});

export default router;
