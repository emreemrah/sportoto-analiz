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
import { sbAdmin, supabaseEnabled, getProfiles } from '../supabase.js';
import { uyelikKapisi } from '../security/supabaseGuard.js';
import { requireAuth, engelBellekTemizle } from '../mw.js';
import { operatorKapisi } from '../moderatorGate.js';
import { load } from '../cache.js';
import { migrationDurumu } from '../migrate/index.js';
import { kotaDurumu } from '../sources/kotaBekcisi.js';
import { refreshCurrentBulletin } from '../autoRefresh.js';
import { yorumuGizle, yorumuGeriAl } from '../moderationOps.js';
import {
  kodNormalize, kodUret, kodGecerliMi, premiumDurumu, etkinEngel, bitisHesapla,
} from '../premiumBan.js';
import { tamKirilim, benzerVakalar } from '../analysis/sinyalKirilim.js';
import { sinyalKayitlariniTopla, sinyalKatalogu } from '../analysis/sinyalToplama.js';

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

    // 4) Engel ve premium durumu — müdahale düğmeleri doğru durumu göstersin.
    //    Tablolar yoksa (migration 010 uygulanmamış) liste yine çalışır;
    //    o alanlar `null` gelir ve panel "bilinmiyor" der.
    const engelHarita = new Map();
    const engeller = await sayimDene(async () => {
      const { data, error } = await sbAdmin
        .from('user_bans').select('user_id,reason,banned_at,until,lifted_at').is('lifted_at', null);
      if (error) throw new Error(error.message);
      return data || [];
    });
    for (const e of engeller || []) {
      const v = etkinEngel([e]);
      if (v) engelHarita.set(String(e.user_id), v);
    }

    const premiumHarita = new Map();
    const haklar = await sayimDene(async () => {
      const { data, error } = await sbAdmin
        .from('premium_grants').select('user_id,expires_at,revoked_at,source,code');
      if (error) throw new Error(error.message);
      return data || [];
    });
    if (haklar) {
      const grupla = new Map();
      for (const h of haklar) {
        const k = String(h.user_id);
        if (!grupla.has(k)) grupla.set(k, []);
        grupla.get(k).push(h);
      }
      for (const [k, v] of grupla) premiumHarita.set(k, premiumDurumu(v));
    }
    sayim.premiumlu = haklar ? [...premiumHarita.values()].filter((p) => p.premium).length : null;
    sayim.engelli = engeller ? engelHarita.size : null;

    const liste = kullanicilar
      .map((u) => {
        const p = profilHarita.get(String(u.id)) || null;
        const engel = engelHarita.get(String(u.id)) || null;
        const prem = premiumHarita.get(String(u.id)) || null;
        return {
          id: u.id,
          eposta: u.email || null,
          kullaniciAdi: p?.username || null,
          kayit: u.created_at || null,
          sonGiris: u.last_sign_in_at || null,
          dogrulandi: !!u.email_confirmed_at,
          etkinOturum: etkinHarita.has(String(u.id)),
          engelli: engeller ? !!engel : null,
          engelSebep: engel?.reason || null,
          premium: haklar ? !!(prem && prem.premium) : null,
          premiumBitis: prem?.bitis || null,
          premiumSuresiz: !!(prem && prem.suresiz),
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
    await kayit(req, 'bulten-yenile', null, 'panelden tetiklendi');
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

// ═══════════════════════════════════════════════════════════════════════════
// MÜDAHALE UÇLARI — buradan sonrası VERİ DEĞİŞTİRİR
// ═══════════════════════════════════════════════════════════════════════════
// Ortak kurallar:
//  • Her işlem KİMİN yaptığını yazar (operatör e-postası) — sorumluluk izi.
//  • Geri alınabilir olan hiçbir şey SİLİNMEZ; işaretlenir (lifted_at,
//    revoked_at). Tek gerçek silme yorum silmedir ve o da açıkça istenir.
//  • Operatör KENDİNİ engelleyemez: paneli kilitleyip çıkışsız kalmak,
//    geri dönüşü sunucuya erişim gerektiren bir hatadır.

/** İstek sahibi operatörün e-postası — kayıtlara "kim yaptı" olarak yazılır. */
function operator(req) {
  return String(req.user?.email || '').toLowerCase() || 'bilinmeyen-operator';
}

/**
 * DENETİM KAYDI — her müdahale buraya bir satır yazar.
 * ASLA İSTEĞİ DÜŞÜRMEZ: kayıt yazılamazsa (tablo yok, bağlantı koptu) işlem
 * yine de tamamlanır. Ters tasarım, denetim tablosundaki bir arızayı tüm
 * yönetim işlemlerini durduran bir arızaya çevirirdi.
 */
async function kayit(req, action, target, detail, ok = true) {
  try {
    await sbAdmin.from('admin_audit').insert({
      actor: operator(req), action, target: target == null ? null : String(target),
      detail: String(detail || '').slice(0, 500), ok,
    });
  } catch { /* denetim kaydı yazılamadı — işlem etkilenmez */ }
}

/** Tablo yoksa (migration 010 uygulanmamış) anlaşılır hata döndürür. */
function tabloYokMu(e) {
  const m = String(e?.message || '');
  return /relation .* does not exist|could not find the table|schema cache/i.test(m);
}
function tabloHatasi(res) {
  return res.status(503).json({
    error: 'Bu özellik için veritabanı tabloları henüz oluşturulmadı '
      + '(migration 010). Sunucuda SUPABASE_DB_URL tanımlanınca açılışta otomatik kurulur.',
  });
}

// ---------------------------------------------------------------------------
// YORUMLAR — tüm geçmiş, arama, gizle / geri al / SİL
// ---------------------------------------------------------------------------
// NEDEN "tüm yorumlar": moderasyon kuyruğu yalnız BİLDİRİLEN yorumları
// gösterir. Operatörün kötü bir yorumu bildirim beklemeden bulup silebilmesi
// gerekiyor (kullanıcı isteği).
router.get('/yorumlar', async (req, res) => {
  if (!supabaseEnabled) return res.json({ veritabani: false, liste: [] });
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 300);
    const ara = String(req.query.q || '').trim();
    const sadeceGizli = String(req.query.gizli || '') === '1';

    let sorgu = sbAdmin
      .from('comments')
      .select('id,match_id,user_id,text,created_at,edited_at,hidden_at,hidden_reason')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (ara) sorgu = sorgu.ilike('text', `%${ara}%`);
    if (sadeceGizli) sorgu = sorgu.not('hidden_at', 'is', null);

    const { data: yorumlar, error } = await sorgu;
    if (error) throw new Error(error.message);

    const kullanicilar = [...new Set((yorumlar || []).map((c) => c.user_id).filter(Boolean))];
    const profiller = kullanicilar.length ? (await getProfiles(kullanicilar)) || {} : {};

    res.json({
      veritabani: true,
      liste: (yorumlar || []).map((c) => ({
        id: c.id,
        matchId: c.match_id,
        userId: c.user_id,
        kullaniciAdi: profiller[c.user_id]?.username || 'Silinmiş kullanıcı',
        metin: c.text,
        tarih: c.created_at,
        duzenlendi: c.edited_at || null,
        gizli: !!c.hidden_at,
        gizlenmeSebebi: c.hidden_reason || null,
      })),
    });
  } catch (e) {
    safeError(res, e, 'Yorumlar okunamadı.');
  }
});

// GİZLE / GERİ AL — moderasyonun kendi işlemleri (tek doğruluk kaynağı).
router.post('/yorum/:id/gizle', async (req, res) => {
  try {
    const r = await yorumuGizle(sbAdmin, { commentId: req.params.id, operatorId: req.user?.id });
    if (!r.ok) return res.status(400).json({ error: r.sebep || 'Yorum gizlenemedi.' });
    await kayit(req, 'yorum-gizle', req.params.id, '');
    res.json({ ok: true });
  } catch (e) { safeError(res, e, 'Yorum gizlenemedi.'); }
});

router.post('/yorum/:id/goster', async (req, res) => {
  try {
    const r = await yorumuGeriAl(sbAdmin, { commentId: req.params.id, operatorId: req.user?.id });
    if (!r.ok) return res.status(400).json({ error: r.sebep || 'Gizleme geri alınamadı.' });
    await kayit(req, 'yorum-goster', req.params.id, '');
    res.json({ ok: true });
  } catch (e) { safeError(res, e, 'Gizleme geri alınamadı.'); }
});

// SİL — GERİ ALINAMAZ. Bu yüzden ayrı bir uçtur ve panelde onay ister.
// Önce bağlı bildirimler, sonra yorum silinir (yabancı anahtar sırası).
router.delete('/yorum/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Geçersiz yorum numarası.' });
    await sbAdmin.from('comment_reports').delete().eq('comment_id', id);
    const { error } = await sbAdmin.from('comments').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await kayit(req, 'yorum-sil', id, 'kalıcı silme');
    res.json({ ok: true });
  } catch (e) { safeError(res, e, 'Yorum silinemedi.'); }
});

// ---------------------------------------------------------------------------
// KULLANICI ENGELLEME
// ---------------------------------------------------------------------------
router.post('/kullanici/:id/engelle', async (req, res) => {
  try {
    const hedef = String(req.params.id);
    if (hedef === String(req.user?.id)) {
      return res.status(400).json({ error: 'Kendini engelleyemezsin — panele giriş kapanır.' });
    }
    const sebep = String(req.body?.sebep || '').slice(0, 300);
    const gun = Number(req.body?.gun);
    const until = Number.isFinite(gun) && gun > 0
      ? new Date(Date.now() + gun * 86400000).toISOString() : null;
    const { error } = await sbAdmin.from('user_bans')
      .insert({ user_id: hedef, reason: sebep, banned_by: operator(req), until });
    if (error) throw new Error(error.message);
    engelBellekTemizle(hedef);                   // 60 sn beklenmesin
    await kayit(req, 'kullanici-engelle', hedef, `${sebep || 'sebep yazılmadı'} · ${until ? gun + ' gün' : 'süresiz'}`);
    res.json({ ok: true, until });
  } catch (e) {
    if (tabloYokMu(e)) return tabloHatasi(res);
    safeError(res, e, 'Kullanıcı engellenemedi.');
  }
});

router.post('/kullanici/:id/engeli-kaldir', async (req, res) => {
  try {
    const { error } = await sbAdmin.from('user_bans')
      .update({ lifted_at: new Date().toISOString(), lifted_by: operator(req) })
      .eq('user_id', String(req.params.id)).is('lifted_at', null);
    if (error) throw new Error(error.message);
    engelBellekTemizle(String(req.params.id));   // beklemeden etkili olsun
    await kayit(req, 'engel-kaldir', req.params.id, '');
    res.json({ ok: true });
  } catch (e) {
    if (tabloYokMu(e)) return tabloHatasi(res);
    safeError(res, e, 'Engel kaldırılamadı.');
  }
});

// ---------------------------------------------------------------------------
// PREMIUM — doğrudan verme / iptal
// ---------------------------------------------------------------------------
router.post('/kullanici/:id/premium', async (req, res) => {
  try {
    const gun = Number(req.body?.gun);
    const expires = bitisHesapla(Number.isFinite(gun) ? gun : 30);
    const { error } = await sbAdmin.from('premium_grants').insert({
      user_id: String(req.params.id), source: 'manual', granted_by: operator(req), expires_at: expires,
    });
    if (error) throw new Error(error.message);
    await kayit(req, 'premium-ver', req.params.id, expires ? `bitiş ${expires}` : 'süresiz');
    res.json({ ok: true, bitis: expires });
  } catch (e) {
    if (tabloYokMu(e)) return tabloHatasi(res);
    safeError(res, e, 'Premium verilemedi.');
  }
});

router.post('/kullanici/:id/premium-iptal', async (req, res) => {
  try {
    const { error } = await sbAdmin.from('premium_grants')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', String(req.params.id)).is('revoked_at', null);
    if (error) throw new Error(error.message);
    await kayit(req, 'premium-iptal', req.params.id, '');
    res.json({ ok: true });
  } catch (e) {
    if (tabloYokMu(e)) return tabloHatasi(res);
    safeError(res, e, 'Premium iptal edilemedi.');
  }
});

// ---------------------------------------------------------------------------
// PREMIUM KODLARI
// ---------------------------------------------------------------------------
router.get('/premium/kodlar', async (req, res) => {
  try {
    const { data: kodlar, error } = await sbAdmin.from('premium_codes')
      .select('*').order('created_at', { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    const { data: kullanimlar } = await sbAdmin.from('premium_redemptions').select('code,user_id,redeemed_at');
    const sayac = new Map();
    for (const k of kullanimlar || []) sayac.set(k.code, (sayac.get(k.code) || 0) + 1);
    res.json({
      liste: (kodlar || []).map((k) => ({
        kod: k.code,
        gun: k.grants_days,
        maxKullanim: k.max_uses,
        kullanim: sayac.get(k.code) || 0,
        not: k.note || '',
        olusturma: k.created_at,
        olusturan: k.created_by,
        sonKullanma: k.expires_at,
        iptal: !!k.revoked_at,
        gecerli: kodGecerliMi(k, sayac.get(k.code) || 0).ok,
      })),
    });
  } catch (e) {
    if (tabloYokMu(e)) return tabloHatasi(res);
    safeError(res, e, 'Kodlar okunamadı.');
  }
});

router.post('/premium/kod', async (req, res) => {
  try {
    const adet = Math.min(Math.max(Number(req.body?.adet) || 1, 1), 50);
    const gun = Number(req.body?.gun);
    const maxUses = Math.max(Number(req.body?.maxKullanim) || 1, 1);
    const not = String(req.body?.not || '').slice(0, 200);
    const satirlar = [];
    for (let i = 0; i < adet; i += 1) {
      satirlar.push({
        code: kodUret(10),
        grants_days: Number.isFinite(gun) ? gun : 30,
        max_uses: maxUses,
        note: not,
        created_by: operator(req),
      });
    }
    const { data, error } = await sbAdmin.from('premium_codes').insert(satirlar).select('code');
    if (error) throw new Error(error.message);
    await kayit(req, 'kod-uret', null, `${satirlar.length} adet · ${satirlar[0].grants_days} gün · not: ${not}`);
    res.json({ ok: true, kodlar: (data || []).map((d) => d.code) });
  } catch (e) {
    if (tabloYokMu(e)) return tabloHatasi(res);
    safeError(res, e, 'Kod üretilemedi.');
  }
});

router.post('/premium/kod/:kod/iptal', async (req, res) => {
  try {
    const { error } = await sbAdmin.from('premium_codes')
      .update({ revoked_at: new Date().toISOString() })
      .eq('code', kodNormalize(req.params.kod));
    if (error) throw new Error(error.message);
    await kayit(req, 'kod-iptal', kodNormalize(req.params.kod), '');
    res.json({ ok: true });
  } catch (e) {
    if (tabloYokMu(e)) return tabloHatasi(res);
    safeError(res, e, 'Kod iptal edilemedi.');
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/haftalar — TÜM arşiv haftaları (dahil + DIŞLANAN)
// ---------------------------------------------------------------------------
// YAŞANAN SORU (kullanıcı, 2026-08-06): "50-51. haftalar neden yok?"
//
// Panelin hafta listesi karneden besleniyordu; karne ise YALNIZ başarıya
// sayılan (maç öncesi mühürlendiği doğrulanan) haftaları döndürür. Dışlanan
// hafta listede hiç görünmediği için "veri kayıp" gibi duruyordu. Oysa veri
// duruyor, yalnız BAŞARIYA SAYILMIYOR — ve bunun sebebi görünmeliydi.
//
// Bu uç, kaynağı `/api/scorecards/provenance` (kanıt kaydı) olan TAM listeyi
// döndürür: hangi hafta dahil, hangisi neden dışlandı. Yeni bir hesap YAPMAZ;
// var olan kanıt kaydını okunur hâle getirir.
const DISLAMA_SEBEBI = {
  no_sealed_snapshot: 'Mühürlü kayıt yok — o hafta anlık görüntü alınmamış.',
  late_lock: 'Mühür GEÇ atılmış: tahmin ilk maç başladıktan sonra kilitlenmiş.',
  not_persistent_archive: 'Yalnız geçici önbellekte — kalıcı arşivde kaydı yok.',
  backfilled: 'Sonradan doldurulmuş kayıt (geriye dönük).',
  demo: 'Demo/test kaydı.',
};

router.get('/haftalar', async (req, res) => {
  try {
    const [kanit, karne] = await Promise.all([
      fetch(`http://127.0.0.1:${process.env.PORT || 4000}/api/scorecards/provenance`)
        .then((r) => r.json()).catch(() => null),
      fetch(`http://127.0.0.1:${process.env.PORT || 4000}/api/scorecards/system`)
        .then((r) => r.json()).catch(() => null),
    ]);
    const basari = new Map();
    for (const w of (karne && karne.weeks) || []) basari.set(String(w.roundId), w);

    // Aynı hafta hem arşivde hem eski önbellekte olabilir; ARŞİV kaydı üstün
    // tutulur (kalıcı ve mühürlenebilir olan odur).
    const harita = new Map();
    for (const r of (kanit && kanit.records) || []) {
      const k = String(r.roundId);
      const onceki = harita.get(k);
      if (onceki && onceki.kaynak === 'archive' && r.source !== 'archive') continue;
      harita.set(k, {
        roundId: r.roundId,
        hafta: r.round,
        kaynak: r.source,
        dahil: r.isOfficialForward === true,
        tur: r.provenanceType,
        sebep: r.exclusionReason || null,
        sebepMetni: r.exclusionReason ? (DISLAMA_SEBEBI[r.exclusionReason] || r.exclusionReason) : null,
        ayrinti: Array.isArray(r.reasons) ? r.reasons : [],
        muhur: r.verificationHashShort || null,
        muhurZamani: r.lockedAt || null,
        ilkMac: r.firstMatchStartAt || null,
        resmiSonuc: r.officialResultCount ?? null,
      });
    }
    const liste = [...harita.values()]
      .map((h) => {
        const b = basari.get(String(h.roundId));
        return {
          ...h,
          kayit: b?.record || null,
          basari: b?.accuracy ?? null,
          durum: b?.status || null,
          macSayisi: b?.matchCount ?? null,
        };
      })
      .sort((a, b) => Number(b.roundId) - Number(a.roundId));

    res.json({
      liste,
      ozet: {
        toplam: liste.length,
        dahil: liste.filter((h) => h.dahil).length,
        dislanan: liste.filter((h) => !h.dahil).length,
      },
      not: 'Dışlanan hafta SİLİNMEZ ve gizlenmez; yalnız başarı hesabına katılmaz.',
    });
  } catch (e) {
    safeError(res, e, 'Hafta listesi okunamadı.');
  }
});

// ---------------------------------------------------------------------------
// SİNYAL KIRILIMI — "bu kriter/radar NEREDE işe yarıyor?"
// ---------------------------------------------------------------------------
// Kullanıcının fark ettiği örüntüyü ölçülebilir hâle getirir: aynı bülten
// sırasında, benzer oynanma yüzdeleriyle aynı sonucun çıkması.
// Hesap saf modülde (analysis/sinyalKirilim.js), veri toplama ayrı dosyada
// (analysis/sinyalToplama.js). Bu uç yalnız ikisini birleştirir.
router.get('/sinyaller', async (req, res) => {
  try {
    res.json(await sinyalKatalogu());
  } catch (e) { safeError(res, e, 'Sinyal listesi okunamadı.'); }
});

router.get('/sinyal-kirilim', async (req, res) => {
  try {
    const tur = String(req.query.tur || 'kriter');
    const key = String(req.query.key || '');
    if (tur !== 'master' && !key) return res.status(400).json({ error: 'Sinyal seçilmedi.' });

    const { kayitlar, kapsam } = await sinyalKayitlariniTopla({ tur, key });
    const kirilim = tamKirilim(kayitlar);

    // BENZERLİK: istenirse bu haftanın oynanma profili verilir ve geçmişte
    // benzeyen AYNI SIRADAKİ maçlar bulunur. Tahmin değil GÖZLEM.
    let benzer = null;
    const hedefNo = Number(req.query.sira);
    const h1 = Number(req.query.h1); const hX = Number(req.query.hx); const h2 = Number(req.query.h2);
    if (Number.isFinite(hedefNo) && [h1, hX, h2].every(Number.isFinite)) {
      benzer = benzerVakalar(kayitlar, { 1: h1, X: hX, 2: h2 }, {
        no: hedefNo,
        tolerans: Number(req.query.tolerans) || undefined,
      });
    }

    res.json({
      tur,
      key,
      kapsam,
      ...kirilim,
      benzer,
      uyari: kapsam.haftaDahil < 5
        ? `Yalnız ${kapsam.haftaDahil} hafta mühürlü ve sonuçlanmış — bu kadar az veride sıra bazlı yüzdeler yanıltıcıdır.`
        : null,
    });
  } catch (e) { safeError(res, e, 'Sinyal kırılımı hesaplanamadı.'); }
});

// ---------------------------------------------------------------------------
// GET /api/admin/kayitlar — denetim kaydı (kim ne yaptı)
// ---------------------------------------------------------------------------
router.get('/kayitlar', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
    const tur = String(req.query.tur || '').trim();
    let q = sbAdmin.from('admin_audit').select('*').order('at', { ascending: false }).limit(limit);
    if (tur) q = q.eq('action', tur);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    res.json({ liste: data || [] });
  } catch (e) {
    if (tabloYokMu(e)) return res.json({ liste: [], kurulmadi: true });
    safeError(res, e, 'Denetim kaydı okunamadı.');
  }
});

export default router;
