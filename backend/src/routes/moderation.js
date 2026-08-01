// ---------------------------------------------------------------------------
// MODERASYON UÇLARI — yalnız operatör (yayın kontrol listesi E9 / üçüncü şart)
// ---------------------------------------------------------------------------
// Topluluk Kuralları sayfası "her bildirim elle incelenir, en geç 7 gün içinde"
// diye söz veriyor. Bu rota, o sözü tutmayı mümkün kılan ekranın arkasıdır.
//
// YETKİ: `operatorKapisi` — kimlik `.env`deki MODERATOR_EMAILS listesinden
// gelir, uygulamanın içine gömülmez. Ayrıntı: src/moderatorGate.js.
//
// GİZLİLİK: bu uçların HİÇBİRİ bildiren kişinin kimliğini döndürmez. Operatör
// bir kararı vermek için yorumun metnine, sebeplere ve notlara bakar; kimin
// bildirdiğini bilmesi gerekmez ve o bilgi hiçbir uçtan çıkmaz.
//
// SIRA: gizle/geri al/yok say işlemlerinin veritabanı sırası kritiktir ve
// src/moderationOps.js içinde, sebepleriyle birlikte yazılıdır. Bu dosya
// yalnız HTTP kabuğudur; karar mantığı burada DEĞİLDİR (test edilebilirlik).
import { Router } from 'express';
import { safeError } from '../security/safeError.js';
import { sbAdmin, supabaseEnabled, getProfiles } from '../supabase.js';
import { uyelikKapisi } from '../security/supabaseGuard.js';
import { requireAuth } from '../mw.js';
import { operatorDurumu, operatorKapisi, RET_SEBEPLERI } from '../moderatorGate.js';
import {
  bekleyenBildirimler, yorumuGizle, yorumuGeriAl, bildirimiYokSay, LISTE_SINIRI,
} from '../moderationOps.js';

const router = Router();
router.use(uyelikKapisi(supabaseEnabled));

// ---------------------------------------------------------------------------
// GET /api/moderation/access — "bu hesap moderasyon ekranını görebilir mi?"
// ---------------------------------------------------------------------------
// KAPI YOK, çünkü cevabın kendisi kapının sonucudur: uygulama bu ucu çağırıp
// Profil ekranında girişi gösterip göstermeyeceğine karar verir. Normal
// kullanıcı 403 değil, `{operator:false}` alır — 403, arayüzde gereksiz bir
// hata olarak görünürdü.
//
// Sebep YALNIZ listedeki bir hesaba açıklanır: e-postası listede olup da
// doğrulanmamış olan kişi, tıkanmanın sebebini başka türlü öğrenemez.
router.get('/access', requireAuth, (req, res) => {
  const durum = operatorDurumu(req.user, process.env);
  if (durum.operator) return res.json({ operator: true });
  if (durum.sebep === RET_SEBEPLERI.DOGRULANMAMIS) {
    return res.json({ operator: false, sebep: durum.sebep });
  }
  res.json({ operator: false });
});

// Buradan sonrası TAMAMEN operatöre kapalıdır.
router.use(requireAuth, operatorKapisi(process.env));

// ---------------------------------------------------------------------------
// GET /api/moderation/reports — incelenmeyi bekleyen bildirimler
// ---------------------------------------------------------------------------
router.get('/reports', async (req, res) => {
  const istenen = Number(req.query.limit);
  const limit = Number.isFinite(istenen) && istenen > 0 ? Math.min(istenen, LISTE_SINIRI) : LISTE_SINIRI;
  try {
    const sonuc = await bekleyenBildirimler(sbAdmin, { limit, profilOku: getProfiles });
    res.json(sonuc);
  } catch (e) {
    safeError(res, e, 'Moderasyon işlemi şu an tamamlanamadı.');
  }
});

// ---------------------------------------------------------------------------
// POST /api/moderation/comments/:id/hide — yorumu ELLE gizle
// ---------------------------------------------------------------------------
router.post('/comments/:id/hide', async (req, res) => {
  try {
    const sonuc = await yorumuGizle(sbAdmin, { commentId: req.params.id, operatorId: req.user.id });
    if (!sonuc.ok) return res.status(sonuc.sebep === 'yorum-yok' ? 404 : 400).json({ error: mesaj(sonuc.sebep) });
    res.json(sonuc);
  } catch (e) {
    safeError(res, e, 'Moderasyon işlemi şu an tamamlanamadı.');
  }
});

// ---------------------------------------------------------------------------
// POST /api/moderation/comments/:id/unhide — gizlemeyi geri al
// ---------------------------------------------------------------------------
router.post('/comments/:id/unhide', async (req, res) => {
  try {
    const sonuc = await yorumuGeriAl(sbAdmin, { commentId: req.params.id, operatorId: req.user.id });
    if (!sonuc.ok) return res.status(sonuc.sebep === 'yorum-yok' ? 404 : 400).json({ error: mesaj(sonuc.sebep) });
    res.json(sonuc);
  } catch (e) {
    safeError(res, e, 'Moderasyon işlemi şu an tamamlanamadı.');
  }
});

// ---------------------------------------------------------------------------
// POST /api/moderation/reports/:id/dismiss — bildirimi yerinde bulma
// ---------------------------------------------------------------------------
router.post('/reports/:id/dismiss', async (req, res) => {
  try {
    const sonuc = await bildirimiYokSay(sbAdmin, { reportId: req.params.id, operatorId: req.user.id });
    if (!sonuc.ok) return res.status(sonuc.sebep === 'bildirim-yok' ? 404 : 400).json({ error: mesaj(sonuc.sebep) });
    res.json(sonuc);
  } catch (e) {
    safeError(res, e, 'Moderasyon işlemi şu an tamamlanamadı.');
  }
});

/** İşlem sonucundaki anahtarı kullanıcıya gösterilecek Türkçe metne çevirir. */
function mesaj(sebep) {
  if (sebep === 'yorum-yok') return 'Yorum bulunamadı (silinmiş olabilir).';
  if (sebep === 'bildirim-yok') return 'Bildirim bulunamadı.';
  if (sebep === 'gecersiz-yorum') return 'Geçersiz yorum numarası.';
  if (sebep === 'gecersiz-bildirim') return 'Geçersiz bildirim numarası.';
  return 'İşlem yapılamadı.';
}

export default router;
