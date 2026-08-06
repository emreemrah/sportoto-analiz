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
// GET /api/admin/kullanicilar — kayıt/etkinlik özeti + kullanıcı listesi
// ---------------------------------------------------------------------------
// NEDEN E-POSTA GÖSTERİLİYOR: burası hizmeti işleten kişinin kendi kullanıcı
// tabanıdır; destek isteğine cevap vermek, bir hesabı bulmak ve kötüye
// kullanımı incelemek için adres gerekir. Yine de veri EN AZA indirildi:
//  • Şifre, belirteç, IP, cihaz parmak izi DÖNMEZ.
//  • Liste sayfalıdır; "tüm tabanı tek seferde dök" davranışı yoktur.
//  • Bu uç yalnız operatöre açıktır (dosyanın başındaki tek kapı).
//
// "AKTİF" TANIMI (uydurma değil, ölçülebilir): `sessions` tablosunda iptal
// EDİLMEMİŞ oturumu olan kullanıcı. Kullanıcı çıkış yaparsa veya oturum
// uzaktan kapatılırsa aktif sayılmaz.
router.get('/kullanicilar', async (req, res) => {
  if (!supabaseEnabled) return res.json({ veritabani: false, sayim: null, liste: [] });
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const ara = String(req.query.q || '').trim().toLowerCase();

    // 1) Kimlik kayıtları (e-posta, doğrulama, son giriş) — auth şeması.
    const { data: sayfa, error: uHata } = await sbAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (uHata) throw new Error(uHata.message);
    const kullanicilar = sayfa?.users || [];

    // 2) Profil adları — tek sorgu, kullanıcı başına ayrı istek YOK.
    const { data: profiller } = await sbAdmin.from('profiles').select('id,username,created_at');
    const profilHarita = new Map((profiller || []).map((p) => [String(p.id), p]));

    // 3) Etkin oturumlar — "şu an aktif" ölçüsü.
    const { data: oturumlar } = await sbAdmin
      .from('sessions').select('user_id,last_seen_at').is('revoked_at', null);
    const etkinHarita = new Map();
    for (const o of oturumlar || []) {
      const k = String(o.user_id);
      const onceki = etkinHarita.get(k);
      if (!onceki || (o.last_seen_at && o.last_seen_at > onceki)) etkinHarita.set(k, o.last_seen_at || null);
    }

    const simdi = Date.now();
    const gunOnce = (n) => simdi - n * 24 * 60 * 60 * 1000;
    const zaman = (v) => (v ? new Date(v).getTime() : 0);

    const sayim = {
      toplam: kullanicilar.length,
      dogrulanmis: kullanicilar.filter((u) => !!u.email_confirmed_at).length,
      dogrulanmamis: kullanicilar.filter((u) => !u.email_confirmed_at).length,
      yeni24s: kullanicilar.filter((u) => zaman(u.created_at) >= gunOnce(1)).length,
      yeni7g: kullanicilar.filter((u) => zaman(u.created_at) >= gunOnce(7)).length,
      yeni30g: kullanicilar.filter((u) => zaman(u.created_at) >= gunOnce(30)).length,
      etkinOturumlu: etkinHarita.size,
      son7gGiris: kullanicilar.filter((u) => zaman(u.last_sign_in_at) >= gunOnce(7)).length,
      profilliKullanici: profilHarita.size,
    };

    const liste = kullanicilar
      .map((u) => {
        const p = profilHarita.get(String(u.id)) || null;
        return {
          eposta: u.email || null,
          kullaniciAdi: p?.username || null,
          kayit: u.created_at || null,
          sonGiris: u.last_sign_in_at || null,
          dogrulandi: !!u.email_confirmed_at,
          etkinOturum: etkinHarita.has(String(u.id)),
        };
      })
      .filter((k) => !ara || (k.eposta || '').toLowerCase().includes(ara) || (k.kullaniciAdi || '').toLowerCase().includes(ara))
      .sort((a, b) => zaman(b.kayit) - zaman(a.kayit))
      .slice(0, limit);

    res.json({ veritabani: true, sayim, liste, gosterilen: liste.length });
  } catch (e) {
    safeError(res, e, 'Kullanıcı listesi okunamadı.');
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
