// MIGRATION GÜVENLİK TESTLERİ — STATİK YAPI DENETİMLERİ.
// ---------------------------------------------------------------------------
// DÜRÜSTLÜK NOTU: Bu dosyadaki testler SQL dosyalarının YAPISINI ve runner
// yapılandırmasını denetler (canlı PostgreSQL ÇALIŞTIRMAZ). SQL'in gerçek
// PostgreSQL 16 üzerinde uçtan uca doğrulaması ayrıca yapılmıştır (kilitli
// snapshot'lı DB'de 001→004, UPDATE/DELETE koruması, rollback güvenliği,
// idempotency, kısmi durum, ON_ERROR_STOP) — sonuçları teslim raporundadır.
// Buradaki statik denetimler o güvenlik kalıbının koddan SİLİNMESİNİ engeller.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dosyalariOku } from '../src/migrate/plan.js';

const read = (p) => readFileSync(new URL(`../migrations/${p}`, import.meta.url), 'utf8');
// Yalnız ÇALIŞAN SQL denetlenir: '--' yorum satırları çıkarılır (açıklama
// metinlerindeki kalıp adları yanlış pozitif üretmesin).
const stripComments = (sql) => sql.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');
const m001 = stripComments(read('001_bulletin_archive.sql'));
const m003 = stripComments(read('003_scorecard_provenance.sql'));
const m004 = stripComments(read('004_legacy_isolation.sql'));
const pkg = readFileSync(new URL('../package.json', import.meta.url), 'utf8');

test('001: gerçek trigger adları mevcut (tahmin edilmedi)', () => {
  assert.ok(m001.includes('create trigger trg_snapshot_no_update'));
  assert.ok(m001.includes('create trigger trg_snapshot_no_delete'));
  assert.ok(m001.includes('forbid_snapshot_mutation'));
});

test('003: açık transaction + yalnız UPDATE trigger dar kapsamlı disable/enable', () => {
  assert.ok(/^BEGIN;/m.test(m003), 'açık BEGIN var');
  assert.ok(/^COMMIT;/m.test(m003), 'açık COMMIT var');
  const disables = m003.match(/DISABLE TRIGGER (\w+)/g) || [];
  const enables = m003.match(/ENABLE TRIGGER (\w+)/g) || [];
  assert.deepEqual(disables, ['DISABLE TRIGGER trg_snapshot_no_update'], 'YALNIZ update trigger, gerçek adıyla');
  assert.deepEqual(enables, ['ENABLE TRIGGER trg_snapshot_no_update'], 'aynı transaction içinde geri açılır');
  assert.ok(m003.indexOf('DISABLE TRIGGER') < m003.indexOf('UPDATE public.bulletin_snapshots'), 'disable UPDATE’ten önce');
  assert.ok(m003.indexOf('ENABLE TRIGGER') > m003.indexOf('UPDATE public.bulletin_snapshots'), 'enable UPDATE’ten sonra');
  assert.ok(m003.indexOf('ENABLE TRIGGER') < m003.indexOf('COMMIT;'), 'enable COMMIT’ten önce');
});

test('003: yasaklı kalıplar yok (toplu bypass / silme / hash yeniden hesap / hardcode)', () => {
  for (const f of [m003, m004]) {
    assert.ok(!/session_replication_role/i.test(f), 'session_replication_role KULLANILMAZ');
    assert.ok(!/DISABLE TRIGGER ALL/i.test(f), 'toplu trigger kapatma YOK');
    assert.ok(!/trg_snapshot_no_delete\s*;?\s*$/m.test(f.match(/DISABLE TRIGGER.*$/gm)?.join('\n') || ''), 'DELETE trigger kapatılmaz');
    assert.ok(!/DROP TRIGGER/i.test(f), 'trigger kalıcı drop edilmez');
    assert.ok(!/\bDELETE\s+FROM\s+(public\.)?bulletin_snapshots/i.test(f), 'snapshot DELETE yok');
    assert.ok(!/TRUNCATE/i.test(f), 'truncate yok');
    assert.ok(!/1521/.test(f), 'roundId hardcode edilmez');
    assert.ok(!/SET\s+(payload_hash|snapshot_payload|locked_at|data_observed_at|late|created_at)\s*=/i.test(f), 'kanıt/içerik alanlarına yazılmaz');
  }
});

test('003: sınıflandırma default-deny (kanıt şartları + unknown fallback)', () => {
  for (const evidence of ['late IS TRUE', 'payload_hash IS NOT NULL', 'locked_at <= b.first_match_start_at', 'data_observed_at <= s.locked_at', "ELSE 'unknown'"]) {
    assert.ok(m003.includes(evidence), `kanıt şartı: ${evidence}`);
  }
  assert.ok(m003.includes("WHERE b.id = s.bulletin_id\n  AND s.provenance_type IS NULL"), 'yalnız sınıflandırılmamış satırlar (idempotent)');
});

test('004: aynı güvenli kalıp + resmî view bütün legacy türlerini dışlar', () => {
  assert.ok(/^BEGIN;/m.test(m004) && /^COMMIT;/m.test(m004));
  assert.deepEqual(m004.match(/DISABLE TRIGGER (\w+)/g), ['DISABLE TRIGGER trg_snapshot_no_update']);
  assert.deepEqual(m004.match(/ENABLE TRIGGER (\w+)/g), ['ENABLE TRIGGER trg_snapshot_no_update']);
  assert.ok(m004.includes("is_official_forward = false"), 'sınıflandırılmamış → resmî DEĞİL (default-deny)');
  assert.ok(m004.includes("NOT IN ('legacy_backfill','retrospective_backtest','demo','unknown','late_unverified')"));
});

// Eski hâli: `migrate` betiği psql'e ELLE sayılmış bir dosya listesi veriyordu
// ve bu test o listenin sırasını doğruluyordu. Liste 004'te unutulmuştu — yani
// test "sıra doğru" derken 005 ve 006 hiç çalışmıyordu. Artık dosya listesi
// diskten okunuyor; test de listeyi değil, listenin ELLE TUTULMADIĞINI denetler.
test('migrate betiği elle dosya listesi taşımaz — motoru çağırır', () => {
  const betik = readFileSync(new URL('../scripts/migrate.js', import.meta.url), 'utf8');
  assert.ok(/scripts\/migrate\.js/.test(pkg), 'npm run migrate → scripts/migrate.js');
  assert.ok(!/\bpsql\b/.test(pkg), 'psql yolu kaldırıldı (tek doğruluk kaynağı: motor)');
  assert.ok(betik.includes('acilistaMigrationCalistir'), 'açılıştaki MOTORUN aynısını çağırır');
  for (const dosya of ['001_', '002_', '003_', '004_', '005_', '006_']) {
    assert.ok(!pkg.includes(dosya), `${dosya} package.json'da elle sayılmamalı`);
    assert.ok(!betik.includes(dosya), `${dosya} betikte elle sayılmamalı`);
  }
});

test('sıra motorda: dosyalar numaraya göre dizilir, atlanmaz', () => {
  const dosyalar = dosyalariOku(new URL('../migrations/', import.meta.url).pathname);
  const surumler = dosyalar.map((d) => d.surum);
  assert.deepEqual(surumler, [...surumler].sort(), 'artan sırada uygulanır');
  assert.ok(surumler.includes('005') && surumler.includes('006'), '005 ve 006 da kapsamda');
  assert.equal(new Set(surumler).size, surumler.length, 'tekrarlı sürüm numarası yok');
});
