// RADAR 5 — OYNANMA YÜZDESİ SÜZGECİ TESTLERİ.
//
// Bu süzgeç, satır başlığındaki 1/X/2 yüzdesinin TABANINI belirliyor: hangi
// geçmiş maçlar seçilirse yüzde ondan çıkıyor. Yanlış seçim sessizdir — ekranda
// yine düzgün bir yüzde görünür, ama başka bir şeyi ölçer. Testler o yüzden
// SINIRLARI kovalıyor: eksik veri, tam tolerans, kesim yönü, boş sonuç.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  oynanmaSuzgeci, benzerMaclar, sonucDagilimi, yakinMi, yuzdeUclusu, sayi,
  TOLERANS, AZ_ORNEKLEM, MAC_LIMIT_DEGERI, suzgecModuMu,
} from '../src/radar/oynanmaSuzgeci.js';

/** Geçmiş maç kaydı — /position-matches yanıtının ekranda kullanılan alanları. */
const mac = (week, result, pct) => ({
  roundId: String(1500 + week), week: `${week}. Hafta`,
  home: 'Ev', away: 'Dep', score: '1-0', result,
  played: pct ? { gun: '2026-08-01', pct } : null,
});

const HEDEF = { '1': 50, X: 30, '2': 20 };

test('yüzdesi OLMAYAN geçmiş maç süzgece girmez ("0" sayılmaz)', () => {
  // Number(null) === 0 tuzağı: elenmezse bu üç maç "%0/%0/%0" profiliyle
  // hesaba girer ve olmayan veriden benzerlik üretiriz.
  const liste = [
    mac(60, '1', null),                                 // played yok
    mac(59, 'X', { '1': null, X: 30, '2': 20 }),        // seçeneklerden biri boş
    mac(58, '2', { '1': '', X: '', '2': '' }),          // boş metin
    mac(57, '1', HEDEF),                                // tek geçerli kayıt
  ];
  const r = oynanmaSuzgeci({ liste, hedefPct: HEDEF });
  assert.equal(r.maclar.length, 1);
  assert.equal(r.maclar[0].week, '57. Hafta');

  // ASIL TEHLİKELİ HÂL: eksik seçeneğin hedefteki karşılığı ZATEN küçükse
  // (ör. "2 %2"), boşluğu 0 saymak farkı 2 puan gösterir ve maç süzgece
  // SESSİZCE girer. Gerçek bültende sık görülen bir dağılım.
  const azDeplasman = { '1': 52, X: 46, '2': 2 };
  const eksikKayit = mac(55, '1', { '1': 52, X: 46, '2': null });
  assert.equal(
    oynanmaSuzgeci({ liste: [eksikKayit], hedefPct: azDeplasman }).maclar.length, 0,
    'eksik seçenek 0 sayılmış — olmayan veriden benzerlik üretiliyor',
  );
});

test('±3 sınırı: tam 3 puan fark GİRER, 4 puan GİRMEZ', () => {
  assert.equal(TOLERANS, 3, 'tolerans sabiti değişmiş — ekrandaki metinler de bakılmalı');
  const tamSinir = mac(60, '1', { '1': 53, X: 27, '2': 20 });   // farklar: 3, 3, 0
  const birFazla = mac(59, 'X', { '1': 54, X: 30, '2': 20 });   // fark: 4
  const r = oynanmaSuzgeci({ liste: [tamSinir, birFazla], hedefPct: HEDEF });
  assert.deepEqual(r.maclar.map((m) => m.week), ['60. Hafta']);
});

test('ÜÇ yüzde birden sınanır — tek seçenek tutması yetmez', () => {
  // "%50 ev" iki farklı dağılımda çok farklı anlam taşır.
  assert.equal(yakinMi({ '1': 50, X: 40, '2': 10 }, HEDEF), false);
  assert.equal(yakinMi({ '1': 50, X: 30, '2': 20 }, HEDEF), true);
  assert.equal(yakinMi(null, HEDEF), false);
  assert.equal(yakinMi(HEDEF, undefined), false);
});

test('limit EN YENİ maçları alır (liste yeniden eskiye gelir)', () => {
  const liste = [60, 59, 58, 57, 56, 55].map((h) => mac(h, '1', HEDEF));
  const r = oynanmaSuzgeci({ liste, hedefPct: HEDEF, limit: 3 });
  assert.deepEqual(r.maclar.map((m) => m.week), ['60. Hafta', '59. Hafta', '58. Hafta']);
  // limit null/0 → kesim yok (alt satırdaki "Tüm maçlar" çipi).
  assert.equal(benzerMaclar(liste, HEDEF, { limit: null }).length, 6);
  assert.equal(MAC_LIMIT_DEGERI.tum, null);
  assert.equal(MAC_LIMIT_DEGERI.son5, 5);
});

test('boş sonuçta yüzde NULL döner — uydurma sayı yok', () => {
  const uzak = [mac(60, '1', { '1': 20, X: 20, '2': 60 })];
  const r = oynanmaSuzgeci({ liste: uzak, hedefPct: HEDEF });
  assert.equal(r.pct, null);
  assert.equal(r.ornek, 0);
  assert.equal(r.sebep, 'eslesmeYok');

  // Hiç liste yoksa da aynı: sayı üretilmez.
  assert.equal(oynanmaSuzgeci({ liste: [], hedefPct: HEDEF }).pct, null);
  assert.equal(oynanmaSuzgeci({ liste: null, hedefPct: HEDEF }).pct, null);
});

test('güncel maçın yüzdesi yoksa SEBEP ayrışır (hedefYok ≠ eşleşmeYok)', () => {
  // İkisi tek mesaja indirilirse kullanıcı eksiği yanlış yere (geçmişe) yıkar.
  const liste = [mac(60, '1', HEDEF)];
  assert.equal(oynanmaSuzgeci({ liste, hedefPct: null }).sebep, 'hedefYok');
  assert.equal(oynanmaSuzgeci({ liste, hedefPct: { '1': 50, X: null, '2': 20 } }).sebep, 'hedefYok');
  assert.equal(oynanmaSuzgeci({ liste, hedefPct: { '1': 90, X: 5, '2': 5 } }).sebep, 'eslesmeYok');
});

test('yüzde SÜZÜLMÜŞ listeden hesaplanır — başlık listeyle çelişemez', () => {
  const liste = [
    mac(60, '1', HEDEF), mac(59, 'X', HEDEF), mac(58, '1', HEDEF), mac(57, '2', HEDEF),
    mac(56, '1', { '1': 90, X: 5, '2': 5 }),   // uzak — hesaba girmemeli
  ];
  const r = oynanmaSuzgeci({ liste, hedefPct: HEDEF });
  assert.equal(r.ornek, 4);
  assert.equal(r.maclar.length, 4, 'liste ile örneklem aynı diziden gelmeli');
  assert.equal(r.pct['1'], 50);   // 2/4
  assert.equal(r.pct.X, 25);      // 1/4
  assert.equal(r.pct['2'], 25);   // 1/4
  assert.equal(Math.round(r.pct['1'] + r.pct.X + r.pct['2']), 100);
});

test('örneklem 5\'in altındaysa "az" işaretlenir', () => {
  assert.equal(AZ_ORNEKLEM, 5);
  const dort = [60, 59, 58, 57].map((h) => mac(h, '1', HEDEF));
  assert.equal(oynanmaSuzgeci({ liste: dort, hedefPct: HEDEF }).az, true);
  const bes = [...dort, mac(56, 'X', HEDEF)];
  assert.equal(oynanmaSuzgeci({ liste: bes, hedefPct: HEDEF }).az, false);
});

test('sonucu okunamayan satır örnekleme sayılmaz', () => {
  assert.equal(sonucDagilimi([{ result: 'K' }, { result: null }]), null);
  assert.equal(sonucDagilimi([]), null);
  const d = sonucDagilimi([{ result: '1' }, { result: 'Y' }]);
  assert.equal(d.ornek, 1);
});

test('yardımcılar: sayi() ve yuzdeUclusu() boş değeri sıfıra çevirmez', () => {
  assert.equal(sayi(null), null);
  assert.equal(sayi(''), null);
  assert.equal(sayi(false), null);
  assert.equal(sayi('abc'), null);
  assert.equal(sayi('42'), 42);
  assert.equal(sayi(0), 0);
  assert.equal(yuzdeUclusu({ '1': 50, X: 30 }), null);       // eksik seçenek
  assert.equal(yuzdeUclusu({ '1': -1, X: 50, '2': 51 }), null); // negatif yüzde
  assert.deepEqual(yuzdeUclusu({ '1': '50', X: 30, '2': 20 }), { '1': 50, X: 30, '2': 20 });
});

test('süzgeç modları hafta pencerelerinden AYRILIR', () => {
  // Karışırsa ekran hafta penceresi arar, bulamaz ve sessizce boş kalır.
  assert.equal(suzgecModuMu('oynanmaYuzdesi'), true);
  assert.equal(suzgecModuMu('oran'), true);
  for (const k of ['allTime', 'last5', 'last10', 'last15']) {
    assert.equal(suzgecModuMu(k), false, `${k} hafta penceresidir`);
  }
});
