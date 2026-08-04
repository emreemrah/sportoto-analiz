// Ana sayfa ülke şeridi mantığı — saf modül testleri.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ulkeAyikla, ulkeListesi, KULUP_ETIKETI } from '../src/ulkeSeridi.js';

test('lig adından ülke çıkarılır ve Türkçeleşir', () => {
  assert.deepEqual(ulkeAyikla('Denmark Superliga'), { name: 'Danimarka', en: 'Denmark' });
  assert.deepEqual(ulkeAyikla('Sweden Allsvenskan'), { name: 'İsveç', en: 'Sweden' });
  assert.deepEqual(ulkeAyikla('Poland Ekstraklasa'), { name: 'Polonya', en: 'Poland' });
});

test('iki kelimelik ülke adı tanınır', () => {
  assert.equal(ulkeAyikla('Czech Republic Fortuna Liga').name, 'Çekya');
});

test('Kulüp Maçları etiketi "Kulüp" olur, ülke uydurulmaz', () => {
  assert.deepEqual(ulkeAyikla(KULUP_ETIKETI), { name: 'Kulüp', en: null });
});

test('tanınmayan lig adı AYNEN kalır (çeviri uydurulmaz)', () => {
  assert.deepEqual(ulkeAyikla('Mars Premier League'), { name: 'Mars Premier League', en: null });
});

test('boş/eksik lig → null', () => {
  assert.equal(ulkeAyikla(''), null);
  assert.equal(ulkeAyikla(null), null);
});

test('ulkeListesi: tekil, ilk görülme sırası, bayrak kodu, maç sayısı', () => {
  const matches = [
    { league: 'Denmark Superliga' },
    { league: 'Denmark Superliga' },
    { league: KULUP_ETIKETI },
    { league: 'Finland Veikkausliiga' },
    { league: 'Sweden Allsvenskan' },
    { league: 'Norway Eliteserien' },
    { league: 'Poland Ekstraklasa' },
    { league: null },
  ];
  const u = ulkeListesi(matches);
  assert.deepEqual(u.map((x) => x.name), ['Danimarka', 'Kulüp', 'Finlandiya', 'İsveç', 'Norveç', 'Polonya']);
  assert.equal(u[0].code, 'dk');
  assert.equal(u[1].code, ''); // Kulüp: bayrak yok → nötr simge
  assert.equal(u[3].code, 'se');
  // Maç sayıları: null lig sayılmaz, aynı ülkenin maçları toplanır.
  assert.deepEqual(u.map((x) => x.count), [2, 1, 1, 1, 1, 1]);
});
