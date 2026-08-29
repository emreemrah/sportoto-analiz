// benzerSorgusu — kartın KAYDINDAN benzer-DNA sorgusunun yeniden kurulması.
//
// /similar-matches ucu mühürlü haftanın details'inden sorguyu bu fonksiyonla
// kurar; computePublicBettingRadar da aynı fonksiyonu kullanır. Bekçilenen:
// favori uzlaşıdan, kapanış/hareket birincil kaynaktan, eşitlik 1→X→2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { benzerSorgusu } from '../src/radar/publicBettingRadar.js';
import { findSimilarDna, findSimilarDnaMatches } from '../src/providers/percentageDna.js';

const rec = (provider, position, result, closeFav, openFav = null, favoriteSymbol = '1') => ({
  provider, position, result, favoriteSymbol,
  closePct: { '1': 20, X: 20, '2': 20, [favoriteSymbol]: closeFav },
  openPct: openFav == null ? null : { [favoriteSymbol]: openFav },
});

test('liste ile sayı AYNI kümeden: findSimilarDnaMatches.count === findSimilarDna.sample', () => {
  // Kart "Benzer 14 maç" derken liste 14 satır olmalı — iki fonksiyon aynı
  // seviye seçiminden geçer; ayrışırlarsa kullanıcı sayıyı doğrulayamaz.
  const records = [
    ...Array.from({ length: 4 }, () => rec('k3', 14, '1', 72, 60)),
    ...Array.from({ length: 11 }, () => rec('k3', 12, '1', 71, 60)),
    ...Array.from({ length: 20 }, () => rec('nesine', 14, '2', 72, 60)),
  ];
  const q = { provider: 'k3', position: 14, favoriteSymbol: '1', closeValue: 72, moveValue: 10 };
  const kart = findSimilarDna(records, q);
  const liste = findSimilarDnaMatches(records, q);
  assert.equal(kart.hasData, true);
  assert.equal(liste.level, kart.level);
  assert.equal(liste.matches.length, kart.sample);
  // n<10: kart yüzde basmaz, liste de boş ve aynı sebeple döner.
  const az = records.slice(0, 4);
  assert.equal(findSimilarDna(az, q).hasData, false);
  assert.deepEqual(findSimilarDnaMatches(az, q).matches, []);
});

test('benzerSorgusu: kayıttaki details → kartın hesapladığı sorgu', () => {
  const details = {
    consensus: { '1': 53, X: 29, '2': 18 },
    providers: [{
      providerId: 'ic-kimlik',
      last: { '1': 53, X: 29, '2': 18, observedAt: 't' },
      opening: { '1': 71, X: 17, '2': 12, observedAt: 't0' },
    }],
  };
  assert.deepEqual(benzerSorgusu(details, 1), {
    provider: 'ic-kimlik', position: 1, favoriteSymbol: '1', closeValue: 53, moveValue: -18,
  });
});

test('benzerSorgusu: açılış yoksa hareket null; favori UZLAŞIDAN, eşitlikte 1→X→2', () => {
  // Birincil kaynağın kendi tepe seçeneği X olsa da favori uzlaşıdan gelir;
  // uzlaşıda 1 ile X eşitse kararlı sıralama 1'i seçer (compute ile aynı).
  const details = {
    consensus: { '1': 40, X: 40, '2': 20 },
    providers: [{ providerId: 'p', last: { '1': 38, X: 42, '2': 20 }, opening: null }],
  };
  assert.deepEqual(benzerSorgusu(details, '3'), {
    provider: 'p', position: 3, favoriteSymbol: '1', closeValue: 38, moveValue: null,
  });
});

test('benzerSorgusu: kayıt yoksa null (uydurma sorgu yok)', () => {
  assert.equal(benzerSorgusu(null, 1), null);
  assert.equal(benzerSorgusu({ consensus: {}, providers: [] }, 1), null);
  assert.equal(benzerSorgusu({ providers: [{ providerId: 'p', last: { '1': 1 } }] }, 1), null);
});
