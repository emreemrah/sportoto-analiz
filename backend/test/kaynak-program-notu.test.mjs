// KAYNAĞIN "PROGRAM HENÜZ YÜKLENMEDİ" NOTU — hata değil, takvim.
//
// GERÇEK YANIT (29 Ağu 2026, st.nesine.com/v2/Program):
//   {"sc":400,"d":null,"el":[{"c":1502,"m":"Yeni program 30.08.2026 10:00 tarihinde yüklenecektir."}],"ml":null}
// Eskiden "programı alınamadı (maç yok)" diye yutuluyor, ekran "bu hafta devre
// dışı" diyordu. Artık not kullanıcıya aynen taşınır; marka adı hata metnine girmez.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNesineProgram, buildNesineAdapter } from '../src/providers/nesine.js';

const YANIT = { sc: 400, d: null, el: [{ c: 1502, m: 'Yeni program 30.08.2026 10:00 tarihinde yüklenecektir.' }], ml: null };

test('parse: d=null + el[].m → boş program + kaynakNotu', () => {
  const p = parseNesineProgram(YANIT);
  assert.deepEqual(p.events, []);
  assert.equal(p.kaynakNotu, 'Yeni program 30.08.2026 10:00 tarihinde yüklenecektir.');
  assert.equal(parseNesineProgram({ sc: 200, d: { matches: 'x' } }), null, 'tanınmayan biçim yine null');
});

test('fetchPercentages: not kullanıcıya aynen taşınır, marka adı hata metninde YOK', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => YANIT });
  const a = buildNesineAdapter({ fetchImpl });
  await assert.rejects(a.fetchPercentages({ matches: [] }), (e) => {
    assert.match(e.kullaniciNotu, /30\.08\.2026 10:00/);
    assert.match(e.kullaniciNotu, /otomatik toplanır/);
    assert.doesNotMatch(e.message, /nesine/i);
    assert.doesNotMatch(e.kullaniciNotu, /nesine/i);
    return true;
  });
});

test('fetchPercentages: program boş ve not yoksa eski davranış (maç yok), marka adsız', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ d: { matches: [] } }) });
  const a = buildNesineAdapter({ fetchImpl });
  await assert.rejects(a.fetchPercentages({ matches: [] }), (e) => {
    assert.match(e.message, /maç yok/);
    assert.doesNotMatch(e.message, /nesine/i);
    assert.equal(e.kullaniciNotu, null);
    return true;
  });
});
