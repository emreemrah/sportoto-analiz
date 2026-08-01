// ---------------------------------------------------------------------------
// UYGULAMA SONRASI DOĞRULAMA — "çalıştı" demek yetmez, GERÇEKTEN oluştu mu?
// ---------------------------------------------------------------------------
// Migration'ın hatasız bitmesi, beklenen tabloların/trigger'ların/güvenlik
// kurallarının gerçekten var olduğunu KANITLAMAZ. Bu dosya, uygulamadan sonra
// veritabanına SALT-OKUNUR sorular sorar ve cevabı raporlar.
//
// BEKLENEN LİSTE ELLE YAZILMAZ: migration dosyalarının kendisinden türetilir.
// Böylece yeni bir migration eklendiğinde doğrulama kendiliğinden genişler;
// elle tutulan bir liste gibi sessizce eskiyemez.

import { olusturulanTablolar, rlsAcilanTablolar, olusturulanTriggerlar } from './sqlScan.js';

/** Şemanın snapshot değişmezliği — bu iki trigger ETKİN değilse sistem güvenli değildir. */
export const KRITIK_TRIGGERLAR = ['trg_snapshot_no_update', 'trg_snapshot_no_delete'];

/**
 * Migration dosyalarından beklenen şema nesnelerini türetir.
 * @param {{icerik:string}[]} dosyalar
 */
export function beklenenSema(dosyalar) {
  const tablolar = new Set();
  const rls = new Set();
  const triggerlar = new Set();
  for (const d of dosyalar) {
    for (const t of olusturulanTablolar(d.icerik)) tablolar.add(t);
    for (const t of rlsAcilanTablolar(d.icerik)) rls.add(t);
    for (const t of olusturulanTriggerlar(d.icerik)) triggerlar.add(t);
  }
  return {
    tablolar: [...tablolar].sort(),
    rls: [...rls].sort(),
    triggerlar: [...triggerlar].sort(),
  };
}

/**
 * Canlı veritabanına karşı SALT-OKUNUR doğrulama.
 * @param {{query:Function}} client bağlı bir PostgreSQL istemcisi
 * @param {{icerik:string}[]} dosyalar migration dosyaları
 * @returns {Promise<{ok:boolean, ozet:string, eksikler:string[], detay:object}>}
 */
export async function semayiDogrula(client, dosyalar) {
  const beklenen = beklenenSema(dosyalar);
  const eksikler = [];

  // 1) TABLOLAR — var mı?
  const { rows: tabloSatirlari } = await client.query(
    `select c.oid::regclass::text as tam_ad, c.relrowsecurity as rls_acik
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r' and n.nspname not in ('pg_catalog','information_schema')`,
  );
  const varOlan = new Map(tabloSatirlari.map((r) => [normalize(r.tam_ad), r.rls_acik]));

  for (const t of beklenen.tablolar) {
    if (!varOlan.has(t)) eksikler.push(`Tablo OLUŞMAMIŞ: ${t}`);
  }

  // 2) RLS — güvenlik kuralı gerçekten açık mı?
  for (const t of beklenen.rls) {
    if (!varOlan.has(t)) continue; // tablo eksikliği yukarıda raporlandı
    if (varOlan.get(t) !== true) eksikler.push(`RLS KAPALI (açık olmalıydı): ${t}`);
  }

  // 3) TRIGGER'LAR — var mı ve ETKİN mi? ('O' = etkin/origin)
  const { rows: triggerSatirlari } = await client.query(
    `select t.tgname, t.tgenabled, t.tgrelid::regclass::text as tablo
       from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
       join pg_namespace n on n.oid = c.relnamespace
      where not t.tgisinternal and n.nspname not in ('pg_catalog','information_schema')`,
  );
  const triggerMap = new Map(triggerSatirlari.map((r) => [r.tgname, r]));

  for (const tg of beklenen.triggerlar) {
    const bulunan = triggerMap.get(tg);
    if (!bulunan) { eksikler.push(`Trigger OLUŞMAMIŞ: ${tg}`); continue; }
    if (bulunan.tgenabled !== 'O') {
      eksikler.push(`Trigger DEVRE DIŞI (etkin olmalıydı): ${tg} · durum=${bulunan.tgenabled}`);
    }
  }

  // 4) KRİTİK: snapshot değişmezliği — ayrıca ve açıkça denetlenir.
  for (const tg of KRITIK_TRIGGERLAR) {
    const bulunan = triggerMap.get(tg);
    if (!bulunan || bulunan.tgenabled !== 'O') {
      eksikler.push(`KRİTİK — snapshot değişmezlik koruması etkin değil: ${tg}`);
    }
  }

  const detay = {
    beklenenTablo: beklenen.tablolar.length,
    olusanTablo: beklenen.tablolar.filter((t) => varOlan.has(t)).length,
    rlsAcik: beklenen.rls.filter((t) => varOlan.get(t) === true).length,
    beklenenRls: beklenen.rls.length,
    etkinTrigger: beklenen.triggerlar.filter((t) => triggerMap.get(t)?.tgenabled === 'O').length,
    beklenenTrigger: beklenen.triggerlar.length,
  };

  const ozet =
    `${detay.olusanTablo}/${detay.beklenenTablo} tablo · ` +
    `${detay.rlsAcik}/${detay.beklenenRls} tabloda RLS açık · ` +
    `${detay.etkinTrigger}/${detay.beklenenTrigger} trigger etkin`;

  return { ok: eksikler.length === 0, ozet, eksikler, detay };
}

/** `public.x` / `x` farkını tek biçime indirir. */
function normalize(tamAd) {
  const temiz = tamAd.replace(/"/g, '');
  return temiz.includes('.') ? temiz : `public.${temiz}`;
}
