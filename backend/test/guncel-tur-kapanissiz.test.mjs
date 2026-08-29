// GÜNCEL TUR — kapanış tarihi girilmemiş yayınlanmış hafta.
//
// GERÇEK ARIZA (29 Ağu 2026): Spor Toto 4. Haftayı (1531) isPublished=true ve
// 15 maçla yayınladı ama roundCloseDate=null bıraktı. `new Date(null)` 1970
// sayılınca hafta en eskiye düştü, güncel tur 3. Haftada kaldı ve uygulamaya
// yeni bülten hiç gelmedi. Bu test o veriyle (uydurma değil) kuralı bekçiler.
import test from 'node:test';
import assert from 'node:assert/strict';
import { guncelTurSec, yayinlanmisTurlar, kapanisAni } from '../src/sources/sportoto.js';

const TURLAR = [
  { id: 1531, name: '4. Hafta', year: '2026/2027', roundCloseDate: null, isPublished: true },
  { id: 1529, name: '2. Hafta', year: '2026/2027', roundCloseDate: '2026-08-21T21:25:00', isPublished: true },
  { id: 1530, name: '3. Hafta', year: '2026/2027', roundCloseDate: '2026-08-28T21:25:00', isPublished: true },
];
const an = (s) => new Date(s).getTime();

test('kapanışı girilmemiş yayınlanmış hafta, önceki hafta kapandıysa GÜNCEL turdur', () => {
  assert.equal(guncelTurSec(TURLAR, an('2026-08-29T14:00:00'))?.id, 1531);
});

test('önceki haftanın kapanışı gelmediyse o kalır; tarihsiz hafta sırada bekler', () => {
  assert.equal(guncelTurSec(TURLAR, an('2026-08-27T12:00:00'))?.id, 1530);
});

test('yayınlanmamış hafta ASLA seçilmez (resmi sitede de görünmez)', () => {
  const turlar = TURLAR.map((r) => (r.id === 1531 ? { ...r, isPublished: false } : r));
  assert.equal(guncelTurSec(turlar, an('2026-08-29T14:00:00'))?.id, 1530);
});

test('sıralama eski→yeni, kapanışı bilinmeyen EN SONDA; bozuk tarih elenir', () => {
  const ids = yayinlanmisTurlar([...TURLAR, { id: 9, name: 'bozuk', roundCloseDate: 'abc', isPublished: true }]).map((r) => r.id);
  assert.deepEqual(ids, [1529, 1530, 1531]);
  assert.equal(kapanisAni({ roundCloseDate: null }), Infinity);
  assert.equal(kapanisAni({ roundCloseDate: '' }), Infinity);
  assert.ok(Number.isNaN(kapanisAni({ roundCloseDate: 'abc' })));
});

test('hiç gelecek hafta yoksa en son kapanan hafta gösterilmeye devam eder', () => {
  const turlar = TURLAR.filter((r) => r.id !== 1531);
  assert.equal(guncelTurSec(turlar, an('2026-08-29T14:00:00'))?.id, 1530);
  assert.equal(guncelTurSec([], Date.now()), null);
});
