// ---------------------------------------------------------------------------
// CANLI MIGRATION TESTLERİ — GERÇEK PostgreSQL'e karşı çalışır.
// ---------------------------------------------------------------------------
// Buradaki garantiler statik olarak KANITLANAMAZ; gerçek bir veritabanı, gerçek
// bir transaction ve gerçek eşzamanlılık gerektirir:
//
//   · İki backend aynı anda açılırsa migration İKİ KEZ uygulanmaz.
//   · Hata olursa veritabanı YARIM kalmaz (tam rollback).
//   · Uygulanmış bir dosya değiştirilirse sistem durur, hiçbir şey uygulamaz.
//   · Tablolar, trigger'lar ve RLS GERÇEKTEN oluşur.
//   · Şema elle uygulanmışken motor ilk kez çalışırsa KİLİTLİ KAYITLARA
//     dokunmaz (tek bayt bile değişmez).
//
// ÇALIŞTIRMA: MIGRATION_TEST_DB_URL tanımlıysa çalışır, yoksa ATLANIR.
//   MIGRATION_TEST_DB_URL=postgresql://postgres:parola@127.0.0.1:5433/postgres npm test
//
// DÜRÜSTLÜK NOTU: "atlandı" ≠ "geçti". Bağlantı yoksa bu dosya hiçbir şey
// kanıtlamaz ve bunu açıkça yazar.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { migrationUygula, DEFTER } from '../src/migrate/runner.js';
import { semayiDogrula } from '../src/migrate/verify.js';

const YONETIM_URL = process.env.MIGRATION_TEST_DB_URL;
const KLASOR = new URL('../migrations/', import.meta.url).pathname;
const atla = !YONETIM_URL;

if (atla) {
  console.warn(
    '\n⚠️  CANLI MIGRATION TESTLERİ ATLANDI — MIGRATION_TEST_DB_URL tanımlı değil.\n' +
    '⚠️  "Atlandı" GEÇTİ demek DEĞİLDİR: eşzamanlılık, rollback ve şema\n' +
    '⚠️  doğrulaması bu çalıştırmada KANITLANMADI.\n',
  );
}

// ---------------------------------------------------------------------------
// BEKLENEN MIGRATION LİSTESİ — elle yazılmaz, klasörden TÜRETİLİR.
// ---------------------------------------------------------------------------
// Önce elle yazılıyordu (`['001'...'006']`, sekiz ayrı yerde). Yeni bir
// migration eklendiğinde testlerin sekizi birden, gerçek bir kusur olmadığı
// hâlde kırmızıya dönüyordu. Böyle bir test, kusuru değil takvimi ölçer;
// sürekli "beklenen"i güncellemek de testin gördüğünü değil, bizim ne görmek
// istediğimizi yazmaya alıştırır.
//
// AMA türetme TEK BAŞINA yetmez: bir dosya silinirse ya da yeniden
// adlandırılırsa türetilmiş liste sessizce KÜÇÜLÜR ve testler yine yeşil kalır.
// O yüzden yayına çıkmış sürümler ayrıca donduruluyor (aşağıdaki ÇEKİRDEK) ve
// türetilmiş listenin bununla BAŞLADIĞI ayrı bir testle ölçülüyor.
const surumler = (klasor) => readdirSync(klasor)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => (f.match(/^(\d{3,})_/) || [])[1])
  .filter(Boolean)
  .sort();

/** Klasördeki bütün migration sürümleri, artan sırada. */
const TUM = surumler(KLASOR);

/**
 * Yayına çıkmış sürümler. Bu liste ASLA kısaltılmaz; yalnız uzar.
 * Türetilmiş listenin başlangıcı bununla birebir aynı olmalıdır.
 */
const CEKIRDEK = ['001', '002', '003', '004', '005', '006', '007'];

/**
 * Klasörde BULUNMAYAN ilk sürüm numarası. Sahte/bozuk migration üreten testler
 * bunu kullanır; sabit bir numara (ör. '007') gerçek bir dosyayla çakışırdı ve
 * test, ölçmek istediği şeyi değil "aynı sürüm iki kez" hatasını ölçerdi.
 */
const SONRAKI = String(Number(TUM.at(-1)) + 1).padStart(3, '0');

// Bu test veritabanı GEREKTİRMEZ; bağlantı olmasa da çalışır ve anlamlıdır.
test('yayına çıkmış migration lar klasörde DURUYOR (silinmemiş, adı değişmemiş)', () => {
  assert.deepEqual(
    TUM.slice(0, CEKIRDEK.length), CEKIRDEK,
    'yayına çıkmış bir migration silinemez, yeniden adlandırılamaz, numarası değiştirilemez',
  );
  assert.ok(TUM.length >= CEKIRDEK.length, 'klasörde çekirdekten az dosya var');
});

let sayac = 0;
/** Her test kendi izole veritabanını kurar (testler birbirini etkilemez). */
async function veritabaniKur() {
  const ad = `mig_test_${process.pid}_${++sayac}`;
  const yonetim = new pg.Client({ connectionString: YONETIM_URL });
  await yonetim.connect();
  await yonetim.query(`drop database if exists ${ad}`);
  await yonetim.query(`create database ${ad}`);
  await yonetim.end();

  const url = new URL(YONETIM_URL);
  url.pathname = `/${ad}`;
  const dbUrl = url.toString();

  // Supabase benzeri asgari zemin: migration'lar auth.users'a FK verir.
  const c = new pg.Client({ connectionString: dbUrl });
  await c.connect();
  await c.query(`
    create schema if not exists auth;
    create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text);
  `);
  await c.end();
  return { dbUrl, ad };
}

const sessiz = () => {};
const uygula = (dbUrl, ek = {}) =>
  migrationUygula({ klasor: KLASOR, env: { SUPABASE_DB_URL: dbUrl }, log: sessiz, ...ek });

const sorgu = async (dbUrl, sql, p) => {
  const c = new pg.Client({ connectionString: dbUrl });
  await c.connect();
  try { return (await c.query(sql, p)).rows; } finally { await c.end(); }
};

// ═══════════════════════════════════════════════════════════════════════════
test('bütün migration lar sırayla uygulanır; tablolar, RLS ve trigger lar GERÇEKTEN oluşur', { skip: atla }, async () => {
  const { dbUrl } = await veritabaniKur();
  const s = await uygula(dbUrl, { dogrulayici: semayiDogrula });

  assert.equal(s.ok, true, s.hata || '');
  assert.deepEqual(s.uygulanan, TUM, 'artan sırada, hiçbiri atlanmadan');
  assert.equal(s.dogrulama.ok, true, (s.dogrulama?.eksikler || []).join(' | '));
  assert.equal(s.dogrulama.detay.olusanTablo, s.dogrulama.detay.beklenenTablo);
  assert.equal(s.dogrulama.detay.rlsAcik, s.dogrulama.detay.beklenenRls);
  assert.equal(s.dogrulama.detay.etkinTrigger, s.dogrulama.detay.beklenenTrigger);

  // Değişmezlik koruması gerçekten ETKİN mi?
  const tg = await sorgu(dbUrl,
    `select tgname, tgenabled from pg_trigger where tgname in ('trg_snapshot_no_update','trg_snapshot_no_delete')`);
  assert.equal(tg.length, 2, 'snapshot değişmezlik trigger ları var');
  assert.ok(tg.every((r) => r.tgenabled === 'O'), 'ikisi de ETKİN');

  // Defter kaydı: ad, sıra, zaman, bütünlük mührü.
  const defter = await sorgu(dbUrl, `select version, filename, checksum, applied_at, applied_ms, applied_by, seq from ${DEFTER} order by seq`);
  assert.equal(defter.length, TUM.length);
  assert.deepEqual(defter.map((r) => r.version), TUM, 'sıra deftere yazıldı');
  assert.ok(defter.every((r) => /^[0-9a-f]{64}$/.test(r.checksum)), 'her satırda dosya mührü');
  assert.ok(defter.every((r) => r.applied_at instanceof Date), 'her satırda uygulama zamanı');
  assert.ok(defter.every((r) => r.applied_by && r.applied_by.length > 0), 'her satırda uygulayan kopya');

  // Defter RLS ile korunuyor (publishable/anon anahtar okuyamaz).
  const rls = await sorgu(dbUrl, `select relrowsecurity from pg_class where oid = '${DEFTER}'::regclass`);
  assert.equal(rls[0].relrowsecurity, true, 'defterde RLS açık');
});

test('ikinci çalıştırma hiçbir şey uygulamaz (tek kez kuralı)', { skip: atla }, async () => {
  const { dbUrl } = await veritabaniKur();
  await uygula(dbUrl);
  const s = await uygula(dbUrl, { dogrulayici: semayiDogrula });
  assert.equal(s.durum, 'guncel');
  assert.deepEqual(s.uygulanan, []);
  const defter = await sorgu(dbUrl, `select count(*)::int as n from ${DEFTER}`);
  assert.equal(defter[0].n, TUM.length, 'defterde çift kayıt yok');
});

// ═══════════════════════════════════════════════════════════════════════════
// EŞZAMANLILIK — kullanıcının açık şartı:
// "eş zamanlı iki backend aynı migration'ı uygulayamamalı"
test('İKİ backend AYNI ANDA açılırsa migration bir kez uygulanır', { skip: atla }, async () => {
  const { dbUrl } = await veritabaniKur();

  // Gerçekten eş zamanlı: ikisi de aynı anda başlar, kilit için yarışırlar.
  const [a, b] = await Promise.all([uygula(dbUrl), uygula(dbUrl)]);

  assert.equal(a.ok, true, a.hata || '');
  assert.equal(b.ok, true, b.hata || '');

  // Biri uygular, diğeri "zaten güncel" bulur. Hangisinin kazandığı önemsiz.
  const uygulayan = [a, b].filter((r) => r.uygulanan.length > 0);
  assert.equal(uygulayan.length, 1, 'YALNIZ BİR kopya uygulamış olmalı');
  assert.deepEqual(uygulayan[0].uygulanan, TUM);

  const bekleyen = [a, b].find((r) => r.uygulanan.length === 0);
  assert.equal(bekleyen.durum, 'guncel', 'ikinci kopya beklemiş ve güncel bulmuştur');

  // Defterde her sürümden TEK satır (primary key zaten korur; yine de ölçülür).
  const defter = await sorgu(dbUrl, `select version, count(*)::int as n from ${DEFTER} group by version order by version`);
  assert.equal(defter.length, TUM.length);
  assert.ok(defter.every((r) => r.n === 1), 'hiçbir migration iki kez yazılmamış');

  // İki kez uygulanmış olsaydı 002'deki katalog kaydı çiftlenirdi.
  const kat = await sorgu(dbUrl, `select count(*)::int as n from public.analysis_methodologies where version = 'master-analysis-1.0.0'`);
  assert.equal(kat[0].n, 1, 'veri çiftlenmemiş');
});

test('BEŞ backend aynı anda açılsa bile sonuç aynıdır', { skip: atla }, async () => {
  const { dbUrl } = await veritabaniKur();
  const sonuclar = await Promise.all([1, 2, 3, 4, 5].map(() => uygula(dbUrl)));
  assert.ok(sonuclar.every((r) => r.ok), sonuclar.find((r) => !r.ok)?.hata || '');
  assert.equal(sonuclar.filter((r) => r.uygulanan.length > 0).length, 1, 'yalnız bir kopya uyguladı');
  const defter = await sorgu(dbUrl, `select count(*)::int as n from ${DEFTER}`);
  assert.equal(defter[0].n, TUM.length);
});

// ═══════════════════════════════════════════════════════════════════════════
// YARIM DURUM YOK
test('bir migration hata verirse veritabanı YARIM kalmaz', { skip: atla }, async () => {
  const { dbUrl } = await veritabaniKur();

  // Gerçek dosyaların kopyası + sonuna bozuk bir migration.
  const gecici = mkdtempSync(join(tmpdir(), 'mig-'));
  cpSync(KLASOR, gecici, { recursive: true });
  const bozuk = `${SONRAKI}_bozuk.sql`;
  writeFileSync(join(gecici, bozuk), [
    'create table public.yarim_kalmali (a int);',
    'create index idx_yarim on public.yarim_kalmali (a);',
    'select bu_fonksiyon_yok();', // ← burada patlar
  ].join('\n'));

  const s = await migrationUygula({ klasor: gecici, env: { SUPABASE_DB_URL: dbUrl }, log: sessiz });

  assert.equal(s.ok, false);
  assert.equal(s.durum, 'uygulama-hatasi');
  assert.deepEqual(s.uygulanan, TUM, 'öncekiler kaldı');
  assert.match(s.hata, new RegExp(bozuk.replace('.', '\\.')));

  // Bozuk dosyanın İLK iki ifadesi başarılıydı — ama tamamı geri alınmalı.
  const tablo = await sorgu(dbUrl, `select to_regclass('public.yarim_kalmali') as t`);
  assert.equal(tablo[0].t, null, 'hatalı migration in yarattığı tablo GERİ ALINDI');

  // Defterde bozuk sürüm YOK; yani "uygulandı" diye işaretlenmedi.
  const defter = await sorgu(dbUrl, `select version from ${DEFTER} order by version`);
  assert.deepEqual(defter.map((r) => r.version), TUM);
});

test('hata sonrası tekrar çalıştırma kaldığı yerden dener, öncekileri tekrarlamaz', { skip: atla }, async () => {
  const { dbUrl } = await veritabaniKur();
  const gecici = mkdtempSync(join(tmpdir(), 'mig-'));
  cpSync(KLASOR, gecici, { recursive: true });
  const bozuk = `${SONRAKI}_bozuk.sql`;
  writeFileSync(join(gecici, bozuk), 'select bu_fonksiyon_yok();');

  await migrationUygula({ klasor: gecici, env: { SUPABASE_DB_URL: dbUrl }, log: sessiz });
  const s = await migrationUygula({ klasor: gecici, env: { SUPABASE_DB_URL: dbUrl }, log: sessiz });

  assert.equal(s.ok, false);
  assert.deepEqual(s.uygulanan, [], 'daha önce başarılı olanlar TEKRAR uygulanmadı');
  assert.match(s.hata, new RegExp(bozuk.replace('.', '\\.')), 'yalnız bozuk olan yeniden denendi');
});

// ═══════════════════════════════════════════════════════════════════════════
// BÜTÜNLÜK
test('uygulanmış bir dosya sonradan değiştirilirse sistem DURUR', { skip: atla }, async () => {
  const { dbUrl } = await veritabaniKur();
  const gecici = mkdtempSync(join(tmpdir(), 'mig-'));
  cpSync(KLASOR, gecici, { recursive: true });

  const ilk = await migrationUygula({ klasor: gecici, env: { SUPABASE_DB_URL: dbUrl }, log: sessiz });
  assert.equal(ilk.ok, true);

  // Uygulanmış bir dosyayı değiştir (tek bir yorum satırı bile yeter).
  const yol = join(gecici, '003_scorecard_provenance.sql');
  writeFileSync(yol, readFileSync(yol, 'utf8') + '\n-- sonradan eklendi\n');

  // Yeni bir migration da eklendi: bütünlük hatası varken O DA uygulanmamalı.
  writeFileSync(join(gecici, `${SONRAKI}_yeni.sql`), 'create table public.uygulanmamali (a int);');

  const s = await migrationUygula({ klasor: gecici, env: { SUPABASE_DB_URL: dbUrl }, log: sessiz });
  assert.equal(s.ok, false);
  assert.equal(s.durum, 'butunluk-hatasi');
  assert.match(s.hata, /DEĞİŞMİŞ/);
  assert.deepEqual(s.uygulanan, []);

  const tablo = await sorgu(dbUrl, `select to_regclass('public.uygulanmamali') as t`);
  assert.equal(tablo[0].t, null, 'bütünlük hatası varken HİÇBİR ŞEY uygulanmaz');
});

// Gerçek senaryo: bir sürümde 005 başka bir dalda kalmış, 006 yayına çıkmış.
// Sonra 005 merge edilir. Numarası uygulanmışların ALTINDA kaldığı için sıra
// bozulur. (Sayılar üç haneli olduğundan bu ancak ATLANMIŞ bir numarayla olur;
// test o boşluğu birebir kurar.)
test('araya geriye dönük migration sokulursa sistem DURUR', { skip: atla }, async () => {
  const { dbUrl } = await veritabaniKur();
  const gecici = mkdtempSync(join(tmpdir(), 'mig-'));
  writeFileSync(join(gecici, '001_ilk.sql'), 'create table public.ilk (a int);');
  writeFileSync(join(gecici, '003_ucuncu.sql'), 'create table public.ucuncu (a int);');

  const ilk = await migrationUygula({ klasor: gecici, env: { SUPABASE_DB_URL: dbUrl }, log: sessiz });
  assert.equal(ilk.ok, true, ilk.hata || '');
  assert.deepEqual(ilk.uygulanan, ['001', '003'], '002 yokken 001 ve 003 uygulanır');

  // 003 uygulanmışken araya 002 sokuluyor.
  writeFileSync(join(gecici, '002_sonradan.sql'), 'create table public.sonradan (a int);');
  const s = await migrationUygula({ klasor: gecici, env: { SUPABASE_DB_URL: dbUrl }, log: sessiz });

  assert.equal(s.ok, false);
  assert.equal(s.durum, 'butunluk-hatasi');
  assert.match(s.hata, /geriye dönük|sıradaki numara/i);
  assert.deepEqual(s.uygulanan, []);

  const t = await sorgu(dbUrl, `select to_regclass('public.sonradan') as t`);
  assert.equal(t[0].t, null, 'sırası bozuk dosya UYGULANMAZ');
});

// Bu davranış bir test yazılırken keşfedildi: `005a_arada.sql` gibi kurala
// uymayan bir ad, motor veritabanına BAĞLANMADAN önce yakalanır. Sessizce
// atlanması, bir migration'ın hiç çalışmaması demek olurdu — o yüzden durur.
test('kurala uymayan dosya adı varken HİÇBİR migration uygulanmaz', { skip: atla }, async () => {
  const { dbUrl } = await veritabaniKur();
  const gecici = mkdtempSync(join(tmpdir(), 'mig-'));
  cpSync(KLASOR, gecici, { recursive: true });
  writeFileSync(join(gecici, '005a_arada.sql'), 'create table public.arada (a int);');

  const s = await migrationUygula({ klasor: gecici, env: { SUPABASE_DB_URL: dbUrl }, log: sessiz });
  assert.equal(s.ok, false);
  assert.equal(s.durum, 'dosya-hatasi');
  assert.match(s.hata, /dosya adı/i);
  assert.deepEqual(s.uygulanan, []);

  // Bağlantı bile açılmadığı için veritabanı el değmemiş olmalı.
  const d = await sorgu(dbUrl, `select to_regclass('${DEFTER}') as t`);
  assert.equal(d[0].t, null, 'defter bile oluşturulmaz — hiçbir şeye dokunulmaz');
});

// ═══════════════════════════════════════════════════════════════════════════
// KİLİTLİ KAYITLARIN KORUNMASI — projenin en sert kuralı:
// "Eski kayıt silinmemeli ve kilitli snapshot içeriği değiştirilmemeli."
//
// Üretimdeki durum: 001–005 Supabase SQL Editor'a ELLE yapıştırılmış, defter
// yok. Motor ilk açılışta bütün dosyaları "bekleyen" görür ve TEKRAR çalıştırır.
// Bu testin sorusu: o tekrar, kilitli snapshot'lara dokunur mu?
test('elle uygulanmış şema deftere alınırken KİLİTLİ KAYITLAR değişmez', { skip: atla }, async () => {
  const { dbUrl } = await veritabaniKur();
  const c = new pg.Client({ connectionString: dbUrl });
  await c.connect();

  // 1) 001 ve 002 "elle" uygulanır (SQL Editor'daki gibi — defter TUTULMAZ).
  for (const f of ['001_bulletin_archive.sql', '002_master_analysis.sql']) {
    await c.query(readFileSync(KLASOR + f, 'utf8'));
  }

  // 2) Uygulama çalışır, gerçek kilitli kayıtlar birikir.
  await c.query(`
    insert into public.bulletins (id, round_id, season, week_name, status, first_match_start_at, freeze_at, locked_at)
    values ('b-1478', 1478, '2025-2026', '1478. Hafta', 'completed',
            '2026-03-14 14:00+00', '2026-03-14 12:00+00', '2026-03-14 12:00+00'),
           ('b-1479', 1479, '2025-2026', '1479. Hafta', 'completed',
            '2026-03-21 14:00+00', '2026-03-21 12:00+00', '2026-03-21 12:00+00');
    insert into public.bulletin_snapshots
      (id, bulletin_id, schema_version, engine_version, locked_at, data_observed_at, late, immutable, snapshot_payload, payload_hash)
    values ('s-1478', 'b-1478', 'v1', 'user-engine-1.0.0',
            '2026-03-14 12:00+00', '2026-03-14 11:30+00', false, true,
            '{"secimler":[{"no":1,"secim":"1"}]}'::jsonb, 'sha256:aaaa'),
           ('s-1479', 'b-1479', 'v1', 'user-engine-1.0.0',
            '2026-03-21 15:00+00', '2026-03-21 11:30+00', true, true,
            '{"secimler":[{"no":1,"secim":"X"}]}'::jsonb, 'sha256:bbbb');
  `);

  // 3) 003–005 de "elle" uygulanır → mevcut kayıtlar sınıflandırılır.
  for (const f of ['003_scorecard_provenance.sql', '004_legacy_isolation.sql', '005_history_dna.sql']) {
    await c.query(readFileSync(KLASOR + f, 'utf8').replace(/^\\set .*$/m, ''));
  }

  const defterYok = await c.query(`select to_regclass('${DEFTER}') as t`);
  assert.equal(defterYok.rows[0].t, null, 'başlangıç şartı: defter YOK (üretimdeki durum)');

  // TAM parmak izi: herhangi bir kolonda tek bit değişirse özet değişir.
  const PARMAK = `select
      (select count(*) from public.bulletin_snapshots) as n,
      md5(coalesce((select string_agg(x.s,'|' order by x.s)
                      from (select t::text as s from public.bulletin_snapshots t) x),'')) as snap,
      md5(coalesce((select string_agg(x.s,'|' order by x.s)
                      from (select t::text as s from public.bulletins t) x),'')) as bul`;
  const once = (await c.query(PARMAK)).rows[0];
  const siniflandirmaOnce = (await c.query(
    'select id, provenance_type, is_official_forward, exclusion_reason from public.bulletin_snapshots order by id')).rows;
  await c.end();

  assert.equal(siniflandirmaOnce[0].provenance_type, 'official_forward', 'kanıtı tam olan resmî sayıldı');
  assert.equal(siniflandirmaOnce[1].provenance_type, 'late_unverified', 'geç kilitlenen resmî SAYILMADI');

  // 4) Motor İLK KEZ çalışır: defter boş, bütün dosyaları uygulayacak.
  const s = await uygula(dbUrl, { dogrulayici: semayiDogrula });
  assert.equal(s.ok, true, s.hata || '');
  assert.deepEqual(s.uygulanan, TUM, 'hepsi deftere alındı');
  assert.equal(s.dogrulama.ok, true);

  // 5) ÖLÇÜM: kilitli kayıtlar değişti mi?
  const c2 = new pg.Client({ connectionString: dbUrl });
  await c2.connect();
  const sonra = (await c2.query(PARMAK)).rows[0];
  const siniflandirmaSonra = (await c2.query(
    'select id, provenance_type, is_official_forward, exclusion_reason from public.bulletin_snapshots order by id')).rows;
  await c2.end();

  assert.equal(sonra.n, once.n, 'kayıt SAYISI değişmedi — hiçbir şey silinmedi/eklenmedi');
  assert.equal(sonra.snap, once.snap, 'KİLİTLİ SNAPSHOT İÇERİĞİ tek bayt bile değişmedi');
  assert.equal(sonra.bul, once.bul, 'bülten kayıtları değişmedi');
  assert.deepEqual(siniflandirmaSonra, siniflandirmaOnce, 'resmî karne sınıflandırması korundu');
});

// ═══════════════════════════════════════════════════════════════════════════
// GİZLİLİK — bağlantı bilgisi hata metnine sızmaz.
test('bağlantı hatasında parola ve sunucu adresi sızmaz', { skip: atla }, async () => {
  const sahte = 'postgresql://kullanici:CokGizliParola9@yok.ornek.gecersiz:5432/db';
  const s = await migrationUygula({ klasor: KLASOR, env: { SUPABASE_DB_URL: sahte }, log: sessiz });
  assert.equal(s.ok, false);
  const hepsi = [s.hata, ...s.mesajlar].join('\n');
  assert.ok(!hepsi.includes('CokGizliParola9'), 'parola sızmaz');
  assert.ok(!hepsi.includes('yok.ornek.gecersiz'), 'sunucu adresi sızmaz');
});

// ═══════════════════════════════════════════════════════════════════════════
// DOĞRULAMA gerçekten denetliyor mu? (Testin kendisi de sınanır.)
test('doğrulama, eksik trigger ı yakalar (yanlış "tamam" demez)', { skip: atla }, async () => {
  const { dbUrl } = await veritabaniKur();
  await uygula(dbUrl);

  // Değişmezlik koruması dışarıdan devre dışı bırakılırsa doğrulama BUNU görmeli.
  await sorgu(dbUrl, 'alter table public.bulletin_snapshots disable trigger trg_snapshot_no_update');
  const s = await uygula(dbUrl, { dogrulayici: semayiDogrula });

  assert.equal(s.ok, false, 'şema bozukken "hazır" denmez');
  assert.equal(s.durum, 'dogrulama-hatasi');
  assert.match(s.hata, /trg_snapshot_no_update/);
  assert.match(s.hata, /KRİTİK/, 'snapshot değişmezliği KRİTİK olarak raporlanır');
});
