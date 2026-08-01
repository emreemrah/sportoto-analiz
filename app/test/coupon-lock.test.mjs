// MAÇ BAZLI KUPON KİLİDİ TESTLERİ (saf modül: couponConfig).
//
// Dürüstlük kuralı: her tercih, İLGİLİ MAÇ başlamadan (kilit anından) önce
// kaydedilmiş hâliyle donar. Kilitli maçta yeni/farklı seçim İMKÂNSIZDIR;
// başlamamış maçlara hafta boyunca kupon kurulabilir.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  matchLockAt, isMatchLocked, lockMapOf, lockViolations, lockAtOf, LOCK_BEFORE_MS,
} from '../src/couponConfig.js';

const HOUR = 60 * 60 * 1000;
const NOW = 1_800_000_000_000; // sabit referans an (deterministik)
const m = (no, offsetMs) => ({ no, date: new Date(NOW + offsetMs).toISOString() });

test('matchLockAt: maçın kilidi başlangıçtan 5 dk öncedir; tarih yoksa null', () => {
  const mm = m(1, HOUR);
  assert.equal(matchLockAt(mm), NOW + HOUR - LOCK_BEFORE_MS);
  assert.equal(matchLockAt({ no: 2 }), null);
  assert.equal(matchLockAt({ no: 3, date: 'geçersiz' }), null);
});

test('isMatchLocked: başlamış maç kilitli, gelecekteki maç serbest', () => {
  assert.equal(isMatchLocked(m(1, -HOUR), NOW), true, 'bir saat önce başlayan kilitli');
  assert.equal(isMatchLocked(m(2, 2 * HOUR), NOW), false, 'iki saat sonraki serbest');
  assert.equal(isMatchLocked(m(3, LOCK_BEFORE_MS - 1000), NOW), true, 'kilit anı geçtiyse kilitli');
});

test('bülten kilidi ile maç kilidi AYRIDIR: ilk maç başlasa da sonrakiler serbest', () => {
  const matches = [m(1, -HOUR), m(2, 6 * HOUR), m(3, 24 * HOUR)];
  assert.equal(lockAtOf(matches) <= NOW, true, 'bülten kilidi geçmiş (eski davranış her şeyi kapatırdı)');
  assert.equal(isMatchLocked(matches[0], NOW), true);
  assert.equal(isMatchLocked(matches[1], NOW), false, 'başlamamış maç KİLİTLENMEZ');
  assert.equal(isMatchLocked(matches[2], NOW), false);
});

test('lockViolations: yeni kuponda başlamış maça seçim YAPILAMAZ', () => {
  const lockMap = lockMapOf([m(1, -HOUR), m(2, 6 * HOUR)]);
  const bad = lockViolations({
    selections: [
      { no: 1, selectedOutcomes: ['1'] },   // başlamış maça seçim → İHLAL
      { no: 2, selectedOutcomes: ['X'] },   // serbest maç → sorun yok
    ],
    prevSelections: [],
    lockMap, now: NOW,
  });
  assert.deepEqual(bad, [1]);
});

test('lockViolations: kilitli maçın MEVCUT seçimi aynen taşınabilir ama DEĞİŞTİRİLEMEZ', () => {
  const lockMap = lockMapOf([m(1, -HOUR), m(2, 6 * HOUR)]);
  const prev = [{ no: 1, selectedOutcomes: ['1', 'X'] }, { no: 2, selectedOutcomes: ['2'] }];
  // Aynı değer → ihlal yok (sıra farkı da normalize edilir)
  assert.deepEqual(lockViolations({
    selections: [{ no: 1, selectedOutcomes: ['X', '1'] }, { no: 2, selectedOutcomes: ['1'] }],
    prevSelections: prev, lockMap, now: NOW,
  }), [], 'kilitli maçta aynı seçim + serbest maçta değişiklik → serbest');
  // Farklı değer → ihlal
  assert.deepEqual(lockViolations({
    selections: [{ no: 1, selectedOutcomes: ['2'] }],
    prevSelections: prev, lockMap, now: NOW,
  }), [1]);
  // Kilitli seçimi SİLMEK de değişikliktir → ihlal
  assert.deepEqual(lockViolations({
    selections: [{ no: 1, selectedOutcomes: [] }],
    prevSelections: prev, lockMap, now: NOW,
  }), [1]);
});

test('lockViolations: kilidi olmayan (tarihi bilinmeyen) maç engellenmez', () => {
  const bad = lockViolations({
    selections: [{ no: 9, selectedOutcomes: ['1'] }],
    prevSelections: [], lockMap: {}, now: NOW,
  });
  assert.deepEqual(bad, []);
});
