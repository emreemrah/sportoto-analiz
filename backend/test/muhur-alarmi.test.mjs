// ---------------------------------------------------------------------------
// MÜHÜRLEME ALARMI — saf modül testleri (2026-08-07)
// ---------------------------------------------------------------------------
// Bu alarmın tek işi var: bir haftanın mührü kaçırılmadan ÖNCE haber vermek.
// Yanlış "her şey yolunda" demek, bu araçtaki en pahalı hatadır — çünkü mühür
// kaçtıktan sonra o hafta sonsuza dek karneye giremez.
import test from 'node:test';
import assert from 'node:assert/strict';

import { muhurSinifla, muhurOzeti, KRITIK_SAAT } from '../src/archive/muhurDurumu.js';

const SIMDI = Date.parse('2026-01-10T12:00:00.000Z');
const saatSonra = (n) => new Date(SIMDI + n * 3600000).toISOString();
const saatOnce = (n) => new Date(SIMDI - n * 3600000).toISOString();

const bulten = (ilkMac) => ({ roundId: 1500, week: '#1500', firstMatchStartAt: ilkMac, freezeAt: ilkMac });

function saglamSnap(ilkMac, { late = false, lockedAt = null } = {}) {
  const t = lockedAt || saatOnce(2);
  return {
    id: 'b', immutable: true, payloadHash: 'h', createdAt: t, dataObservedAt: t, lockedAt: t, late,
    payload: { bulletin: { freezeAt: t, firstMatchStartAt: ilkMac }, engine: { analysisEngineVersion: 'v1' }, matches: [] },
  };
}

test('mühür yok + ilk maça 3 saat → KRİTİK', () => {
  const d = muhurSinifla(bulten(saatSonra(3)), null, SIMDI);
  assert.equal(d.durum, 'bekliyor');
  assert.equal(d.seviye, 'kritik');
  assert.equal(d.kalanSaat, 3);
});

test('mühür yok + ilk maça 48 saat → yalnız bilgi (gereksiz alarm çalmaz)', () => {
  const d = muhurSinifla(bulten(saatSonra(48)), null, SIMDI);
  assert.equal(d.seviye, 'bilgi');
});

test('sınır: tam KRITIK_SAAT kala kritik sayılır', () => {
  const d = muhurSinifla(bulten(saatSonra(KRITIK_SAAT)), null, SIMDI);
  assert.equal(d.seviye, 'kritik');
});

// EN ÖNEMLİ DURUM: hafta kaybedilmiş.
test('mühür yok + ilk maç başlamış → KAYIP, geri dönüşü yok denir', () => {
  const d = muhurSinifla(bulten(saatOnce(5)), null, SIMDI);
  assert.equal(d.durum, 'kayip');
  assert.equal(d.seviye, 'kritik');
  assert.match(d.mesaj, /ARTIK GİREMEZ/);
});

test('mühür maç öncesi ve kanıtlı → sağlam, alarm yok', () => {
  const ilk = saatSonra(4);
  const d = muhurSinifla(bulten(ilk), saglamSnap(ilk), SIMDI);
  assert.equal(d.durum, 'saglam');
  assert.equal(d.seviye, 'ok');
});

test('geç mühür → uyarı, ve keşif havuzuna gideceği açıkça yazılır', () => {
  const ilk = saatOnce(10);
  const d = muhurSinifla(bulten(ilk), saglamSnap(ilk, { late: true }), SIMDI);
  assert.equal(d.durum, 'gec');
  assert.equal(d.muhurTuru, 'late_unverified');
  assert.match(d.mesaj, /keşif/i);
});

test('ilk maç saati bilinmiyorsa sessiz kalınmaz', () => {
  const d = muhurSinifla({ roundId: 1, week: '#1' }, null, SIMDI);
  assert.equal(d.durum, 'bilinmiyor');
  assert.equal(d.seviye, 'uyari');
});

// ÖZET: iyi haber kötü haberi GİZLEMEZ.
test('özet: tek sağlam hafta, bir kayıp haftayı örtmez', () => {
  const ilk = saatSonra(4);
  const satirlar = [
    { hafta: '#1526', ...muhurSinifla(bulten(ilk), saglamSnap(ilk), SIMDI) },
    { hafta: '#1525', ...muhurSinifla(bulten(saatOnce(9)), null, SIMDI) },
  ];
  const o = muhurOzeti(satirlar);
  assert.equal(o.kritikSayisi, 1);
  assert.equal(o.alarm.seviye, 'kritik');
  assert.match(o.alarm.metin, /#1525/);
  assert.equal(o.sayim.saglam, 1);
});

test('özet: her şey yolundaysa alarm null', () => {
  const ilk = saatSonra(4);
  const o = muhurOzeti([{ hafta: '#1526', ...muhurSinifla(bulten(ilk), saglamSnap(ilk), SIMDI) }]);
  assert.equal(o.alarm, null);
});
