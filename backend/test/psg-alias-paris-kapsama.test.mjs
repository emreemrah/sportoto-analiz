// PSG ALIAS + "PARIS" KAPSAMA KORUMASI.
//
// GERÇEK ARIZA (29 Ağu 2026, 3. Hafta 11. maç Lille – Paris St Germain):
// kaynak PSG'yi yalnız "PSG" adıyla listeler (logo france-paris-saint-germain-fc);
// bülten "Paris St Germain"/"Paris SG" yazar → hiçbir katman tutmadı, maç
// "eşleştirilemedi" kaldı. Üstüne "paris" kelimesi kapsama kuralıyla Paris FC'ye
// yapıştı: kartta Paris FC arması çıktı. Bu test iki kuralı da bekçiler.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sideMatches, findFootyMatch } from '../src/matcher.js';

const PSG_IMG = 'teams/france-paris-saint-germain-fc.png';
const PARIS_FC_IMG = 'teams/france-paris-fc.png';
const LILLE_IMG = 'teams/france-lille-osc-metropole.png';
const bultenPsg = { name: 'Paris St Germain', mediumName: 'Paris SG' };

test('bülten "Paris St Germain" ↔ kaynak "PSG" (alias; kaynak logosuyla doğrulandı)', () => {
  assert.equal(sideMatches(bultenPsg, 'PSG', PSG_IMG), 'name');
  assert.equal(sideMatches({ name: 'Paris SG' }, 'PSG', PSG_IMG), 'name');
});

test('PSG artık Paris FC\'ye YAPIŞMAZ; Paris FC birebir eşitlikle yine bulunur', () => {
  assert.equal(sideMatches(bultenPsg, 'Paris', PARIS_FC_IMG), null);
  assert.equal(sideMatches({ name: 'Paris FC' }, 'Paris', PARIS_FC_IMG), 'name');
  // Logo katmanı da "paris" ile PSG slug'ına yapışamaz.
  assert.equal(sideMatches({ name: 'Paris FC' }, 'PSG', PSG_IMG), null);
});

test('Lille – PSG fikstürü bulunur ve aynı gün Lille – Paris FC ile KARIŞMAZ', () => {
  const t = Math.floor(new Date('2026-08-28T19:00:00Z').getTime() / 1000);
  const fikstur = [
    { footyMatchId: 1, homeName: 'Lille', awayName: 'PSG', homeImage: LILLE_IMG, awayImage: PSG_IMG, dateUnix: t },
    { footyMatchId: 2, homeName: 'Lille', awayName: 'Paris', homeImage: LILLE_IMG, awayImage: PARIS_FC_IMG, dateUnix: t },
  ];
  const bm = { date: '2026-08-28T21:45:00', home: { name: 'Lille', mediumName: 'Lille' }, away: bultenPsg };
  const found = findFootyMatch(bm, fikstur);
  assert.equal(found?.ambiguous, undefined, 'belirsizlik olmamalı');
  assert.equal(found?.match?.footyMatchId, 1);
  assert.deepEqual(found.how, ['name', 'name']);
});

test('kapsama koruması diğer kulüpleri BOZMAZ (Genk ⊂ KRC Genk, sponsor öneki)', () => {
  // GERÇEK YAN ETKİ (29 Ağu 2026): koruma AMBIGUOUS_TOKENS'ın tamamıyla
  // kurulunca 4. Hafta "Inter" ↔ "Inter Milan" eşleşmesi düştü. Kapsama
  // engeli yalnız KAPSAMA_DISI ("paris") için geçerlidir.
  assert.equal(sideMatches({ name: 'Inter' }, 'Inter Milan', 'teams/italy-fc-internazionale-milano.png'), 'name');
  assert.equal(sideMatches({ name: 'Genk' }, 'KRC Genk'), 'name');
  assert.equal(sideMatches({ name: 'KGHM Zaglebie Lubin' }, 'Zagłębie Lubin'), 'name');
  assert.equal(sideMatches({ name: 'Marsilya' }, 'Olympique Marseille'), 'name');
});
