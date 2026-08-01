// RESMÎ LİSTE BİÇİMLENDİRME TESTLERİ.
//
// Bu ekran resmî sitedeki düzeni yansıtır. Buradaki tek risk, resmî listede
// OLMAYAN bir sayının bizde görünmesi — özellikle "henüz açıklanmadı"
// durumunun 0 diye yazılması.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOS, macGunu, macSaati, skorMetni, sonucMetni, kapanisMetni, tlMetni,
  kademeSatirlari, altSatirlar, haftaSecenekleri, sezonMetni,
} from '../src/resmiListe.js';

test('maç günü resmî biçimde: "09.08.2026-Pazar"', () => {
  // 9 Ağustos 2026 bir Pazar.
  assert.equal(macGunu('2026-08-09T17:00:00'), '09.08.2026-Pazar');
  assert.equal(macGunu('2026-08-08T15:00:00'), '08.08.2026-Cumartesi');
  // Gün ve ay TEK HANE ise sıfırla doldurulur (resmî listede öyle).
  assert.equal(macGunu('2026-01-04T15:00:00'), '04.01.2026-Pazar');
});

test('geçersiz tarih SAYI ÜRETMEZ', () => {
  assert.equal(macGunu(null), BOS);
  assert.equal(macGunu('abc'), BOS);
  assert.equal(macSaati(undefined), BOS);
  assert.equal(kapanisMetni(''), BOS);
});

test('maç saati iki haneli', () => {
  assert.equal(macSaati('2026-08-09T17:00:00'), '17:00');
  assert.equal(macSaati('2026-08-09T09:05:00'), '09:05');
});

test('skor yoksa "–", varsa "ev-dep"', () => {
  assert.equal(skorMetni({ score: null }), '–');
  assert.equal(skorMetni({}), '–');
  assert.equal(skorMetni({ score: { home: 2, away: 1 } }), '2-1');
  // 0-0 GERÇEK bir skordur, "–" ile karıştırılmamalı.
  assert.equal(skorMetni({ score: { home: 0, away: 0 } }), '0-0');
});

test('sonuç RESMÎ yazımda — beraberlik "0", X değil', () => {
  assert.equal(sonucMetni({ result: '1' }), '1');
  assert.equal(sonucMetni({ result: 'X' }), '0');
  assert.equal(sonucMetni({ result: '2' }), '2');
  assert.equal(sonucMetni({ result: null }), '–');
  assert.equal(sonucMetni({}), '–');
});

test('kapanış resmî biçimde: "08 Ağustos Cumartesi 2026 14:55"', () => {
  assert.equal(kapanisMetni('2026-08-08T14:55:00'), '08 Ağustos Cumartesi 2026 14:55');
});

test('TL biçimi binlik ayraçlı; sıfır/geçersiz null döner', () => {
  assert.equal(tlMetni(1234567.5), '1.234.567,50 TL');
  assert.equal(tlMetni(1250), '1.250,00 TL');
  assert.equal(tlMetni(0), null, 'sıfır ikramiye "0,00 TL" diye yazılmamalı');
  assert.equal(tlMetni(null), null);
  assert.equal(tlMetni('abc'), null);
});

test('ikramiye AÇIKLANMAMIŞSA "----" — sıfır YAZILMAZ', () => {
  // Resmî sitede sonuçlar açıklanmadan bu satırlar "----" gösterir.
  // 0 yazmak "hiç kimse bilemedi" diye okunur; oysa doğru ifade
  // "henüz açıklanmadı"dır — ikisi tamamen farklı şeyler.
  const s = kademeSatirlari(null);
  assert.equal(s.length, 4);
  assert.deepEqual(s.map((x) => x.etiket), ['15 Bilen', '14 Bilen', '13 Bilen', '12 Bilen']);
  for (const x of s) {
    assert.equal(x.deger, BOS);
    assert.equal(x.bos, true);
  }
});

test('ikramiye açıklandıysa kazanan sayısı VE tutar birlikte', () => {
  const s = kademeSatirlari({
    tiers: [
      { hit: 15, count: 0, prize: 0 },
      { hit: 14, count: 3, prize: 1234567.5 },
      { hit: 13, count: 420, prize: 1500 },
    ],
  });
  const bul = (e) => s.find((x) => x.etiket === e);
  // 15'te KAZANAN YOK: bu bir bilgidir (devreden var demektir), boşluk değil.
  assert.equal(bul('15 Bilen').deger, '0 kişi');
  assert.equal(bul('15 Bilen').bos, false);
  assert.equal(bul('14 Bilen').deger, '3 kişi · 1.234.567,50 TL');
  assert.equal(bul('13 Bilen').deger, '420 kişi · 1.500,00 TL');
  // Verisi hiç gelmeyen kademe "----" kalır.
  assert.equal(bul('12 Bilen').deger, BOS);
});

test('alt satırlar: kapanış ve açıklamalar', () => {
  const s = altSatirlar({ closeDate: '2026-08-08T14:55:00', description: 'Devreden ikramiye vardır.' });
  assert.deepEqual(s.map((x) => x.etiket), ['Kapanış', 'Açıklamalar']);
  assert.equal(s[0].deger, '08 Ağustos Cumartesi 2026 14:55');
  assert.equal(s[1].deger, 'Devreden ikramiye vardır.');
  // Açıklama yoksa uydurulmaz.
  assert.equal(altSatirlar(null)[1].deger, BOS);
});

test('kapanış tarihi yalnız hafta kaydında varsa oradan alınır', () => {
  const s = altSatirlar({ description: 'x' }, '2026-08-08T14:55:00');
  assert.equal(s[0].deger, '08 Ağustos Cumartesi 2026 14:55');
});

test('hafta seçici: en YENİ hafta üstte, sezona göre süzülür', () => {
  const rounds = {
    currentRoundId: 1600,
    rounds: [
      { id: 1598, name: '51. Hafta', year: 2026 },
      { id: 1600, name: '53. Hafta', year: 2026 },
      { id: 1599, name: '52. Hafta', year: 2026 },
      { id: 1500, name: '40. Hafta', year: 2025 },
    ],
  };
  const { sezonlar, seciliSezon, haftalar } = haftaSecenekleri(rounds);
  assert.deepEqual(sezonlar, [2026, 2025], 'sezonlar yeniden eskiye');
  assert.equal(seciliSezon, 2026, 'varsayılan en yeni sezon');
  assert.deepEqual(haftalar.map((h) => h.id), [1600, 1599, 1598], 'haftalar yeniden eskiye');

  const eski = haftaSecenekleri(rounds, 2025);
  assert.deepEqual(eski.haftalar.map((h) => h.id), [1500]);
});

test('sezon yazımı resmî biçimde: "2025/2026 Sezonu"', () => {
  assert.equal(sezonMetni(2026), '2025/2026 Sezonu');
  assert.equal(sezonMetni(null), BOS);
});

test('boş hafta listesi ÇÖKMEZ', () => {
  const { sezonlar, haftalar } = haftaSecenekleri(null);
  assert.deepEqual(sezonlar, []);
  assert.deepEqual(haftalar, []);
});

// ---------------------------------------------------------------------------
// PALET İZOLASYONU — iki tema karışmasın.
// Resmî Liste ekranı resmî listenin GÖRÜNÜMÜNÜ yansıtır; uygulamanın geri
// kalanı kendi paletini kullanır. Karışırlarsa aynı uygulamada iki farklı
// gri, iki farklı kırmızı çıkar ve hangisinin doğru olduğu belirsizleşir.
// ---------------------------------------------------------------------------

test('Resmî Liste ekranı GENEL temadan renk ALMAZ', async () => {
  const { readFileSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
  const ekran = readFileSync(join(kok, 'src', 'screens', 'ResmiListeScreen.js'), 'utf8');

  // theme.js'ten YALNIZ ölçü (spacing) alınır, renk alınmaz.
  assert.ok(!/colors\./.test(ekran), 'genel temadan renk kullanılıyor');
  assert.match(ekran, /from '\.\.\/resmiListeTema'/, 'kendi paletini kullanmıyor');
});

test('resmî palet uygulamanın geri kalanına SIZMAZ', async () => {
  const { readFileSync, readdirSync, statSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const kok = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

  const dosyalar = [];
  (function tara(d) {
    for (const ad of readdirSync(d)) {
      const p = join(d, ad);
      if (statSync(p).isDirectory()) tara(p);
      else if (ad.endsWith('.js')) dosyalar.push(p);
    }
  }(kok));

  const izinli = ['resmiListeTema.js', 'ResmiListeScreen.js'];
  for (const p of dosyalar) {
    if (izinli.some((a) => p.endsWith(a))) continue;
    const s = readFileSync(p, 'utf8');
    assert.ok(!/resmiListeTema/.test(s),
      `${p.split('src')[1]} resmî paleti kullanıyor — palet ekranla sınırlı kalmalı`);
  }
});

test('ekranda BAĞIMSIZLIK beyanı ve kaynak satırı KALDIRILMAMIŞ', async () => {
  // Görünüm resmî siteye yaklaştıkça bu iki satır daha da gerekli hâle gelir:
  // ekran resmî listeyi YANSITIR ama resmî bir kaynak DEĞİLDİR.
  const { readFileSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
  const ekran = readFileSync(join(kok, 'src', 'screens', 'ResmiListeScreen.js'), 'utf8');

  assert.match(ekran, /INDEPENDENCE_NOTICE/, 'bağımsızlık beyanı kaldırılmış');
  assert.match(ekran, /Kaynak: /, 'kaynak satırı kaldırılmış');
});
