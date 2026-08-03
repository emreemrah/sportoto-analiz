// ERİŞİLEBİLİRLİK — YALNIZ SİMGE İÇEREN DÜĞMELERİN ETİKETİ OLMALI.
//
// ÖLÇÜM (2 Ağustos 2026): uygulamada 242 dokunulabilir öğe, 40 erişilebilirlik
// etiketi vardı. Ama eksik etiketlerin çoğu SORUN DEĞİL: metin içeren bir
// düğmede ekran okuyucu zaten metni okur ("Bülteni Aç" gibi).
//
// GERÇEK sorun, çocuğu yalnız bir SİMGE olan düğmelerdir: ‹ › ✕ ✓ gibi. Ekran
// okuyucu bunları "sol tek tırnak", "çarpı" diye okur ya da hiç okumaz;
// kullanıcı düğmenin ne yaptığını bilemez. 22 böyle düğme bulundu ve
// etiketlendi.
//
// Bu test yalnız O sınıfı bağlar — tüm düğmelere etiket dayatmaz (gereksiz ve
// gürültülü olurdu, üstelik metin varken etiket okumayı BOZABİLİR).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(KOK, 'src');

function dosyalar(dizin, out = []) {
  for (const f of readdirSync(dizin, { withFileTypes: true })) {
    const p = join(dizin, f.name);
    if (f.isDirectory()) dosyalar(p, out);
    else if (/\.(js|jsx)$/.test(f.name)) out.push(p);
  }
  return out;
}

// Yalnız simge sayılan çocuklar. Harf/rakam içeren metin BU LİSTEYE GİRMEZ.
const SIMGE = /^[\s]*[✕✖×⋯…‹›▲▼◀▶←→⌄⌃➕➖✓✗]+[\s]*$/u;

function simgeDugmeleri() {
  const bulunan = [];
  for (const f of dosyalar(SRC)) {
    const satirlar = readFileSync(f, 'utf8').split('\n');
    for (let i = 0; i < satirlar.length; i += 1) {
      if (!/<TouchableOpacity/.test(satirlar[i])) continue;
      // DÜĞMENİN TAMAMI okunur (kapanış etiketine kadar).
      //
      // İlk <Text>'e bakmak yanlış pozitif üretiyordu: "📺 Haftanın Özeti" gibi
      // gerçek metni olan düğmelerde sondaki süs oku (›) düğmeyi "simge-only"
      // sanmaya yol açıyordu. Ekran okuyucu o düğmede zaten başlığı okur.
      const pencere = satirlar.slice(i, i + 14).join('\n');
      const kapanis = pencere.indexOf('</TouchableOpacity>');
      const blok = kapanis > 0 ? pencere.slice(0, kapanis) : pencere;
      // Metin İFADE de olabilir ({p.name} gibi). Süslü parantezli içeriği
      // dışlayan bir desen, gerçek metni olan satırları "simge-only" sanıyordu.
      // Bu yüzden TÜM <Text> içerikleri toplanır ve harf/rakam/ifade aranır.
      const metinler = [...blok.matchAll(/<Text[^>]*>([\s\S]*?)<\/Text>/g)].map((x) => x[1]);
      if (!metinler.length) continue;                          // metinsiz (perde vb.) — ayrı konu
      const okunurMetinVar = metinler.some((t) => /[\p{L}\p{N}{]/u.test(t));
      if (okunurMetinVar) continue;                            // ekran okuyucu zaten okur
      if (!metinler.some((t) => SIMGE.test(t))) continue;      // simge de yoksa konumuz değil
      if (/accessibilityLabel/.test(blok)) continue;
      bulunan.push(`${relative(SRC, f)}:${i + 1} → "${metinler[0].trim()}"`);
    }
  }
  return bulunan;
}

test('simge-only düğmelerin HEPSİNDE erişilebilirlik etiketi var', () => {
  const eksik = simgeDugmeleri();
  assert.deepEqual(eksik, [], `etiketsiz simge düğmeleri:\n  ${eksik.join('\n  ')}`);
});

test('hafta gezinme okları ne yaptığını söylüyor', () => {
  // "‹" tek başına yön bile bildirmez; kullanıcı hangi haftaya gittiğini bilmeli.
  for (const d of ['screens/BulletinScreen.js', 'screens/UserDashboardScreen.js',
    'screens/WeekRecapScreen.js']) {
    const kod = readFileSync(join(SRC, d), 'utf8');
    assert.match(kod, /accessibilityLabel="Önceki hafta"/, `${d}: önceki hafta etiketi yok`);
    assert.match(kod, /accessibilityLabel="Sonraki hafta"/, `${d}: sonraki hafta etiketi yok`);
  }
});

test('kapat düğmeleri "Kapat" diyor', () => {
  for (const d of ['LineupBuilder.js', 'Polls.js', 'components/TakimFiksturModal.js']) {
    const kod = readFileSync(join(SRC, d), 'utf8');
    assert.match(kod, /accessibilityLabel="Kapat"/, `${d}: kapat etiketi yok`);
  }
});

test('kupon işaret düğmesi SEÇİLİ durumunu bildiriyor', () => {
  // Görsel olarak seçili/seçili değil renkle ayrılıyor; ekran okuyucu için
  // durum ayrıca bildirilmeli, yoksa renk tek ayırt edici olur.
  const kod = readFileSync(join(SRC, 'components', 'CouponPickBlock.js'), 'utf8');
  assert.match(kod, /accessibilityState=\{\{ selected: on \}\}/, 'seçili durumu bildirilmiyor');
  assert.match(kod, /accessibilityLabel=\{`\$\{o\} işareti`\}/, 'işaret etiketi yok');
});
