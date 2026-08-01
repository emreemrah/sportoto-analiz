// ---------------------------------------------------------------------------
// SQL TARAYICI TESTLERİ — veritabanı GEREKTİRMEZ (saf mantık).
// ---------------------------------------------------------------------------
// Tarayıcının işi kritiktir: bir ifadeyi yanlış yerden bölerse ya da bir
// BEGIN'i kaçırırsa, migration yarım uygulanabilir. Bu yüzden sınır durumları
// tek tek denetlenir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  ifadeleriAyir, calistirilacakIfadeler, ifadeTuru, cikarYorum,
  olusturulanTablolar, rlsAcilanTablolar, olusturulanTriggerlar,
} from '../src/migrate/sqlScan.js';

const KLASOR = new URL('../migrations/', import.meta.url).pathname;
const oku = (f) => readFileSync(KLASOR + f, 'utf8');
const sqlDosyalari = readdirSync(KLASOR).filter((f) => f.endsWith('.sql')).sort();

test('noktalı virgül metin/tanımlayıcı içindeyse ifadeyi BÖLMEZ', () => {
  const sql = `select 'a;b' as x, "kolon;adi" from t; select 2;`;
  const i = ifadeleriAyir(sql);
  assert.equal(i.length, 2);
  assert.ok(i[0].metin.includes("'a;b'"), 'metin içindeki ; korunur');
});

test('dolar-tırnak gövdesindeki BEGIN/END üst seviye sayılmaz', () => {
  const sql = `
create function f() returns trigger as $$
begin
  if true then raise exception 'olmaz'; end if;
  return null;
end;
$$ language plpgsql;
select 1;`;
  const { ifadeler, atlanan } = calistirilacakIfadeler(sql);
  assert.equal(atlanan.length, 0, 'gövdedeki begin/end ATLANMAZ');
  assert.equal(ifadeler.length, 2, 'fonksiyon tek parça kalır');
  assert.ok(ifadeler[0].metin.includes('language plpgsql'));
});

test('iç içe blok yorumu doğru kapanır', () => {
  const sql = `/* dış /* iç */ hâlâ yorum */ select 1;`;
  const i = ifadeleriAyir(sql);
  assert.equal(i.length, 1);
  assert.equal(cikarYorum(sql).trim(), 'select 1;');
});

test('üst seviye transaction kontrolü tanınır, END IF ile karıştırılmaz', () => {
  assert.equal(ifadeTuru('begin;'), 'begin');
  assert.equal(ifadeTuru('BEGIN'), 'begin');
  assert.equal(ifadeTuru('commit;'), 'commit');
  assert.equal(ifadeTuru('  -- yorum\n  start transaction;'), 'begin');
  assert.equal(ifadeTuru('select 1;'), null);
  assert.equal(ifadeTuru('create table t (a int);'), null);
});

// ——— psql meta-komutları ———
// 005_history_dna.sql'in 27. satırındaki `\set ON_ERROR_STOP on` sunucuya
// gönderilirse migration `syntax error at or near "\"` ile çöker. Bu davranış
// bir kez gerçekten yaşandı; testi o yüzden var.
test('satır başındaki psql meta-komutu çalıştırılmaz, atlandığı raporlanır', () => {
  const sql = `\\set ON_ERROR_STOP on\nselect 1;\n\\echo bitti\nselect 2;`;
  const { ifadeler, atlanan } = calistirilacakIfadeler(sql);
  assert.equal(ifadeler.length, 2, 'yalnız gerçek SQL çalışır');
  assert.ok(ifadeler.every((i) => !i.metin.includes('\\')), 'hiçbir ifadede ters bölü kalmaz');
  const meta = atlanan.filter((a) => a.tur === 'psql-meta');
  assert.equal(meta.length, 2, 'iki meta-komut da RAPORLANIR (sessizce yutulmaz)');
  assert.deepEqual(meta.map((m) => m.satir), [1, 3], 'satır numaraları doğru');
});

test('SQL içindeki ters bölü (metin/operatör) meta-komut sanılmaz', () => {
  const sql = `select 'yol\\dosya' as p; select 1;`;
  const { ifadeler, atlanan } = calistirilacakIfadeler(sql);
  assert.equal(atlanan.filter((a) => a.tur === 'psql-meta').length, 0);
  assert.equal(ifadeler.length, 2);
});

test('ifade ORTASINDA meta-komut sessizce atlanmaz — hata verir', () => {
  // Atlamak ifadeyi ikiye böler ve iki yarım parça sunucuya ayrı gider.
  const sql = `insert into t values (1),\n\\set x y\n(2);`;
  assert.throws(() => calistirilacakIfadeler(sql), /ORTASINDA/);
});

// ——— gerçek migration dosyaları ———
test('gerçek dosyalarda ters bölü ile başlayan satır kalmaz', () => {
  for (const f of sqlDosyalari) {
    const { ifadeler } = calistirilacakIfadeler(oku(f));
    for (const ifade of ifadeler) {
      assert.ok(
        !/^\s*\\/m.test(ifade.metin),
        `${f}: sürücüye gönderilecek ifadede psql meta-komutu var (${ifade.satir}. satır)`,
      );
    }
  }
});

test('001–005 kendi BEGIN/COMMIT ini motora devreder, 006 taşımaz', () => {
  const beklenen = {
    '001_bulletin_archive.sql': 2, '002_master_analysis.sql': 2,
    '003_scorecard_provenance.sql': 2, '004_legacy_isolation.sql': 2,
    '005_history_dna.sql': 2, '006_account_security_gamification.sql': 0,
  };
  for (const [f, sayi] of Object.entries(beklenen)) {
    const { atlanan } = calistirilacakIfadeler(oku(f));
    const islem = atlanan.filter((a) => a.tur !== 'psql-meta');
    assert.equal(islem.length, sayi, `${f}: üst seviye transaction ifadesi sayısı`);
  }
});

test('hiçbir ifade transaction dışı çalışmak zorunda değil', () => {
  // CREATE INDEX CONCURRENTLY / VACUUM / CREATE DATABASE / ALTER SYSTEM bir
  // transaction içinde çalışamaz; biri eklenirse motor bunu uygulayamaz.
  const yasak = /\b(create\s+index\s+concurrently|vacuum|create\s+database|alter\s+system|reindex\s+concurrently)\b/i;
  for (const f of sqlDosyalari) {
    const { ifadeler } = calistirilacakIfadeler(oku(f));
    for (const ifade of ifadeler) {
      assert.ok(!yasak.test(cikarYorum(ifade.metin)), `${f} (${ifade.satir}. satır): transaction dışı ifade`);
    }
  }
});

// ——— doğrulama manifestosu dosyalardan TÜRETİLİR ———
test('manifesto gerçek dosyalardan doğru çıkarılır', () => {
  const hepsi = sqlDosyalari.map(oku).join('\n');
  const tablolar = olusturulanTablolar(hepsi);
  const rls = rlsAcilanTablolar(hepsi);
  const triggerlar = olusturulanTriggerlar(hepsi);

  assert.ok(tablolar.includes('public.bulletin_snapshots'), 'snapshot tablosu manifestoda');
  assert.ok(tablolar.every((t) => t.includes('.')), 'tam ad (şema.tablo) kullanılır');
  assert.ok(rls.includes('public.bulletin_snapshots'), 'RLS beklentisi çıkarıldı');
  assert.ok(triggerlar.includes('trg_snapshot_no_update'), 'değişmezlik trigger ı manifestoda');
  assert.ok(triggerlar.includes('trg_snapshot_no_delete'), 'silme koruması manifestoda');
  assert.equal(new Set(tablolar).size >= 20, true, 'manifesto beklenen büyüklükte');
});

test('yorum içindeki create table manifestoya girmez', () => {
  const sql = `-- create table public.hayalet (a int);\ncreate table public.gercek (a int);`;
  assert.deepEqual(olusturulanTablolar(sql), ['public.gercek']);
});
