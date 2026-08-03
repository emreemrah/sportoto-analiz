// BAYAT YANIT KORUMASI — geç gelen yanıt yeni haftayı ezmesin.
//
// DOĞRULANMIŞ HATA: Radar ekranının istekleri
//
//     api.radarDailyOdds(rid).then((d) => setDailyOdds(d))
//
// biçimindeydi; yanıt geldiğinde `rid`in HÂLÂ seçili hafta olup olmadığı
// sorulmuyordu. Kullanıcı istek uçarken başka haftaya geçtiğinde geç gelen
// yanıt yeni haftanın verisini eziyor ve ekranda YANLIŞ haftanın maçları
// görünüyordu. Aynı tuzak dört ayrı istekte vardı (bülten, oran, oynanma, DNA).
//
// Kaynak taraması yapıyoruz: bu ekran gerçek ağ + navigasyon istiyor, uçtan
// uca koşturulamaz. Korumanın YERİNDE olduğunu ve yeni bir istek eklenirken
// unutulmadığını bağlıyoruz.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const ham = readFileSync(join(KOK, 'src', 'screens', 'RadarScreen.js'), 'utf8');
// Yorumlar çıkarılır: açıklamadaki örnek kod gerçek kod sanılmasın.
const kod = ham.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('seçili hafta bir REF üzerinden izleniyor', () => {
  // State kapanışta (closure) donar; geç gelen yanıt eski değeri görürdü.
  assert.match(kod, /secilenRef\s*=\s*useRef\(/, 'seçili hafta ref\'i yok');
  assert.match(kod, /secilenRef\.current\s*=\s*selectedId/, 'ref güncellenmiyor');
});

test('guncelMi, seçili haftayla karşılaştırıyor', () => {
  assert.match(kod, /const guncelMi = \(rid\)/, 'guncelMi yok');
  assert.match(kod, /Number\(secilenRef\.current\) === Number\(rid\)/, 'karşılaştırma yanlış');
});

test('DÖRT isteğin hepsi korunuyor', () => {
  // Biri unutulursa o istek yine yeni haftayı ezer.
  const korumali = (kod.match(/guncelMi\(rid\)/g) || []).length;
  assert.ok(korumali >= 4, `korunan istek sayısı yetersiz: ${korumali} (beklenen ≥4)`);
});

test('koruma, state YAZMADAN ÖNCE çalışıyor', () => {
  // Kontrol yazımdan sonra gelirse hiçbir işe yaramaz.
  for (const [ad, yazan] of [
    ['oran', 'setDailyOdds(d)'],
    ['oynanma', 'setDailyPlayed(d)'],
    ['DNA', 'setPositionDna(d)'],
  ]) {
    const iYaz = kod.indexOf(yazan);
    assert.ok(iYaz > 0, `${ad}: yazan satır bulunamadı`);
    const oncesi = kod.slice(Math.max(0, iYaz - 400), iYaz);
    assert.match(oncesi, /guncelMi\(rid\)/, `${ad}: koruma yazımdan önce değil`);
  }
});

test('bülten yanıtı da korunuyor (applyResponse)', () => {
  const i = kod.indexOf('applyResponse(d, { current: false })');
  assert.ok(i > 0, 'geçmiş hafta yanıtı bulunamadı');
  const oncesi = kod.slice(Math.max(0, i - 300), i);
  assert.match(oncesi, /guncelMi\(rid\)/, 'bülten yanıtı korunmuyor');
});

test('koruma, hafta HENÜZ SEÇİLMEMİŞKEN engel olmuyor', () => {
  // İlk yüklemede selectedId null'dır; koruma orada yazımı engellerse ekran
  // hiç dolmaz. Bu yüzden null hâli açıkça geçirilir.
  assert.match(kod, /secilenRef\.current == null/, 'ilk yükleme hâli geçirilmiyor');
});
