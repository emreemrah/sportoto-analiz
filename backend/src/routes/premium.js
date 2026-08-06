// ---------------------------------------------------------------------------
// PREMIUM — KULLANICI TARAFI (kod kullanma + durum sorgusu)
// ---------------------------------------------------------------------------
// Uygulamadaki "Premium Kodu" ekranının arkasıdır. Operatör kodu üretir
// (bkz. routes/admin.js), kullanıcı buraya yazar.
//
// GÜVENLİK KARARLARI
//
// 1. KOD DOĞRULAMASI SUNUCUDA. İstemci "ben premium'um" diyemez; durum her
//    zaman veritabanındaki hak satırlarından TÜRETİLİR.
//
// 2. DENEME SINIRI VAR. Kod 10 karakterlik bir alfabeden seçiliyor; sınırsız
//    deneme hakkı, kaba kuvvetle geçerli kod bulmayı mümkün kılardı.
//
// 3. HATA MESAJLARI AYRIMSIZ DEĞİL, ama BİLGİ SIZDIRMAZ: "bu kod sana ait
//    değil" gibi bir cevap yok. Kullanılamaz her kod için tek genel neden
//    döner; yalnız "zaten kullanmışsın" ayrı söylenir çünkü kullanıcının
//    kendi geçmişidir ve yeni bilgi vermez.
import { Router } from 'express';
import { safeError } from '../security/safeError.js';
import { sbAdmin, supabaseEnabled } from '../supabase.js';
import { uyelikKapisi } from '../security/supabaseGuard.js';
import { requireAuth } from '../mw.js';
import { makeRateLimiter, rateLimitMiddleware } from '../security/rateLimit.js';
import { kodNormalize, kodGecerliMi, premiumDurumu, bitisHesapla } from '../premiumBan.js';

const router = Router();
router.use(uyelikKapisi(supabaseEnabled));

// Kaba kuvvet koruması: 15 dakikada 10 deneme. Doğru kod sayacı sıfırlamaz —
// tek hesapla çok kod denemenin bir meşru sebebi yok.
const kodLimiti = makeRateLimiter({ windowMs: 15 * 60 * 1000, limit: 10, blockMs: 15 * 60 * 1000 });
const rl = (limiter) => rateLimitMiddleware(limiter);

/** Kullanıcının etkin premium durumunu okur. Tek doğruluk kaynağı. */
async function durumOku(userId) {
  const { data, error } = await sbAdmin
    .from('premium_grants').select('expires_at,revoked_at,source,code,granted_at')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  const d = premiumDurumu(data || []);
  return { ...d, haklar: (data || []).filter((h) => !h.revoked_at).length };
}

// ---------------------------------------------------------------------------
// GET /api/premium/durum — "premium miyim, ne zamana kadar?"
// ---------------------------------------------------------------------------
router.get('/durum', requireAuth, async (req, res) => {
  try {
    res.json(await durumOku(req.user.id));
  } catch (e) {
    // Tablo yoksa premium sistemi henüz kurulmamıştır: kullanıcıya hata
    // göstermek yerine "premium değilsin" demek doğru davranıştır.
    if (/does not exist|schema cache|could not find the table/i.test(String(e?.message || ''))) {
      return res.json({ premium: false, suresiz: false, bitis: null, haklar: 0, kurulmadi: true });
    }
    safeError(res, e, 'Premium durumu okunamadı.');
  }
});

// ---------------------------------------------------------------------------
// POST /api/premium/kod — kodu kullan
// ---------------------------------------------------------------------------
router.post('/kod', requireAuth, rl(kodLimiti), async (req, res) => {
  try {
    const kod = kodNormalize(req.body?.kod);
    if (!kod || kod.length < 4) return res.status(400).json({ error: 'Kod eksik veya çok kısa.' });

    const { data: satir, error } = await sbAdmin
      .from('premium_codes').select('*').eq('code', kod).maybeSingle();
    if (error) throw new Error(error.message);

    // Kullanım sayısı: koda yazılı sayaç yerine SAYIM — yarış koşulu olmaz.
    const { count } = await sbAdmin
      .from('premium_redemptions').select('id', { count: 'exact', head: true }).eq('code', kod);

    const gecerli = kodGecerliMi(satir, count || 0);
    if (!gecerli.ok) {
      const mesaj = gecerli.sebep === 'kullanim-doldu' ? 'Bu kodun kullanım hakkı dolmuş.'
        : gecerli.sebep === 'suresi-gecmis' ? 'Bu kodun süresi geçmiş.'
          : 'Kod geçersiz.';
      return res.status(400).json({ error: mesaj });
    }

    // Aynı kod aynı kişide iki kez çalışmaz (veritabanında unique kısıt var;
    // burada önce bakmak kullanıcıya anlaşılır mesaj vermek içindir).
    const { data: onceki } = await sbAdmin.from('premium_redemptions')
      .select('id').eq('code', kod).eq('user_id', req.user.id).maybeSingle();
    if (onceki) return res.status(400).json({ error: 'Bu kodu zaten kullanmışsın.' });

    const { error: rHata } = await sbAdmin.from('premium_redemptions')
      .insert({ code: kod, user_id: req.user.id });
    if (rHata) {
      // Benzersizlik ihlali = aynı anda iki istek geldi; kullanıcı zaten almış.
      if (/duplicate key/i.test(rHata.message)) {
        return res.status(400).json({ error: 'Bu kodu zaten kullanmışsın.' });
      }
      throw new Error(rHata.message);
    }

    const expires = bitisHesapla(satir.grants_days);
    const { error: gHata } = await sbAdmin.from('premium_grants').insert({
      user_id: req.user.id, source: 'code', code: kod, expires_at: expires,
    });
    if (gHata) throw new Error(gHata.message);

    res.json({ ok: true, ...(await durumOku(req.user.id)) });
  } catch (e) {
    if (/does not exist|schema cache|could not find the table/i.test(String(e?.message || ''))) {
      return res.status(503).json({ error: 'Premium sistemi henüz kurulmadı.' });
    }
    safeError(res, e, 'Kod kullanılamadı.');
  }
});

export default router;
