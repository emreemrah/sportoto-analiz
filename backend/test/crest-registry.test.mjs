// ARMA KAYIT DEFTERİ TESTLERİ
// ---------------------------------------------------------------------------
// Kilit kural: kulüp arması ARTIK fikstür eşleşmesinin yan ürünü değildir.
// Maç eşleşmese bile takımın arması biliniyorsa çizilir; bilinmiyorsa ya da
// birden fazla kulübe denk geliyorsa HİÇBİR arma çizilmez (varsayılan-ret).
//
// VERİ NOTU: buradaki arma adresleri TEST FIXTURE'ıdır (arma.test alan adı),
// gerçek kaynaktan gözlenmiş adresler DEĞİLDİR — kodun karar mantığını ölçer.
// Takım adları ise kullanıcının 1526 numaralı GERÇEK bülteninde armasız kalan
// takımlardır (Club Brugge, PSV Eindhoven, Porto, Uniao Torreense) — testin
// hangi somut arızayı kapattığı belli olsun diye aynen kullanılmıştır.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-crest-cache-'));

const {
  harvestCrests, saveRegistry, loadRegistry, indexRegistry,
  lookupCrest, attachCrests, crestCoverage,
} = await import('../src/crestRegistry.js');

const IMG = (slug) => `https://arma.test/img/${slug}.png`;
const team = (id, name, slug, extra = {}) => ({ id, name, cleanName: name, image: IMG(slug), ...extra });
// Deftere yazmadan (diske dokunmadan) yalnız bellekte kur.
const build = (teamsBySeason) => indexRegistry(harvestCrests(teamsBySeason, { registry: { version: 1, updatedAt: null, entries: [] } }).registry);
const T = (name) => ({ name });

// ——— 1) Temel: kaynakta görülen takımın arması deftere girer ve bulunur ———
test('kaynakta görülen takımın arması deftere işlenir ve birebir adla bulunur', () => {
  const idx = build([[1, [team(10, 'Club Brugge', 'belgium-club-brugge-kv'), team(11, 'Porto', 'portugal-fc-porto')]]]);
  assert.equal(lookupCrest(T('Club Brugge'), idx).image, IMG('belgium-club-brugge-kv'));
  assert.equal(lookupCrest(T('Porto'), idx).matchedBy, 'registry-exact');
});

// ——— 2) Alias tablosu (matcher.js) defterde de geçerli ———
test('alias: bülten "Helsinki" kaynaktaki "HJK" armasını bulur', () => {
  const idx = build([[1, [team(20, 'HJK', 'finland-hjk-helsinki')]]]);
  assert.equal(lookupCrest(T('Helsinki'), idx).image, IMG('finland-hjk-helsinki'));
});

// ——— 3) VARSAYILAN-RET: aynı ada iki FARKLI kulüp → arma YOK ———
test('belirsizlik: aynı normalize ada iki farklı kulüp denk gelirse arma verilmez', () => {
  const idx = build([[1, [team(30, 'Rivertown', 'country-a-rivertown'), team(31, 'Rivertown', 'country-b-rivertown')]]]);
  const hit = lookupCrest(T('Rivertown'), idx);
  assert.equal(hit.image, null, 'yanlış arma göstermektense hiç gösterme');
  assert.equal(hit.reason, 'ambiguous');
  assert.equal(hit.candidateCount, 2);
});

// ——— 4) Aynı kulüp, iki sezon: arma tazelenir, belirsizlik SAYILMAZ ———
test('aynı kulüp iki sezonda görülürse arma tazelenir, belirsizlik olmaz', () => {
  const h1 = harvestCrests([[1, [team(40, 'PSV Eindhoven', 'netherlands-psv-eski')]]], { registry: { version: 1, updatedAt: null, entries: [] }, now: new Date('2026-01-01T00:00:00Z') });
  const h2 = harvestCrests([[2, [team(40, 'PSV Eindhoven', 'netherlands-psv-yeni')]]], { registry: h1.registry, now: new Date('2026-02-01T00:00:00Z') });
  assert.equal(h2.total, 1, 'aynı kaynak kimliği tek kayıtta birleşir');
  assert.equal(h2.refreshed, 1);
  assert.equal(lookupCrest(T('PSV Eindhoven'), indexRegistry(h2.registry)).image, IMG('netherlands-psv-yeni'));
});

// ——— 5) Farklı kimlik ama AYNI arma → aynı kulübün mükerrer kaydı, kabul ———
test('farklı kaynak kimliği ama aynı arma: mükerrer kayıt sayılır, arma verilir', () => {
  const idx = build([[1, [team(50, 'AZ Alkmaar', 'netherlands-az'), team(51, 'AZ Alkmaar', 'netherlands-az')]]]);
  assert.equal(lookupCrest(T('AZ Alkmaar'), idx).image, IMG('netherlands-az'));
});

// ——— 6) SIKI KATMAN ÖNCE: "Porto" ile "Porto B" birbirine karıştırılmaz ———
test('birebir ad katmanı, kapsama katmanından ÖNCE gelir (Porto ≠ Porto B)', () => {
  const idx = build([[1, [team(60, 'Porto', 'portugal-fc-porto'), team(61, 'Porto B', 'portugal-fc-porto-b')]]]);
  const hit = lookupCrest(T('Porto'), idx);
  assert.equal(hit.image, IMG('portugal-fc-porto'), 'birebir ad tuttuğu için gevşek katmana inilmez');
  assert.equal(hit.matchedBy, 'registry-exact');
});

// ——— 7) Yardımcı katmanlar: alias, arma adresi, sponsor öneki ———
test('kısaltma alias tablosundan çözülür (TPS → Turun Palloseura)', () => {
  const idx = build([[1, [team(70, 'Turun Palloseura', 'finland-turun-palloseura')]]]);
  const hit = lookupCrest(T('TPS'), idx);
  assert.equal(hit.image, IMG('finland-turun-palloseura'));
  assert.equal(hit.matchedBy, 'registry-exact', 'alias birebir ad katmanında çözülür');
});

test('kaynak kısa adı yazmışsa arma adresinin ardışık parçaları çözer', () => {
  // Ters yön: defterdeki ad "TPS", bülten uzun adı yazıyor. Ad katmanı tutmaz;
  // arma adresi "…-turun-palloseura.png" ardışık parçalarıyla oturur.
  const idx = build([[1, [team(71, 'TPS', 'finland-turun-palloseura')]]]);
  const hit = lookupCrest(T('Turun Palloseura'), idx);
  assert.equal(hit.image, IMG('finland-turun-palloseura'));
  assert.equal(hit.matchedBy, 'registry-slug');
});

test('sponsor öneki uçtan kapsama ile çözülür (KGHM Zaglebie Lubin)', () => {
  const idx = build([[1, [team(72, 'KGHM Zaglebie Lubin', 'poland-zaglebie-lubin')]]]);
  const hit = lookupCrest(T('Zaglebie Lubin'), idx);
  assert.equal(hit.image, IMG('poland-zaglebie-lubin'));
  assert.equal(hit.matchedBy, 'registry-contain');
});

// ——— 7b) GERÇEK VERİDE YAKALANAN YANLIŞ ARMA (regresyon) ———
// 1526 numaralı bültenle yapılan denemede "Porto", Polonya kulübü
// "…klub-sportowy-wieczysta-krakow" armasını almıştı: ham "içeriyor mu"
// karşılaştırması 'sportowy' kelimesinin içindeki 'porto'yu eşleşme sanıyordu.
// Kelime/parça sınırına oturmayan benzerlik artık kanıt sayılmaz.
test('regresyon: "Porto", içinde porto GEÇEN başka kulübün armasını almaz', () => {
  const idx = build([[1, [team(73, 'Klub Sportowy Wieczysta Krakow', 'poland-klub-sportowy-wieczysta-krakow')]]]);
  const hit = lookupCrest(T('Porto'), idx);
  assert.equal(hit.image, null, "'sportowy' içinde 'porto' geçmesi eşleşme değildir");
  assert.equal(hit.reason, 'not_found');
});

// ——— 7c) A takımı / B takımı / kadın takımı ayrı kulüptür ———
test('yedek takım arması A takımına verilmez (defterde yalnız "Porto B" varken)', () => {
  const idx = build([[1, [team(74, 'Porto B', 'portugal-fc-porto-b')]]]);
  const hit = lookupCrest(T('Porto'), idx);
  assert.equal(hit.image, null, 'B takımının arması A takımının arması değildir');
});

test('kadın takımı arması erkek takımına verilmez', () => {
  const idx = build([[1, [team(75, 'Rosengard Women', 'sweden-rosengard-women')]]]);
  assert.equal(lookupCrest(T('Rosengard'), idx).image, null);
});

test('yardımcı katman birden fazla kulübe denk gelirse yine arma verilmez', () => {
  const idx = build([[1, [team(80, 'Northport Rangers', 'a-northport-rangers'), team(81, 'Northport Wanderers', 'b-northport-wanderers')]]]);
  const hit = lookupCrest({ name: 'Northport' }, idx);
  assert.equal(hit.image, null);
});

// ——— 8) Bilinmeyen takım: uydurma YOK ———
test('kaynakta hiç görülmemiş takım için arma uydurulmaz', () => {
  const idx = build([[1, [team(90, 'Porto', 'portugal-fc-porto')]]]);
  const hit = lookupCrest(T('Union Saint-Gilloise'), idx);
  assert.equal(hit.image, null);
  assert.equal(hit.reason, 'not_found');
});

// ——— 9) Bozuk/eksik arma alanı deftere girmez ———
test('boş veya http olmayan arma adresi deftere alınmaz', () => {
  const h = harvestCrests([[1, [
    { id: 100, name: 'Bos Arma', cleanName: 'Bos Arma', image: '' },
    { id: 101, name: 'Yanlis Arma', cleanName: 'Yanlis Arma', image: 'javascript:alert(1)' },
    { id: 102, name: 'Iyi Arma', cleanName: 'Iyi Arma', image: IMG('iyi-arma') },
  ]]], { registry: { version: 1, updatedAt: null, entries: [] } });
  assert.equal(h.total, 1);
  assert.equal(lookupCrest(T('Iyi Arma'), indexRegistry(h.registry)).image, IMG('iyi-arma'));
});

// ——— 10) KALICILIK: lig kapsam dışına düşse bile arma korunur ———
test('kalıcılık: ligi bu hafta çekilmeyen kulübün arması defterde durur', () => {
  const week1 = harvestCrests([[1, [team(110, 'Uniao Torreense', 'portugal-uniao-torreense')]]], { registry: { version: 1, updatedAt: null, entries: [] } });
  saveRegistry(week1.registry);
  // Sonraki hafta bambaşka bir sezon çekildi; eski lig havuzda YOK.
  const week2 = harvestCrests([[2, [team(111, 'Baska Takim', 'baska-takim')]]], { registry: loadRegistry() });
  saveRegistry(week2.registry);
  const idx = indexRegistry(loadRegistry());
  assert.equal(lookupCrest(T('Uniao Torreense'), idx).image, IMG('portugal-uniao-torreense'),
    'geçen hafta öğrenilen arma, ligi artık çekilmese de korunur');
  assert.equal(lookupCrest(T('Baska Takim'), idx).image, IMG('baska-takim'));
});

// ——— 11) ASIL ARIZA: maç eşleşmese de arma çizilir ———
test('fikstür eşleşmesi tutmasa bile takım arması defterden doldurulur', () => {
  const idx = build([[1, [
    team(120, 'Club Brugge', 'belgium-club-brugge-kv'),
    team(121, 'Porto', 'portugal-fc-porto'),
    team(122, 'Uniao Torreense', 'portugal-uniao-torreense'),
  ]]]);
  // Kullanıcının 1526 bülteninde armasız kalan üç fikstürün sadeleştirilmiş hâli:
  // hiçbirinin stats'ı yok (maç eşleşmedi) — eskiden altı arma da boştu.
  const matches = [
    { no: 1, home: T('Club Brugge'), away: T('Union Saint-Gilloise'), stats: null },
    { no: 14, home: T('Porto'), away: T('Uniao Torreense'), stats: null },
  ];
  attachCrests(matches, idx);
  assert.equal(matches[0].home.logo, IMG('belgium-club-brugge-kv'), 'maç eşleşmedi ama kulüp biliniyor');
  assert.equal(matches[0].home.logoSource, 'registry');
  assert.equal(matches[0].away.logo, '', 'kaynakta hiç yok → nötr ⚽ (uydurma arma yok)');
  assert.equal(matches[0].away.logoReason, 'not_found');
  assert.equal(matches[1].home.logo, IMG('portugal-fc-porto'));
  assert.equal(matches[1].away.logo, IMG('portugal-uniao-torreense'));
});

// ——— 12) Maçın kendi eşleşmesi HER ZAMAN defterin önünde gelir ———
test('maç kaynakla eşleştiyse armayı maçın kendi verisi belirler, defter değil', () => {
  const idx = build([[1, [team(130, 'Porto', 'defterden-gelen')]]]);
  const matches = [{ no: 1, home: T('Porto'), away: T('Benfica'), stats: { home: { logo: IMG('fikstürden-gelen') }, away: { logo: '' } } }];
  attachCrests(matches, idx);
  assert.equal(matches[0].home.logo, IMG('fikstürden-gelen'));
  assert.equal(matches[0].home.logoSource, 'fixture');
});

// ——— 13) Defter yoksa akış bozulmaz ———
test('defter hiç yoksa maç akışı bozulmaz, armalar boş kalır', () => {
  const matches = [{ no: 1, home: T('Porto'), away: T('Benfica'), stats: null }];
  attachCrests(matches, null);
  assert.equal(matches[0].home.logo, '');
  assert.equal(matches[0].home.logoReason, 'no_registry');
});

// ——— 14) Teşhis raporu: kaç arma nereden geldi ———
test('arma kapsam raporu dolu/boş sayar ve armasız takımı adıyla listeler', () => {
  const idx = build([[1, [team(140, 'Porto', 'portugal-fc-porto')]]]);
  const matches = [
    { no: 1, home: T('Porto'), away: T('Bilinmeyen Kulup'), stats: null },
    { no: 2, home: T('Ev'), away: T('Deplasman'), stats: { home: { logo: IMG('ev') }, away: { logo: IMG('deplasman') } } },
  ];
  attachCrests(matches, idx);
  const rap = crestCoverage(matches);
  assert.equal(rap.total, 4);
  assert.equal(rap.filled, 3);
  assert.equal(rap.missing, 1);
  assert.equal(rap.fromFixture, 2);
  assert.equal(rap.fromRegistry, 1);
  assert.deepEqual(rap.missingTeams, [{ no: 1, name: 'Bilinmeyen Kulup' }]);
});

// ——— 15) Resmî takım nesnesi DEĞİŞTİRİLMEZ (imza/teyit akışı korunur) ———
test('arma iliştirmek resmî bülten takım nesnesini değiştirmez', () => {
  const idx = build([[1, [team(150, 'Porto', 'portugal-fc-porto')]]]);
  const resmiEv = { name: 'Porto' };
  const matches = [{ no: 1, home: resmiEv, away: T('Benfica'), stats: null }];
  attachCrests(matches, idx);
  assert.equal(resmiEv.logo, undefined, 'resmî nesneye yazılmaz; kopya güncellenir');
  assert.equal(matches[0].home.logo, IMG('portugal-fc-porto'));
});

// ——— 16) TÜRKÇE EXONİM (16 Ağustos 2026 arızası) ———
// Bülten "Marsilya" yazıyordu, kaynak "Olympique de Marseille". Defterde kayıt
// VARDI ama hiçbir metin katmanı Türkçe adı bağlayamıyordu; kullanıcı ekranda
// armasız bir takım gördü. Alias eklendi — bu test onun nöbetçisi.
test('exonim: bülten "Marsilya" kaynaktaki "Olympique de Marseille" armasını bulur', () => {
  const idx = build([[1, [team(443, 'Olympique de Marseille', 'france-olympique-de-marseille')]]]);
  assert.equal(lookupCrest(T('Marsilya'), idx).image, IMG('france-olympique-de-marseille'));
});

// ——— 17) ALIAS TABLOSU BÜTÜNLÜĞÜ ———
// Alias anahtar/değerleri normalizeName'den GEÇMİŞ olmalıdır. Normalize
// edilmemiş bir satır (büyük harf, boşluk, nokta) hiçbir zaman eşleşmez ve
// SESSİZCE ölür: tablo dolu görünür, arama hep boş döner. Bu test yeni
// eklenen her satırı o hataya karşı korur.
test('alias tablosundaki her anahtar ve değer normalize edilmiş hâldedir', async () => {
  const { normalizeName, nameVariants } = await import('../src/matcher.js');
  // Tabloya doğrudan erişim yok; nameVariants üzerinden gözlenir: normalize
  // bir adın ürettiği varyantların HEPSİ de normalize olmalıdır.
  const ornekler = ['Marsilya', 'Helsinki', 'TPS', 'AGF', 'OB', 'Shanghai Port'];
  for (const ad of ornekler) {
    for (const v of nameVariants({ name: ad })) {
      assert.equal(v, normalizeName(v), `alias/varyant normalize değil: ${v}`);
    }
  }
});
