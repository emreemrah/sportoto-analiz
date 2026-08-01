// ---------------------------------------------------------------------------
// AÇILIŞ KAPISI — backend, şeması doğrulanmadan iş yapmaya başlamaz.
// ---------------------------------------------------------------------------
// server.js bunu açılışta BİR KEZ çağırır. Dönen `ok` false ise worker ve
// scheduler'lar BAŞLATILMAZ (fail-closed).
//
// KARAR TABLOSU
// ─────────────────────────────────────────────────────────────────────────────
// NODE_ENV=test                      → atlanır (testler kendi veritabanını kurar)
// SUPABASE_DB_URL var                → migration UYGULANIR + şema DOĞRULANIR
//                                      · hata → ok:false (backend iş yapmaz)
// SUPABASE_DB_URL yok, Supabase yok  → geliştirme/dosya modu; yapılacak şey yok
// SUPABASE_DB_URL yok, Supabase VAR  → EKSİK YAPILANDIRMA:
//                                      · ÜRETİMDE (NODE_ENV=production) ya da
//                                        MIGRATIONS_REQUIRED=1 → ok:false.
//                                        Worker'lar BAŞLAMAZ.
//                                      · geliştirmede → yüksek sesle uyarılır,
//                                        çalışmaya devam edilir.
//
// Neden üretimde kapı KAPALI: aşağıdaki servislerin hepsi veritabanına YAZAR.
// Şema güncel olmadan yazmak, doğrulanmamış bir şemaya gerçek müşteri verisi
// yazmak demektir. "Yapılandırılmamış" ile "başarısız" farklı şeylerdir, ama
// üretimde ikisinin de sonucu aynıdır: bu backend iş yapmamalıdır.
//
// Neden geliştirmede kapı AÇIK: geliştiricinin makinesinde bağlantı hiç
// tanımlanmamışken backend'i öldürmek, bugün çalışan bir kurulumu sessizce
// durdururdu. Orada durum yüksek sesle bildirilir ve /api/health'ten okunur.
// (Geliştirmede de katı davranış isteniyorsa: MIGRATIONS_REQUIRED=1.)

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { migrationUygula } from './runner.js';
import { semayiDogrula } from './verify.js';
import { dosyalariOku } from './plan.js';
import { baglantiVarMi } from './dbUrl.js';

const BU_KLASOR = dirname(fileURLToPath(import.meta.url));
export const MIGRATION_KLASORU = join(BU_KLASOR, '..', '..', 'migrations');

/** Son çalışmanın durumu — /api/health bunu gösterir (gizli bilgi taşımaz). */
let sonDurum = { durum: 'baslamadi', ok: null, uygulanan: [], zaman: null, dogrulama: null };

export function migrationDurumu() {
  return { ...sonDurum };
}

/**
 * Açılışta çağrılır.
 * @returns {Promise<{ok:boolean, durum:string, uygulanan:string[], hata?:string}>}
 */
export async function acilistaMigrationCalistir({
  env = process.env,
  log = console.log,
  klasor = MIGRATION_KLASORU,
} = {}) {
  const bitir = (sonuc) => {
    sonDurum = {
      durum: sonuc.durum,
      ok: sonuc.ok,
      uygulanan: sonuc.uygulanan || [],
      zaman: new Date().toISOString(),
      dogrulama: sonuc.dogrulama ? { ok: sonuc.dogrulama.ok, ozet: sonuc.dogrulama.ozet } : null,
    };
    return sonuc;
  };

  if (env.NODE_ENV === 'test') {
    return bitir({ ok: true, durum: 'test-atlandi', uygulanan: [] });
  }

  const supabaseYapilandirilmis = !!(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY);

  if (!baglantiVarMi(env)) {
    if (!supabaseYapilandirilmis) {
      log('ℹ️  Supabase yapılandırılmamış — geliştirme/dosya modunda çalışılıyor, migration gerekmiyor.');
      return bitir({ ok: true, durum: 'gerekmiyor', uygulanan: [] });
    }
    // Supabase var ama doğrudan veritabanı bağlantısı yok: şema OTOMATİK
    // güncellenemez. Bu sessizce geçilmez.
    const uretim = env.NODE_ENV === 'production';
    const zorunlu = uretim || env.MIGRATIONS_REQUIRED === '1' || env.MIGRATIONS_REQUIRED === 'true';
    const isaret = zorunlu ? '⛔' : '⚠️ ';
    log('');
    log(`${isaret} ───────────────────────────────────────────────────────────────`);
    log(`${isaret} OTOMATİK MIGRATION KAPALI — SUPABASE_DB_URL tanımlı değil.`);
    log(`${isaret} Supabase REST arayüzü (SUPABASE_SECRET_KEY) tablo/trigger/güvenlik`);
    log(`${isaret} kuralı OLUŞTURAMAZ; bunun için doğrudan PostgreSQL bağlantısı şart.`);
    log(`${isaret} Bekleyen migration varsa UYGULANMADI ve şema doğrulanmadı.`);
    if (zorunlu) {
      log('⛔ Bu bir ÜRETİM kurulumu — backend iş yapmayacak (worker/scheduler yok).');
      log('⛔ Çözüm: Supabase → Project Settings → Database → Connection string →');
      log('⛔ session/direct (5432) bağlantısını SUPABASE_DB_URL olarak tanımla.');
    } else {
      log('⚠️  Geliştirme ortamı: backend çalışmaya devam ediyor.');
      log('⚠️  Katı davranış için MIGRATIONS_REQUIRED=1.');
    }
    log(`${isaret} ───────────────────────────────────────────────────────────────`);
    log('');
    return bitir({
      ok: !zorunlu,
      durum: 'yapilandirilmamis',
      uygulanan: [],
      hata: zorunlu
        ? 'Şema güncellenemez: SUPABASE_DB_URL tanımlı değil (üretimde zorunludur).'
        : undefined,
    });
  }

  const sonuc = await migrationUygula({
    klasor,
    env,
    log,
    dogrulayici: semayiDogrula,
  });

  if (!sonuc.ok) {
    log('');
    log('⛔ ───────────────────────────────────────────────────────────────');
    log('⛔ VERİTABANI HAZIR DEĞİL — backend iş yapmayacak.');
    log(`⛔ Sebep: ${sonuc.hata || sonuc.durum}`);
    log('⛔ Veritabanında yarım bir değişiklik BIRAKILMADI.');
    log('⛔ ───────────────────────────────────────────────────────────────');
    log('');
  }
  return bitir(sonuc);
}

export { dosyalariOku };
