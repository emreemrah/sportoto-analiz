// ARMA İSTEKLERİ VEKİLDEN GEÇER — gizlilik bekçisi.
//
// NEDEN: Doğrudan dış adrese giden her görsel isteği kullanıcının IP'sini ve
// hangi ekranı/bülteni açtığını üçüncü tarafa bildirir. Bülten ekranında bu
// 15 maç × 2 arma, lig tablosunda tek ekranda 18-20 arma demektir. Vekil
// (/api/crest) zaten vardı ama yalnız paylaşım karesi yolunda kullanılıyordu;
// asıl gerekçe CORS değil GİZLİLİKTİR.
//
// Bekçi, arma çizen bileşenlerin adresi crestUrlOf'tan geçirdiğini denetler.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crestUrlOf } from '../src/crestUrl.js';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const oku = (...p) => readFileSync(join(kok, ...p), 'utf8');

// Arma çizen bileşenler ve içindeki fonksiyon adı.
const BILESENLER = [
  [['src', 'ui.js'], 'export function Logo'],
  [['src', 'screens', 'BulletinScreen.js'], 'function TeamLogo'],
  [['src', 'screens', 'MatchDetailScreen.js'], 'function TableLogo'],
  [['src', 'screens', 'studioParts.js'], null],   // dosya genelinde
];

test('arma çizen her bileşen adresi crestUrlOf\'tan geçiriyor', () => {
  for (const [yol, imza] of BILESENLER) {
    const kaynak = oku(...yol);
    const blok = imza
      ? kaynak.slice(kaynak.indexOf(imza), kaynak.indexOf(imza) + 900)
      : kaynak;
    assert.ok(blok.includes('crestUrlOf'),
      `${yol.join('/')}${imza ? ` (${imza})` : ''} armayı doğrudan çiziyor — vekilden geçmeli`);
  }
});

test('ham `uri: logo` kalıbı kalmadı (doğrudan dış adres)', () => {
  for (const [yol] of BILESENLER) {
    const kaynak = oku(...yol);
    assert.ok(!/uri:\s*logo\b/.test(kaynak),
      `${yol.join('/')} içinde ham "uri: logo" var — vekilden geçmiyor`);
    assert.ok(!/source=\{\{\s*uri\s*\}\}/.test(kaynak),
      `${yol.join('/')} içinde ham "uri" kısayolu var`);
  }
});

// BOZMAMA KURALI — crestUrlOf bugün çalışan bir görseli kaybetmemeli.
test('taban adres yoksa adrese DOKUNULMAZ', () => {
  const dis = 'https://ornek-cdn.example/arma/1.png';
  assert.equal(crestUrlOf(dis, ''), dis, 'taban bilinmiyorsa adres değişmemeli');
  assert.equal(crestUrlOf(dis, null), dis);
});

test('boş girdi boş döner — placeholder yolu korunur', () => {
  assert.equal(crestUrlOf('', 'http://sunucu:4000'), '');
  assert.equal(crestUrlOf(null, 'http://sunucu:4000'), '');
  assert.equal(crestUrlOf(undefined, 'http://sunucu:4000'), '');
});

test('dış adres vekile çevrilir, kendi sunucumuz olduğu gibi kalır', () => {
  const taban = 'http://sunucu:4000';
  const dis = 'https://ornek-cdn.example/arma/1.png';
  const cikti = crestUrlOf(dis, taban);
  assert.ok(cikti.startsWith(`${taban}/api/crest?u=`), `vekile çevrilmedi: ${cikti}`);
  assert.ok(cikti.includes(encodeURIComponent(dis)), 'özgün adres kodlanarak taşınmalı');

  // Kendi sunucumuzdaki adres ikinci kez sarılmaz (sonsuz vekil zinciri olmaz).
  const kendi = `${taban}/api/crest?u=abc`;
  assert.equal(crestUrlOf(kendi, taban), kendi);
});
