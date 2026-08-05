// Takım renk teması — saf modül testleri.
import test from 'node:test';
import assert from 'node:assert/strict';
import { adNormalize, takimTemasi } from '../src/takimTema.js';

test('adNormalize: Türkçe karakter + harf dışı temizliği', () => {
  assert.equal(adNormalize('Beşiktaş JK'), 'besiktasjk');
  assert.equal(adNormalize('Arsenal FC'), 'arsenalfc');
  assert.equal(adNormalize(''), '');
});

test('bilinen takımlar temasını bulur (ör. Galatasaray sarı-kırmızı)', () => {
  assert.deepEqual(takimTemasi('Galatasaray'), { ana: '#A32638', vurgu: '#FDB912' });
  assert.equal(takimTemasi('Arsenal FC').ana, '#EF0107');
  assert.equal(takimTemasi('Fenerbahçe').vurgu, '#FFED00');
});

test('Inter Milan, AC Milan temasına YANLIŞ düşmez', () => {
  assert.equal(takimTemasi('Inter Milan').ana, '#0068A8');
  assert.equal(takimTemasi('AC Milan').ana, '#FB090B');
});

test('listede olmayan takım → null (renk uydurulmaz, varsayılan tema kalır)', () => {
  assert.equal(takimTemasi('Sarpsborg 08'), null);
  assert.equal(takimTemasi(null), null);
});

test('komple tema: palet ezmeleri doğru üretilir', async () => {
  const { paletEzmeleri, koyulastir, alfa } = await import('../src/takimTema.js');
  const e = paletEzmeleri({ ana: '#A32638', vurgu: '#FDB912' });
  assert.equal(e.primary, '#A32638');
  assert.equal(e.accent, '#A32638');
  assert.equal(e.primaryDark, koyulastir('#A32638', 0.3));
  assert.equal(e.accentSoft, alfa('#A32638', 0.12));
  assert.deepEqual(paletEzmeleri(null), {}); // tema yoksa palete DOKUNULMAZ
});

test('tersTema: iki renk düzeni yer değiştirir (açık/koyu mod gibi)', async () => {
  const { tersTema } = await import('../src/takimTema.js');
  assert.deepEqual(tersTema({ ana: '#A32638', vurgu: '#FDB912' }), { ana: '#FDB912', vurgu: '#A32638' });
  assert.equal(tersTema(null), null);
});

test('renk yardımcıları: koyulaştır ve alfa geçerli değer üretir', async () => {
  const { koyulastir, alfa } = await import('../src/takimTema.js');
  assert.match(koyulastir('#A32638', 0.3), /^#[0-9a-f]{6}$/);
  assert.equal(alfa('#ff0000', 0.5), 'rgba(255,0,0,0.5)');
  assert.equal(koyulastir('bozuk', 0.3), 'bozuk'); // geçersiz girdi aynen döner
});
