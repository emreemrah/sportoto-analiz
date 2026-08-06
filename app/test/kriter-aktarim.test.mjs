// KRİTER AKTARIMI — kullanıcının kriter setinden kupon seçimi üretimi.
//
// HANGİ ARIZA İÇİN YAZILDI (2026-08-06): "Geniş" seçeneği motorun kapsayıcı
// `closedPrediction` alanını kullanıyordu. Kullanıcının kriter seti beraberlik
// sinyali üretmiyorsa o alan HER maçta '12' olur; ekranda 15 maçın 14'ü
// "1-2" göründü ve kullanıcı haklı olarak "seçtiğim kritere göre yanlış
// seçimler" dedi. Artık geniş = tekli + GEREKİRSE ikinci (destek farkına göre).
import test from 'node:test';
import assert from 'node:assert/strict';
import { macSecimi, kriterAktarimi, CEKISME_FARKI } from '../src/kriterAktarim.js';

const mac = (no, master) => ({ no, master });
// Gerçek vakadan (1527, kullanıcının 14 kriterlik seti): X desteği hep 0.
const m = (ana, alt, s1, sX, s2) => ({
  mainPrediction: ana, alternativePrediction: alt, closedPrediction: '12',
  normalizedSupport1: s1, normalizedSupportX: sX, normalizedSupport2: s2,
});

test('tekli: yalnız ana tercih', () => {
  assert.deepEqual(macSecimi(m('1', '2', 89, 0, 11)), ['1']);
  assert.deepEqual(macSecimi(m('2', '1', 20, 0, 80)), ['2']);
});

test('geniş: açık ara favoride GENİŞLETMEZ — eski hata buydu', () => {
  // 89-11: ikinci işaret eklemek bilgi değil gürültü.
  assert.deepEqual(macSecimi(m('1', '2', 89, 0, 11), { genis: true }), ['1']);
  assert.deepEqual(macSecimi(m('2', '1', 18, 0, 82), { genis: true }), ['2']);
});

test('geniş: çekişmeli maçta ikinci işaret eklenir', () => {
  // 51-49 → çekişmeli
  assert.deepEqual(macSecimi(m('1', '2', 51, 0, 49), { genis: true }), ['1', '2']);
  // 56-44 (fark 12 < 25) → çekişmeli
  assert.deepEqual(macSecimi(m('1', '2', 56, 0, 44), { genis: true }), ['1', '2']);
  // Tam eşikte (fark = 25) genişletilmez — sınır dahil değil
  assert.deepEqual(macSecimi(m('1', '2', 62.5, 0, 37.5), { genis: true }), ['1']);
});

test('geniş: X ikinci sıradaysa X eklenir ve SIRA korunur', () => {
  assert.deepEqual(macSecimi({ ...m('1', 'X', 55, 45, 0) }, { genis: true }), ['1', 'X']);
  assert.deepEqual(macSecimi({ ...m('2', 'X', 0, 45, 55) }, { genis: true }), ['X', '2']);
});

test('destek bilinmiyorsa çekişmeli sayılır — olmayan kesinlik iddia edilmez', () => {
  const eksik = { mainPrediction: '1', alternativePrediction: '2' };
  assert.deepEqual(macSecimi(eksik, { genis: true }), ['1', '2']);
});

test('veri yoksa seçim üretilmez (uydurma yok)', () => {
  assert.equal(macSecimi(null), null);
  assert.equal(macSecimi({ mainPrediction: null }), null);
  assert.equal(macSecimi({ mainPrediction: null, closedPrediction: '1X2' }, { genis: true }), null);
});

test('bülten: kilitli maçlara dokunulmaz, veri yoksa boş bırakılır', () => {
  const maclar = [
    mac(1, m('1', '2', 80, 0, 20)),
    mac(2, m('2', '1', 30, 0, 70)),
    mac(3, { mainPrediction: null }),            // veri yok
    mac(4, m('1', '2', 52, 0, 48)),
  ];
  const r = kriterAktarimi(maclar, { genis: true, kilitliNolar: new Set([2]) });
  assert.deepEqual(Object.keys(r.secimler), ['1', '4']);
  assert.deepEqual(r.secimler[1], ['1'], 'açık ara favori genişletilmemeli');
  assert.deepEqual(r.secimler[4], ['1', '2'], 'çekişmeli maç genişletilmeli');
  assert.equal(r.istatistik.veriYok, 1);
  assert.ok(r.uyarilar.some((u) => /kriter verisi yok/.test(u)));
});

test('DÜRÜSTLÜK: kriter seti X üretemiyorsa kullanıcı UYARILIR', () => {
  const maclar = [mac(1, m('1', '2', 80, 0, 20)), mac(2, m('2', '1', 20, 0, 80))];
  const r = kriterAktarimi(maclar, { genis: true });
  assert.ok(
    r.uyarilar.some((u) => /beraberlik \(X\) sinyali üretmiyor/.test(u)),
    'X üretmeyen kriter setinde uyarı verilmiyor',
  );
});

test('X üreten set varsa gereksiz uyarı ÇIKMAZ', () => {
  const maclar = [mac(1, { ...m('1', 'X', 55, 45, 0) })];
  const r = kriterAktarimi(maclar, { genis: true });
  assert.ok(!r.uyarilar.some((u) => /beraberlik/.test(u)));
});

test('eşik sabiti makul aralıkta (regresyon bekçisi)', () => {
  assert.ok(CEKISME_FARKI > 10 && CEKISME_FARKI <= 40, 'çekişme eşiği anlamsız bir değere kaymış');
});
