// BİLDİRİM MERKEZİ TESTLERİ — asıl amaç: uydurma bildirim üretilmediğini kanıtlamak.
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNotifications, nextState, seedState, isOfficial } from '../src/notifications.js';

const NOW = Date.parse('2026-07-25T12:00:00.000Z');

const kupon = (roundId, nolar) => ([{
  id: 'k1', roundId, couponNo: 1, isRankedCoupon: true, finalVersionId: 'v1',
  versions: [{ id: 'v1', versionNo: 1, selections: nolar.map((no) => ({ no, selectedOutcomes: ['1'] })) }],
}]);

test('veri yoksa hiç bildirim üretilmez (uydurma yok)', () => {
  const { items, unread } = buildNotifications({ now: NOW });
  assert.equal(items.length, 0);
  assert.equal(unread, 0);
});

test('resmî sonucu olmayan maç "sonuç açıklandı" sayılmaz', () => {
  assert.equal(isOfficial({ result: '1', score: { home: 1, away: 0 } }), true);
  assert.equal(isOfficial({ result: '1', score: null }), false);  // canlı skor yok
  assert.equal(isOfficial({ result: null, score: { home: 1, away: 0 } }), false);
  const { items } = buildNotifications({
    now: NOW,
    history: { roundId: 9, roundName: 'Test', matches: [{ no: 1, result: '1', score: null }] },
  });
  assert.equal(items.length, 0, 'yalnız canlı skorla bildirim çıkmamalı');
});

test('resmî sonuç bildirimi GERÇEK sayıyı yazar ve kısmîyi "bitti" göstermez', () => {
  const matches = [
    { no: 1, result: '1', score: { home: 1, away: 0 } },
    { no: 2, result: 'X', score: { home: 1, away: 1 } },
    { no: 3, result: null, score: null },
  ];
  const { items } = buildNotifications({ now: NOW, history: { roundId: 9, roundName: '31. Hafta', matches } });
  const b = items.find((i) => i.kind === 'result-official');
  assert.ok(b, 'resmî sonuç bildirimi olmalı');
  assert.match(b.body, /2\/3/);
  assert.equal(b.title, 'Resmî sonuçlar açıklanıyor');
  assert.equal(b.target.screen, 'WeekRecap');
});

test('tüm maçlar resmîleşince "Hafta kapandı" denir', () => {
  const matches = [
    { no: 1, result: '1', score: { home: 1, away: 0 } },
    { no: 2, result: 'X', score: { home: 1, away: 1 } },
  ];
  const { items } = buildNotifications({ now: NOW, history: { roundId: 9, roundName: '31. Hafta', matches } });
  assert.equal(items[0].title, 'Hafta kapandı');
  assert.match(items[0].body, /2\/2/);
});

test('başlıyor bildirimi YALNIZ kupondaki maç için ve gerçek saat varsa', () => {
  const bulletin = {
    roundId: 10,
    matches: [
      { no: 1, date: new Date(NOW + 30 * 60000).toISOString(), home: { name: 'Ev A' }, away: { name: 'Dep A' } },
      { no: 2, date: new Date(NOW + 30 * 60000).toISOString(), home: { name: 'Ev B' }, away: { name: 'Dep B' } },
      { no: 3, date: null, home: { name: 'Ev C' }, away: { name: 'Dep C' } },
    ],
  };
  const { items } = buildNotifications({ now: NOW, bulletin, coupons: kupon(10, [1, 3]) });
  const bas = items.filter((i) => i.kind === 'match-starting');
  assert.equal(bas.length, 1, 'yalnız 1 numaralı maç (kuponda + saati var)');
  assert.match(bas[0].body, /Ev A – Dep A/);
});

test('pencere dışındaki ve başlamış maçlar bildirilmez', () => {
  const bulletin = {
    roundId: 10,
    matches: [
      { no: 1, date: new Date(NOW + 5 * 3600000).toISOString(), home: { name: 'A' }, away: { name: 'B' } },  // çok uzak
      { no: 2, date: new Date(NOW - 60000).toISOString(), home: { name: 'C' }, away: { name: 'D' } },        // başlamış
      { no: 3, date: new Date(NOW + 10 * 60000).toISOString(), home: { name: 'E' }, away: { name: 'F' }, status: 'finished' },
    ],
  };
  const { items } = buildNotifications({ now: NOW, bulletin, coupons: kupon(10, [1, 2, 3]) });
  assert.equal(items.filter((i) => i.kind === 'match-starting').length, 0);
});

test('puan bildirimi YALNIZ sunucu toplamı artınca çıkar', () => {
  const yok = buildNotifications({ now: NOW, progress: { points: 120 }, state: { lastPoints: 120 } });
  assert.equal(yok.items.length, 0, 'değişmediyse bildirim yok');

  const dus = buildNotifications({ now: NOW, progress: { points: 100 }, state: { lastPoints: 120 } });
  assert.equal(dus.items.length, 0, 'azaldıysa bildirim yok');

  const art = buildNotifications({ now: NOW, progress: { points: 145 }, state: { lastPoints: 120 } });
  assert.equal(art.items.length, 1);
  assert.equal(art.items[0].title, '+25 puan kazandın');
});

test('ilk açılışta (önceki durum yok) puan/başarı yağmuru olmaz', () => {
  const progress = { points: 900, achievements: [{ key: 'a1', title: 'İlk kupon', earned: true }] };
  const { items } = buildNotifications({ now: NOW, progress, state: {} });
  assert.equal(items.length, 0, 'geçmişe dönük bildirim üretilmemeli');

  const durum = seedState({ now: NOW, progress });
  assert.equal(durum.lastPoints, 900);
  assert.deepEqual(durum.lastAchievements, ['a1']);
});

test('yeni başarı bildirilir, eskisi tekrar bildirilmez', () => {
  const progress = {
    points: 100,
    achievements: [
      { key: 'a1', title: 'İlk kupon', icon: '🎫', earned: true },
      { key: 'a2', title: 'Beş hafta üst üste', icon: '🔥', earned: true },
      { key: 'a3', title: 'Kilitli', earned: false },
    ],
  };
  const { items } = buildNotifications({ now: NOW, progress, state: { lastPoints: 100, lastAchievements: ['a1'] } });
  assert.equal(items.length, 1);
  assert.match(items[0].body, /Beş hafta üst üste/);
  assert.equal(items[0].icon, '🔥');
});

test('bülten "round" alanı METİN olduğunda hafta adı doğru okunur (gerçek API biçimi)', () => {
  // Gerçek /api/bulletin cevabında round = "32. Hafta" (metin). Nesne beklemek
  // hafta adını kaybettirirdi; iki biçim de desteklenmeli.
  const metin = buildNotifications({
    now: NOW,
    bulletin: { roundId: 11, round: '32. Hafta', matches: new Array(15).fill({}) },
    state: { knownRoundIds: ['10'] },
  });
  assert.match(metin.items[0].body, /32\. Hafta · 15 maç/);

  const nesne = buildNotifications({
    now: NOW,
    bulletin: { round: { id: 11, name: '32. Hafta' }, matches: new Array(15).fill({}) },
    state: { knownRoundIds: ['10'] },
  });
  assert.match(nesne.items[0].body, /32\. Hafta · 15 maç/);
  assert.equal(nesne.items[0].id, 'round:11', 'nesne biçiminde de hafta kimliği bulunmalı');
});

test('yeni hafta yalnız daha önce hafta görülmüşse haber verilir', () => {
  const bulletin = { roundId: 11, round: { name: '32. Hafta' }, matches: new Array(15).fill({}) };
  const ilk = buildNotifications({ now: NOW, bulletin, state: {} });
  assert.equal(ilk.items.length, 0, 'ilk kurulumda "yeni hafta" denmez');

  const sonra = buildNotifications({ now: NOW, bulletin, state: { knownRoundIds: ['10'] } });
  assert.equal(sonra.items.length, 1);
  assert.match(sonra.items[0].body, /15 maç/);
});

test('okunmuş bildirim tekrar görünmez (dismissed)', () => {
  const history = { roundId: 9, roundName: 'T', matches: [{ no: 1, result: '1', score: { home: 1, away: 0 } }] };
  const bir = buildNotifications({ now: NOW, history });
  assert.equal(bir.items.length, 1);

  const durum = nextState({ now: NOW, state: {}, items: bir.items });
  const iki = buildNotifications({ now: NOW + 1000, history, state: durum });
  assert.equal(iki.items.length, 0, 'aynı bildirim ikinci kez çıkmamalı');
});

test('okunmamış sayacı seenAt ile hesaplanır', () => {
  const history = { roundId: 9, roundName: 'T', matches: [{ no: 1, result: '1', score: { home: 1, away: 0 } }] };
  const a = buildNotifications({ now: NOW, history, state: { seenAt: NOW - 1 } });
  assert.equal(a.unread, 1);
  const b = buildNotifications({ now: NOW, history, state: { seenAt: NOW + 1 } });
  assert.equal(b.unread, 0);
});

test('hiçbir bildirimde iddialı dil yok', () => {
  const bulletin = {
    roundId: 11, round: { name: '32. Hafta' },
    matches: [{ no: 1, date: new Date(NOW + 10 * 60000).toISOString(), home: { name: 'A' }, away: { name: 'B' } }],
  };
  const history = { roundId: 10, roundName: '31. Hafta', matches: [{ no: 1, result: '1', score: { home: 2, away: 0 } }] };
  const progress = { points: 200, achievements: [{ key: 'x', title: 'Test', earned: true }] };
  const { items } = buildNotifications({
    now: NOW, bulletin, history, progress,
    coupons: kupon(11, [1]),
    state: { lastPoints: 100, lastAchievements: [], knownRoundIds: ['10'] },
  });
  assert.ok(items.length >= 4, 'tüm türler üretilmeli');
  const metin = items.map((i) => `${i.title} ${i.body}`).join(' ');
  for (const kotu of [/kesin/i, /garanti/i, /banko/i, /yanılmaz/i, /net favori/i]) {
    assert.ok(!kotu.test(metin), `iddialı dil bulundu: ${kotu}`);
  }
});

test('durum listesi sınırsız büyümez', () => {
  const cok = Array.from({ length: 250 }, (_, i) => ({ id: `x${i}` }));
  const d = nextState({ now: NOW, state: {}, items: cok });
  assert.equal(d.dismissed.length, 200);
  assert.equal(d.dismissed[199], 'x249', 'en yeniler tutulmalı');
});
