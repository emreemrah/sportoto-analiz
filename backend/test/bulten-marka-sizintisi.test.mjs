// BÜLTEN YANITINDA BAHİS SİTESİ ADI GEÇMEZ.
//
// ÜRETİMDE ÖLÇÜLDÜ (16 Ağustos 2026):
//   /api/radar/current → providerId "k1"      (maskeli ✅)
//   /api/bulletin      → providerId "nesine"  (HAM ❌, 15 maçın hepsinde)
//   yol: radarCenter.matches[].radars.publicBetting.details.providers[]
//
// Sebep: `radarKaynaklariniKodla` RADAR ROTALARINDA uygulanıyordu; bülten ise
// `radarCenter`'ı taşıdığı hâlde o rotadan geçmiyor (`refresh.js` ham hâlini
// bültene iliştiriyor). Yani maskeleme sınırı eksikti.
//
// Marka adı yasal/mağaza kısıtı — yanıta HİÇ çıkmamalı. İç hesap ve MÜHÜRLÜ
// snapshot ham kimliği kullanmaya devam eder (benzer-DNA eşleşmesi ona bağlı
// ve geçmiş mühürler değiştirilemez); nötrleme yalnız HTTP sınırında olur.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { radarKaynaklariniKodla } = await import('../src/routes/radar.js');

const MARKALAR = /nesine|bilyoner|misli|iddaa|oley/i;

const hamRadarCenter = () => ({
  matches: [
    {
      no: 1,
      radars: {
        publicBetting: {
          hasData: true,
          details: {
            providers: [
              { providerId: 'nesine', id: 'nesine', name: 'Nesine', count: 3 },
              { providerId: 'bilyoner', count: 1 },
            ],
          },
        },
      },
    },
    {
      no: 2,
      radars: { publicBetting: { hasData: false, details: { providers: [{ providerId: 'misli' }] } } },
    },
  ],
});

test('ham sağlayıcı kimliği koda çevrilir — marka çıkmaz', () => {
  const kodlu = radarKaynaklariniKodla(hamRadarCenter());
  const metin = JSON.stringify(kodlu);

  assert.ok(!MARKALAR.test(metin), `marka sızdı: ${metin.slice(0, 200)}`);
  const p = kodlu.matches[0].radars.publicBetting.details.providers;
  assert.equal(p[0].providerId, 'k1', 'nesine → k1 (eşleme sabit, renkle hizalı)');
  // `bilyoner` backend eşlemesinde YOK → tek kova k0. Sızıntı olmaması yeter;
  // uydurma kod üretilmemesi bilinçli (bkz. providers/kaynakKodu.js).
  assert.equal(p[1].providerId, 'k0');
  assert.equal(kodlu.matches[1].radars.publicBetting.details.providers[0].providerId, 'k2');
});

test('marka taşıyan yardımcı alanlar (id / name) DÜŞÜRÜLÜR', () => {
  const kodlu = radarKaynaklariniKodla(hamRadarCenter());
  const p = kodlu.matches[0].radars.publicBetting.details.providers[0];
  assert.equal(p.id, undefined, 'ham id yanıtta kalmış');
  assert.equal(p.name, undefined, 'marka adı yanıtta kalmış');
  assert.equal(p.count, 3, 'markayla ilgisi olmayan alan korunmalı');
});

test('tanınmayan kimlik de sızmaz — k0 olur', () => {
  const kodlu = radarKaynaklariniKodla({
    matches: [{ no: 1, radars: { publicBetting: { details: { providers: [{ providerId: 'yenisaglayici' }] } } } }],
  });
  assert.equal(kodlu.matches[0].radars.publicBetting.details.providers[0].providerId, 'k0');
});

test('bülten ucu radarCenter için AYNI fonksiyonu çağırır (ikinci tanım yok)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  assert.ok(
    /radarCenter:\s*radarKaynaklariniKodla\(/.test(src),
    'bülten yanıtı radarCenter\'ı maskelemeden gönderiyor',
  );
  // Maskeleme mantığı YALNIZ bir yerde tanımlı olmalı.
  const radarSrc = fs.readFileSync(new URL('../src/routes/radar.js', import.meta.url), 'utf8');
  const tanim = (radarSrc.match(/function radarKaynaklariniKodla\(/g) || []).length
    + (src.match(/function radarKaynaklariniKodla\(/g) || []).length;
  assert.equal(tanim, 1, 'ikinci bir maskeleme tanımı eklenmiş');
});

test('radarCenter yoksa bülten yanıtı bozulmaz', () => {
  assert.equal(radarKaynaklariniKodla(null), null);
  assert.deepEqual(radarKaynaklariniKodla({ master: {} }), { master: {} });
});
