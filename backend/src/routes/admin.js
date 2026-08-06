// ---------------------------------------------------------------------------
// YÖNETİM UÇLARI — yalnız operatör (masaüstü yönetim paneli için)
// ---------------------------------------------------------------------------
// NEDEN VAR: sistemi ayakta tutan işler (bülten güncel mi, kota bitti mi, şema
// göçü uygulandı mı, bekleyen bildirim var mı) bugüne kadar yalnız sunucu
// günlüklerinden ya da tek tek uçlardan okunabiliyordu. Operatörün bunları
// görmek için terminale girmesi gerekiyordu; girmeyince de sorunlar (2 Ağustos
// kota olayı, üretimde kopuk veritabanı) günlerce fark edilmedi.
//
// YETKİ: YENİ bir rol sistemi KURULMADI. Zaten var olan operatör kimliği
// kullanılır: `.env` içindeki MODERATOR_EMAILS + doğrulanmış e-posta şartı +
// fail-closed davranış (bkz. src/moderatorGate.js). İkinci bir yönetici
// şifresi eklemek, ikinci bir sızıntı yüzeyi açmak olurdu.
//
// SINIR (bilerek dar tutuldu):
//  • Bu uçlar KULLANICI SİLMEZ, askıya almaz, içerik düzenlemez.
//  • Arşive, mühürlü analizlere ve resmî sonuçlara DOKUNMAZ (proje kuralı).
//  • Tek yazma işlemi bülteni yeniden çekmektir; o da mevcut, kilitli
//    (aynı anda tek çalışan) akışı çağırır — yeni bir yol açmaz.
//
// DÜRÜSTLÜK: veri okunamadıysa uydurma sayı üretilmez; ilgili alan `null`
// döner ve panel "bilinmiyor" yazar.
import { Router } from 'express';
import { safeError } from '../security/safeError.js';
import { sbAdmin, supabaseEnabled } from '../supabase.js';
import { uyelikKapisi } from '../security/supabaseGuard.js';
import { requireAuth } from '../mw.js';
import { operatorKapisi } from '../moderatorGate.js';
import { load } from '../cache.js';
import { migrationDurumu } from '../migrate/index.js';
import { kotaDurumu } from '../sources/kotaBekcisi.js';
import { refreshCurrentBulletin } from '../autoRefresh.js';

const router = Router();
router.use(uyelikKapisi(supabaseEnabled));
// Buradan sonrası TAMAMEN operatöre kapalıdır — /access gibi açık uç YOK,
// çünkü panelin varlığını normal kullanıcıya duyurmanın bir faydası yok.
router.use(requireAuth, operatorKapisi(process.env));

/** Sayıyı güvenle okur; okunamazsa null döner (0 yazmak yalan olurdu). */
async function sayimDene(fn) {
  try { return await fn(); } catch { return null; }
}

// ---------------------------------------------------------------------------
// GET /api/admin/ozet — panelin ana ekranını besleyen tek çağrı
// ---------------------------------------------------------------------------
// TEK ÇAĞRI: panel açılışında altı ayrı istek atmak yerine tek özet döner.
// Sayımlar KİŞİSEL VERİ TAŞIMAZ — yalnız adet. E-posta, ad, IP dönmez.
router.get('/ozet', async (req, res) => {
  try {
    const cached = load('bulletin');
    const migration = migrationDurumu();
    const kota = kotaDurumu();

    const bulten = cached?.data || null;
    const maclar = Array.isArray(bulten?.matches) ? bulten.matches : [];
    const analizli = maclar.filter((m) => m?.analysis && m.analysis.surpriseScore != null).length;

    // Sayımlar: Supabase kapalıysa ya da hata verirse null (bilinmiyor).
    const kullanici = supabaseEnabled ? await sayimDene(async () => {
      const { count, error } = await sbAdmin.from('profiles').select('id', { count: 'exact', head: true });
      if (error) throw new Error(error.message);
      return count ?? null;
    }) : null;

    const bekleyenBildirim = supabaseEnabled ? await sayimDene(async () => {
      const { count, error } = await sbAdmin
        .from('comment_reports').select('id', { count: 'exact', head: true }).eq('status', 'beklemede');
      if (error) throw new Error(error.message);
      return count ?? null;
    }) : null;

    const yorum = supabaseEnabled ? await sayimDene(async () => {
      const { count, error } = await sbAdmin.from('comments').select('id', { count: 'exact', head: true });
      if (error) throw new Error(error.message);
      return count ?? null;
    }) : null;

    res.json({
      zaman: new Date().toISOString(),
      sistem: {
        semaOk: migration.ok,
        semaDurum: migration.durum,
        semaZaman: migration.zaman,
        veritabani: supabaseEnabled,
      },
      bulten: {
        var: !!bulten,
        hafta: bulten?.round || null,
        roundId: bulten?.roundId ?? null,
        guncellendi: bulten?.updatedAt || null,
        macSayisi: maclar.length,
        analizliMac: analizli,
      },
      kota: { kalan: kota.kalan, limit: kota.limit, sonGuncelleme: kota.sonGuncelleme },
      sayim: { kullanici, yorum, bekleyenBildirim },
    });
  } catch (e) {
    safeError(res, e, 'Yönetim özeti okunamadı.');
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/bulten-yenile — bülteni kaynaktan yeniden çeker
// ---------------------------------------------------------------------------
// Mevcut `refreshCurrentBulletin` çağrılır: aynı anda tek çalışır (ikinci
// istek sürene katılır), durum kaydı tutar ve normal zamanlayıcıyla AYNI yolu
// kullanır. Yani panel yeni bir veri yolu açmaz, var olanı tetikler.
router.post('/bulten-yenile', async (req, res) => {
  try {
    const sonuc = await refreshCurrentBulletin({ trigger: 'panel' });
    const cached = load('bulletin');
    res.json({
      ok: true,
      hafta: cached?.data?.round || null,
      guncellendi: cached?.data?.updatedAt || null,
      macSayisi: Array.isArray(cached?.data?.matches) ? cached.data.matches.length : null,
      not: sonuc === undefined ? null : 'tamamlandı',
    });
  } catch (e) {
    safeError(res, e, 'Bülten yenilenemedi.');
  }
});

export default router;
