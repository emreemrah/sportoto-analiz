// TELEFON HATIRLATMASI PLANLAYICI TESTLERİ.
//
// Asıl amaç: telefona düşen bildirimin UYDURMA olmadığını, geçmişe
// kurulmadığını, yalnız kullanıcının KENDİ kuponunu kapsadığını ve metninde
// iddialı dil / kişisel veri bulunmadığını kanıtlamak.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  planMatchReminders, diffSchedule, VARSAYILAN_ONCE_DK, EN_FAZLA_BILDIRIM,
} from '../src/pushPlanner.js';

const NOW = Date.parse('2026-07-25T12:00:00.000Z');
const sonra = (dk) => new Date(NOW + dk * 60000).toISOString();

const kupon = (roundId, nolar) => ([{
  id: 'k1', roundId, couponNo: 1, finalVersionId: 'v1',
  versions: [{ id: 'v1', versionNo: 1, selections: nolar.map((no) => ({ no, selectedOutcomes: ['1'] })) }],
}]);

const mac = (no, dk, ek = {}) => ({
  no, date: sonra(dk), home: { name: `Ev ${no}` }, away: { name: `Dep ${no}` }, ...ek,
});

// ---------------------------------------------------------------------------

test('kupon yoksa hiç hatırlatma kurulmaz (bildirim yağmuru yok)', () => {
  const b = { roundId: 10, matches: [mac(1, 180), mac(2, 240)] };
  const { items } = planMatchReminders({ now: NOW, bulletin: b, coupons: [] });
  assert.equal(items.length, 0);
});

test('bülten yoksa hiç hatırlatma kurulmaz', () => {
  const { items } = planMatchReminders({ now: NOW, bulletin: null, coupons: kupon(10, [1]) });
  assert.equal(items.length, 0);
});

test('YALNIZ kullanıcının kuponundaki maçlar hatırlatılır', () => {
  const b = { roundId: 10, matches: [mac(1, 180), mac(2, 200), mac(3, 220)] };
  const { items } = planMatchReminders({ now: NOW, bulletin: b, coupons: kupon(10, [2]) });
  assert.equal(items.length, 1);
  assert.equal(items[0].data.params.no, 2);
});

test('başlama saati YOKSA hatırlatma UYDURULMAZ', () => {
  const b = { roundId: 10, matches: [{ no: 1, date: null, home: { name: 'Ev' }, away: { name: 'Dep' } }] };
  const { items, atlanan } = planMatchReminders({ now: NOW, bulletin: b, coupons: kupon(10, [1]) });
  assert.equal(items.length, 0, 'saati bilinmeyen maça bildirim kurulmamalı');
  assert.equal(atlanan.saatYok, 1);
});

test('takım adı eksikse hatırlatma kurulmaz (yarım metin yazılmaz)', () => {
  const b = { roundId: 10, matches: [{ no: 1, date: sonra(180), home: { name: 'Ev' }, away: null }] };
  const { items, atlanan } = planMatchReminders({ now: NOW, bulletin: b, coupons: kupon(10, [1]) });
  assert.equal(items.length, 0);
  assert.equal(atlanan.saatYok, 1);
});

test('GEÇMİŞE bildirim kurulmaz (telefon anında çalmaz)', () => {
  const b = {
    roundId: 10,
    matches: [
      mac(1, -30),   // maç çoktan başladı
      mac(2, 30),    // 30 dk sonra başlıyor → 60 dk öncesi geçmişte kaldı
      mac(3, 180),   // güvenli
    ],
  };
  const { items, atlanan } = planMatchReminders({ now: NOW, bulletin: b, coupons: kupon(10, [1, 2, 3]) });
  assert.equal(items.length, 1);
  assert.equal(items[0].data.params.no, 3);
  assert.equal(atlanan.gecmis, 2);
  for (const it of items) assert.ok(it.fireAt > NOW, 'her fireAt gelecekte olmalı');
});

test('başlamış / canlı / resmî sonuçlu maça hatırlatma kurulmaz', () => {
  const b = {
    roundId: 10,
    matches: [
      mac(1, 180, { status: 'live' }),
      mac(2, 180, { status: 'finished' }),
      mac(3, 180, { result: '1', score: { home: 1, away: 0 } }),  // resmî
      mac(4, 180),
    ],
  };
  const { items, atlanan } = planMatchReminders({ now: NOW, bulletin: b, coupons: kupon(10, [1, 2, 3, 4]) });
  assert.equal(items.length, 1);
  assert.equal(items[0].data.params.no, 4);
  assert.equal(atlanan.basladi, 3);
});

test('hatırlatma tam olarak istenen dakika kadar önce kurulur', () => {
  const b = { roundId: 10, matches: [mac(5, 300)] };
  const { items } = planMatchReminders({ now: NOW, bulletin: b, coupons: kupon(10, [5]), onceDk: 90 });
  assert.equal(items[0].fireAt, NOW + (300 - 90) * 60000);

  const v = planMatchReminders({ now: NOW, bulletin: b, coupons: kupon(10, [5]) });
  assert.equal(v.items[0].fireAt, NOW + (300 - VARSAYILAN_ONCE_DK) * 60000);
});

test('metinde İDDİALI DİL yoktur ve tahmin/sonuç bildirilmez', () => {
  const YASAK = /kesin|garanti|banko|yanılmaz|net favori|kazan|oyna|bahis|iddaa|tahminimiz/i;
  const b = { roundId: 10, matches: [mac(1, 180), mac(2, 240), mac(3, 300)] };
  const { items } = planMatchReminders({ now: NOW, bulletin: b, coupons: kupon(10, [1, 2, 3]) });
  assert.equal(items.length, 3);
  for (const it of items) {
    assert.doesNotMatch(it.title, YASAK, `başlıkta yasak dil: ${it.title}`);
    assert.doesNotMatch(it.body, YASAK, `metinde yasak dil: ${it.body}`);
    // Metin BİÇİMİ sabittir: "<no>. <ev> – <deplasman> · <saat>". Bu kalıp,
    // gelecekte oluşacak bir sonucun (skor / 1-X-2 seçimi) metne
    // sızmasını yapısal olarak imkânsız kılar.
    assert.match(it.body, /^\d+\. [^·]+ – [^·]+ · \d{2}:\d{2}$/, `beklenmedik metin biçimi: ${it.body}`);
  }
});

test('metinde KİŞİSEL VERİ sızmaz (e-posta, belirteç, kullanıcı adı, puan)', () => {
  const kirli = kupon(10, [1]);
  kirli[0].userEmail = 'gizli@ornek.com';
  kirli[0].token = 'BELIRTEC-123';
  kirli[0].username = 'emrah41';
  kirli[0].points = 4820;

  const b = { roundId: 10, matches: [mac(1, 180)] };
  const { items } = planMatchReminders({ now: NOW, bulletin: b, coupons: kirli });
  const metin = JSON.stringify(items);
  for (const s of ['gizli@ornek.com', 'BELIRTEC-123', 'emrah41', '4820']) {
    assert.ok(!metin.includes(s), `kişisel veri sızdı: ${s}`);
  }
  assert.match(items[0].body, /^1\. Ev 1 – Dep 1 · /, 'yalnız maç no / takım / saat yazılmalı');
});

test('kimlik kararlıdır: aynı girdi aynı kimliği üretir, tekrar kurulmaz', () => {
  const b = { roundId: 10, matches: [mac(1, 180), mac(1, 180)] };   // yinelenen kayıt
  const a1 = planMatchReminders({ now: NOW, bulletin: b, coupons: kupon(10, [1]) });
  const a2 = planMatchReminders({ now: NOW, bulletin: b, coupons: kupon(10, [1]) });
  assert.equal(a1.items.length, 1, 'yinelenen maç iki bildirim üretmemeli');
  assert.equal(a1.items[0].id, 'mac:10:1');
  assert.deepEqual(a1.items.map((i) => i.id), a2.items.map((i) => i.id));
});

test('bildirimler saate göre sıralanır ve üst sınır dürüstçe raporlanır', () => {
  const matches = [];
  const nolar = [];
  for (let i = 1; i <= EN_FAZLA_BILDIRIM + 3; i += 1) {
    matches.push(mac(i, 1000 - i));   // bilerek ters sırada
    nolar.push(i);
  }
  const { items, atlanan } = planMatchReminders({ now: NOW, bulletin: { roundId: 10, matches }, coupons: kupon(10, nolar) });
  assert.equal(items.length, EN_FAZLA_BILDIRIM);
  assert.equal(atlanan.sinir, 3, 'atılan bildirim sayısı sessizce yutulmamalı');
  for (let i = 1; i < items.length; i += 1) {
    assert.ok(items[i - 1].fireAt <= items[i].fireAt, 'saate göre sıralı olmalı');
  }
});

test('hedef gerçek bir ekrandır (dokununca boşluğa gitmez)', () => {
  const b = { roundId: 10, matches: [mac(7, 180)] };
  const { items } = planMatchReminders({ now: NOW, bulletin: b, coupons: kupon(10, [7]) });
  assert.deepEqual(items[0].data, {
    tab: 'BulletinTab', screen: 'LiveMatchDetail', params: { no: 7 }, kind: 'match-starting',
  });
});

// --- diffSchedule ----------------------------------------------------------

test('diffSchedule: değişmeyen kayda DOKUNULMAZ', () => {
  const plan = [{ id: 'mac:10:1', fireAt: 111 }, { id: 'mac:10:2', fireAt: 222 }];
  const { kurulacak, iptal } = diffSchedule(plan, [...plan]);
  assert.deepEqual(kurulacak, []);
  assert.deepEqual(iptal, []);
});

test('diffSchedule: yeni maç kurulur, kupondan çıkan iptal edilir', () => {
  const plan = [{ id: 'mac:10:2', fireAt: 222 }];
  const kurulu = [{ id: 'mac:10:1', fireAt: 111 }];
  const { kurulacak, iptal } = diffSchedule(plan, kurulu);
  assert.deepEqual(kurulacak.map((k) => k.id), ['mac:10:2']);
  assert.deepEqual(iptal, ['mac:10:1']);
});

test('diffSchedule: maç saati değişirse eski iptal edilip yenisi kurulur', () => {
  const plan = [{ id: 'mac:10:1', fireAt: 999 }];
  const kurulu = [{ id: 'mac:10:1', fireAt: 111 }];
  const { kurulacak, iptal } = diffSchedule(plan, kurulu);
  assert.deepEqual(kurulacak.map((k) => k.fireAt), [999]);
  assert.deepEqual(iptal, ['mac:10:1'], 'eski kayıt kalırsa telefon yanlış saatte çalar');
});

test('diffSchedule: bozuk kayıtlar çökmeye yol açmaz', () => {
  const { kurulacak, iptal } = diffSchedule([{ id: 'mac:10:1', fireAt: 5 }], [null, {}, { fireAt: 9 }]);
  assert.deepEqual(kurulacak.map((k) => k.id), ['mac:10:1']);
  assert.deepEqual(iptal, []);
});

test('plan boşsa kurulu olanların hepsi iptal listesine girer', () => {
  const { kurulacak, iptal } = diffSchedule([], [{ id: 'mac:10:1', fireAt: 1 }, { id: 'mac:10:2', fireAt: 2 }]);
  assert.deepEqual(kurulacak, []);
  assert.deepEqual(iptal, ['mac:10:1', 'mac:10:2']);
});
