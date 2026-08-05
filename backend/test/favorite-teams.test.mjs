// Favori takım kataloğu — saf yardımcı testleri.
import test from 'node:test';
import assert from 'node:assert/strict';
import { enGuncelSezon, ligListesiHazirla, SECILI_LIGLER } from '../src/favoriteTeams.js';

test('enGuncelSezon: en büyük yılın id\'si; sezon yoksa null', () => {
  assert.equal(enGuncelSezon({ season: [{ id: 1, year: 20222023 }, { id: 9, year: 20252026 }, { id: 5, year: 20242025 }] }), 9);
  assert.equal(enGuncelSezon({ season: [] }), null);
  assert.equal(enGuncelSezon(null), null);
});

test('ligListesiHazirla: yalnız katalogda OLAN seçili ligler, sıra korunur', () => {
  const katalog = [
    { name: 'England Premier League', image: 'pl.png', season: [{ id: 11, year: 20252026 }] },
    { name: 'Turkey Süper Lig', image: 'tsl.png', season: [{ id: 22, year: 20252026 }] },
    { name: 'Sweden Allsvenskan', image: 'sw.png', season: [{ id: 33, year: 2025 }] }, // seçili değil
  ];
  const out = ligListesiHazirla(katalog);
  // Türkiye önce (SECILI_LIGLER sırası), katalogda olmayanlar (1. Lig vb.) atlanır.
  assert.deepEqual(out.map((l) => l.key), ['Turkey Süper Lig', 'England Premier League']);
  assert.equal(out[0].seasonId, 22);
  assert.equal(out[1].image, 'pl.png');
});

test('seçili lig listesi kullanıcının istediği ligleri kapsar', () => {
  const keys = SECILI_LIGLER.map((l) => l.key);
  for (const beklenen of ['Turkey Süper Lig', 'England Premier League', 'Spain La Liga', 'Italy Serie A', 'Germany Bundesliga', 'Portugal Liga NOS', 'Netherlands Eredivisie']) {
    assert.ok(keys.includes(beklenen), beklenen);
  }
});
