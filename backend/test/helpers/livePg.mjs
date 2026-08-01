// ---------------------------------------------------------------------------
// CANLI POSTGRESQL YARDIMCILARI — gerçek şema üstünde ölçüm
// ---------------------------------------------------------------------------
// Migration 007'deki trigger'ı, CHECK kısıtlarını ve tekillik kurallarını
// SQL'i OKUYARAK kanıtlayamayız; çalıştırmak gerekir. Bu dosya, o çalıştırmayı
// yapan testlerin ortak kurulumudur.
//
// NEDEN ORTAK DOSYA: aynı kurulum iki ayrı test dosyasına kopyalanırsa, şema
// kurulumu bir gün değiştiğinde biri güncellenir öteki unutulur — ve unutulan
// dosya "geçti" demeye devam eder. Kurulum tek yerde durur.
//
// ÇALIŞTIRMA: MIGRATION_TEST_DB_URL tanımlı değilse `atla` true döner ve bu
// yardımcıları kullanan testler ATLANIR. "Atlandı" GEÇTİ demek DEĞİLDİR.
//
//   MIGRATION_TEST_DB_URL='postgresql://kullanici:parola@127.0.0.1:5433/postgres' npm test

import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { migrationUygula } from '../../src/migrate/runner.js';

export const YONETIM_URL = process.env.MIGRATION_TEST_DB_URL;
export const atla = !YONETIM_URL;

const KLASOR = fileURLToPath(new URL('../../migrations/', import.meta.url));

let sayac = 0;

/**
 * Testin kendine ait, sıfırdan kurulmuş bir veritabanı döndürür.
 *
 * Her test İZOLE bir veritabanı alır: paylaşılan bir şemada bir testin
 * bıraktığı satır, sonraki testin sayımını sessizce bozardı. Veritabanı adına
 * `process.pid` girer, çünkü `node --test` her dosyayı ayrı süreçte çalıştırır
 * ve dosyalar aynı anda kurulum yapabilir.
 *
 * `auth.users` tablosu elle kurulur: Supabase'in kendi şeması burada yok, ama
 * 007'deki yabancı anahtarların bağlanacağı bir yer olmalı.
 *
 * @param {string} [onEk] veritabanı adı ön eki (dosyalar birbirine karışmasın)
 * @returns {Promise<string>} yeni veritabanının bağlantı adresi
 */
export async function veritabaniKur(onEk = 'mod_test') {
  const ad = `${onEk}_${process.pid}_${++sayac}`;
  const yonetim = new pg.Client({ connectionString: YONETIM_URL });
  await yonetim.connect();
  await yonetim.query(`drop database if exists ${ad}`);
  await yonetim.query(`create database ${ad}`);
  await yonetim.end();

  const url = new URL(YONETIM_URL);
  url.pathname = `/${ad}`;
  const dbUrl = url.toString();

  const c = new pg.Client({ connectionString: dbUrl });
  await c.connect();
  await c.query(`
    create schema if not exists auth;
    create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text);
  `);
  await c.end();

  const s = await migrationUygula({ klasor: KLASOR, env: { SUPABASE_DB_URL: dbUrl }, log: () => {} });
  assert.equal(s.ok, true, s.hata || 'migration uygulanamadı');
  return dbUrl;
}

/** Tek bağlantı üzerinde çalışan küçük bir yardımcı (her test kendi kapatır). */
export async function baglan(dbUrl) {
  const c = new pg.Client({ connectionString: dbUrl });
  await c.connect();
  return {
    q: (sql, p) => c.query(sql, p).then((r) => r.rows),
    kapat: () => c.end(),
  };
}

/** n kullanıcı üretir, kimliklerini döner. */
export async function kullanicilar(db, n) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const [r] = await db.q(`insert into auth.users (email) values ($1) returning id`, [`k${i}@ornek.test`]);
    out.push(r.id);
  }
  return out;
}

/** Bir yorumun gizlilik durumunu okur — trigger'ın ne yaptığını görmenin yolu. */
export const gizlilik = (db, id) => db
  .q(`select hidden_at, hidden_reason from public.comments where id = $1`, [id])
  .then((r) => r[0]);

/** Testlerin başında bir kez basılacak uyarı metnini üretir. */
export function atlamaUyarisi(neyinKanitlanmadigi) {
  return (
    '\n⚠️  CANLI TESTLER ATLANDI — MIGRATION_TEST_DB_URL tanımlı değil.\n' +
    `⚠️  ${neyinKanitlanmadigi}\n` +
    '⚠️  bu çalıştırmada KANITLANMADI.\n'
  );
}
