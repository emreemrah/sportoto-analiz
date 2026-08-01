// YAYIN YAPILANDIRMASI testleri — mağaza sürümünde localhost/LAN/şifresiz
// adres ve demo modu SIZAMAZ.
import test from 'node:test';
import assert from 'node:assert/strict';

test('yayın: yerel ve şifresiz adresler reddedilir', async () => {
  const { resolveApiBase } = await import('../src/apiBase.js');
  const bad = [
    'http://localhost:4000',
    'http://127.0.0.1:4000',
    'http://192.168.1.100:4000',
    'https://192.168.1.100',
    'http://10.0.0.5:4000',
    'http://172.16.0.9:4000',
    'http://api.ornek.com', // https değil
  ];
  for (const b of bad) {
    assert.throws(
      () => resolveApiBase({ envBase: b, isDev: false, platform: 'android' }),
      /YAPILANDIRMA HATASI/,
      `yayında reddedilmeli: ${b}`,
    );
  }
});

test('yayın: adres verilmeyen mobil derleme sessizce yerele düşmez', async () => {
  const { resolveApiBase } = await import('../src/apiBase.js');
  assert.throws(
    () => resolveApiBase({ envBase: '', isDev: false, platform: 'android' }),
    /EXPO_PUBLIC_API_BASE/,
  );
  // Web'de aynı origin geçerlidir (sayfa HTTPS ise istek de HTTPS'tir).
  assert.equal(resolveApiBase({ envBase: '', isDev: false, platform: 'web' }), '');
});

test('yayın: geçerli HTTPS adresi kabul edilir, sondaki eğik çizgi temizlenir', async () => {
  const { resolveApiBase } = await import('../src/apiBase.js');
  assert.equal(
    resolveApiBase({ envBase: 'https://api.ornek.com/', isDev: false, platform: 'android' }),
    'https://api.ornek.com',
  );
});

test('geliştirme: eski yerel davranış korunur', async () => {
  const { resolveApiBase } = await import('../src/apiBase.js');
  assert.equal(resolveApiBase({ envBase: '', isDev: true, platform: 'web' }), 'http://localhost:4000');
  assert.equal(resolveApiBase({ envBase: '', isDev: true, platform: 'android' }), 'http://192.168.1.100:4000');
});
