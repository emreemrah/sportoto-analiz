// ---------------------------------------------------------------------------
// İNCELEME PANELİ — SAF MANTIK + KAYNAK TARAMASI (E9 / üçüncü şart)
// ---------------------------------------------------------------------------
// İKİ AYRI ŞEY ÖLÇÜLÜR:
//
//   1) src/moderationView.js içindeki saf işlevler ÇALIŞTIRILIR. Özet
//      satırları, sebep özeti, gizleme rozeti ve düğme kümesi burada karar
//      bulur; ekran yalnız bunları çizer.
//
//   2) Ekran dosyalarının KAYNAĞI taranır. JSX içerdikleri için içeri
//      alınamazlar; bu yüzden "yetki nereden geliyor", "hangi uç çağrılıyor",
//      "bildiren kimliği ekrana düşüyor mu" soruları kaynak üstünde sorulur.
//
// ═══ BU DOSYANIN NE KANITLAMADIĞI ═══
// Kaynak taraması geçmesi, gerçek telefonda inceleme akışının çalıştığını
// KANITLAMAZ. Yetkinin gerçekten kapalı olduğunu backend/test/moderation-ops
// .test.mjs ölçer; buradaki testler arayüzün o kapıya doğru bağlandığını ve
// uygulamanın içine hiçbir operatör kimliği gömülmediğini gösterir.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  ozetSatirlari, sebepOzeti, gizlemeDurumu, eylemler, tarihKisa, bildirimOzeti,
} from '../src/moderationView.js';
import { COMMUNITY_RULES_PATH, legalUrls } from '../src/brand.js';

const buDizin = dirname(fileURLToPath(import.meta.url));
const oku = (p) => readFileSync(join(buDizin, '..', p), 'utf8');

const ekran = oku('src/screens/ModerationScreen.js');
const profil = oku('src/screens/ProfileScreen.js');
const hakkinda = oku('src/screens/AboutScreen.js');
const apiKaynak = oku('src/api.js');
const navigasyon = oku('App.js');
const gorunum = oku('src/moderationView.js');

/** app/src altındaki tüm .js dosyalarını gezer (gömülü sır aramak için). */
function tumKaynaklar(kok = join(buDizin, '..', 'src')) {
  const cikti = [];
  for (const ad of readdirSync(kok)) {
    const yol = join(kok, ad);
    if (statSync(yol).isDirectory()) cikti.push(...tumKaynaklar(yol));
    else if (ad.endsWith('.js')) cikti.push([yol, readFileSync(yol, 'utf8')]);
  }
  return cikti;
}

const yorum = (ek = {}) => ({
  commentId: 12,
  matchId: 'm1',
  text: 'deneme yorumu',
  createdAt: '2026-07-01T10:00:00Z',
  hidden: false,
  hiddenAt: null,
  hiddenBy: null,
  reporterCount: 2,
  reportCount: 3,
  reasons: { spam: 2, hakaret: 1 },
  reports: [],
  author: { username: 'kullanici' },
  ...ek,
});

// ---------------------------------------------------------------------------
describe('Özet satırları — sayılar olduğu gibi anlatılır', () => {
  test('hiç bildirim yoksa tek ve net bir satır', () => {
    assert.deepEqual(ozetSatirlari({ items: [], total: 0, orphanCount: 0 }),
      ['İncelenmeyi bekleyen bildirim yok.']);
  });

  test('eksik/boş girdi de çökmez, "yok" der', () => {
    // Ekran ilk açılışta veriyi henüz almamış olabilir; burada patlamak,
    // operatöre boş beyaz bir ekran göstermek demekti.
    assert.deepEqual(ozetSatirlari(undefined), ['İncelenmeyi bekleyen bildirim yok.']);
    assert.deepEqual(ozetSatirlari({}), ['İncelenmeyi bekleyen bildirim yok.']);
  });

  test('hepsi gösteriliyorsa fazladan satır YOK', () => {
    const s = ozetSatirlari({ items: [yorum(), yorum()], total: 2, orphanCount: 0 });
    assert.deepEqual(s, ['2 yorum için bekleyen bildirim var.']);
  });

  test('liste kesildiyse fark AÇIKÇA yazılır', () => {
    // "5 vardı, 2 gördüm" durumunun sessizce geçmesi, operatöre işini
    // bitirdiğini düşündürürdü.
    const s = ozetSatirlari({ items: [yorum(), yorum()], total: 5, orphanCount: 0 });
    assert.equal(s.length, 2);
    assert.match(s[1], /2 tanesi gösteriliyor/);
  });

  test('silinmiş yoruma ait bildirimler ayrıca sayılır', () => {
    const s = ozetSatirlari({ items: [yorum()], total: 3, orphanCount: 4 });
    assert.ok(s.some((x) => /4 bildirim silinmiş bir yoruma ait/.test(x)),
      `öksüz bildirim satırı yok: ${JSON.stringify(s)}`);
  });

  test('gösterilen sayı azken SEBEP uydurulmaz', () => {
    // Farkın sebebi (liste sınırı mı, silinmiş yorum mu) sunucudan gelmiyor.
    // Bilmediğimiz bir sebebi yazmak, veriyi uydurmak olurdu.
    const s = ozetSatirlari({ items: [yorum()], total: 9, orphanCount: 0 }).join(' ');
    assert.ok(!/sınır|limit|silinmiş/i.test(s), `bilinmeyen sebep uydurulmuş: ${s}`);
  });
});

// ---------------------------------------------------------------------------
describe('Sebep özeti', () => {
  test('çok bildirilen sebep önce, sayı ×N ile', () => {
    assert.equal(sebepOzeti({ hakaret: 1, spam: 2 }), 'Spam / reklam ×2 · Hakaret');
  });

  test('tek bildirimde ×1 yazılmaz', () => {
    assert.equal(sebepOzeti({ hakaret: 1 }), 'Hakaret');
  });

  test('eşitlikte sebep listesinin kendi sırası korunur', () => {
    // Aynı veri her açılışta aynı sırayla görünmeli; rastgele sıra, operatöre
    // liste değişmiş gibi hissettirirdi.
    assert.equal(sebepOzeti({ nefret: 1, spam: 1 }), 'Spam / reklam · Nefret söylemi');
    assert.equal(sebepOzeti({ spam: 1, nefret: 1 }), 'Spam / reklam · Nefret söylemi');
  });

  test('tanınmayan anahtar kaybolmaz, olduğu gibi görünür', () => {
    // Sunucu bir gün yeni sebep eklerse ekran onu yutmamalı.
    assert.equal(sebepOzeti({ yenisebep: 1 }), 'yenisebep');
  });

  test('boş/eksik girdi boş metin döner', () => {
    assert.equal(sebepOzeti({}), '');
    assert.equal(sebepOzeti(null), '');
    assert.equal(sebepOzeti({ spam: 0 }), '');
  });
});

// ---------------------------------------------------------------------------
describe('Gizleme rozeti — ELLE ile OTOMATİK ayrımı', () => {
  test('görünür yorum', () => {
    const d = gizlemeDurumu(yorum());
    assert.equal(d.gizli, false);
    assert.equal(d.etiket, 'Görünür');
  });

  test('otomatik gizlemenin geçici olduğu rozette yazar', () => {
    // Otomatik gizleme, bildirimler düşerse KENDİLİĞİNDEN kalkar. Bunu "Gizli"
    // diye tek kelimeye indirmek, operatöre kalıcı sandığı bir kararın geçici
    // olduğunu gizlerdi.
    const d = gizlemeDurumu(yorum({ hidden: true, hiddenBy: 'otomatik' }));
    assert.equal(d.gizli, true);
    assert.equal(d.otomatik, true);
    assert.match(d.etiket, /otomatik/i);
  });

  test('elle gizleme ayrı rozet alır', () => {
    const d = gizlemeDurumu(yorum({ hidden: true, hiddenBy: 'elle' }));
    assert.equal(d.otomatik, false);
    assert.match(d.etiket, /elle/i);
    assert.notEqual(d.etiket, gizlemeDurumu(yorum({ hidden: true, hiddenBy: 'otomatik' })).etiket);
  });

  test('gizli ama sebebi bilinmiyorsa OTOMATİK sayılır', () => {
    // Emin olmadığımızda "elle" demek, kararın mühürlü olduğunu söylemek olurdu.
    // Yanılma yönü, az söz veren tarafa doğrudur.
    assert.equal(gizlemeDurumu(yorum({ hidden: true, hiddenBy: null })).otomatik, true);
  });

  test('boş girdi çökmez', () => {
    assert.equal(gizlemeDurumu(undefined).gizli, false);
  });
});

// ---------------------------------------------------------------------------
describe('Düğmeler', () => {
  test('görünür yorumda yalnız gizleme var', () => {
    const e = eylemler(yorum());
    assert.deepEqual(e.map((x) => x.key), ['hide']);
    assert.equal(e[0].label, 'Yorumu Gizle');
  });

  test('gizli yorumda MÜHÜRLEME ve GERİ ALMA birlikte sunulur', () => {
    // Otomatik gizlenmiş yorumda operatörün iki ayrı işi vardır: kararı
    // onaylamak (mühürlemek) ya da açmak. Yalnız "Geri Al" göstermek,
    // onaylamanın hiçbir yolunu bırakmazdı.
    const e = eylemler(yorum({ hidden: true, hiddenBy: 'otomatik' }));
    assert.deepEqual(e.map((x) => x.key), ['hide', 'unhide']);
  });

  test('gizli yorumda düğme adı "gizle" değil, "gizli kalsın"dır', () => {
    // Zaten gizli olan bir şeyi "Gizle" diye sunmak, düğmenin yaptığı işi
    // (kararı mühürlemek) yanlış anlatırdı.
    const e = eylemler(yorum({ hidden: true, hiddenBy: 'otomatik' }));
    assert.match(e[0].label, /Gizli Kalsın/);
    assert.match(e[0].aciklama, /mühürlen/i);
  });

  test('her düğmenin ne yaptığını anlatan bir açıklaması var', () => {
    for (const durum of [yorum(), yorum({ hidden: true, hiddenBy: 'elle' })]) {
      for (const e of eylemler(durum)) {
        assert.ok(e.aciklama && e.aciklama.length > 20, `açıklaması eksik: ${e.key}`);
      }
    }
  });

  test('hiçbir açıklama tutulamayacak söz vermiyor', () => {
    for (const durum of [yorum(), yorum({ hidden: true })]) {
      for (const e of eylemler(durum)) {
        assert.ok(!/kesin|garanti|kalıcı olarak sil/i.test(e.aciklama), e.aciklama);
      }
    }
  });
});

// ---------------------------------------------------------------------------
describe('Sayı ve tarih biçimleri', () => {
  test('kişi sayısı ile bildirim sayısı AYRI yazılır', () => {
    // Otomatik gizleme eşiği 3 FARKLI KİŞİdir, 3 bildirim değil. Tek sayı
    // göstermek eşiğin neye göre çalıştığını yanlış anlatırdı.
    const m = bildirimOzeti(yorum({ reporterCount: 2, reportCount: 5 }));
    assert.match(m, /2 kişi/);
    assert.match(m, /5 bekleyen bildirim/);
  });

  test('eksik sayı 0 olur, "undefined" yazılmaz', () => {
    assert.equal(bildirimOzeti({}), '0 kişi · 0 bekleyen bildirim');
  });

  test('okunamayan tarih uydurulmaz', () => {
    assert.equal(tarihKisa(null), '—');
    assert.equal(tarihKisa(''), '—');
    assert.equal(tarihKisa('bozuk-tarih'), '—');
  });

  test('geçerli tarih okunur bir metne dönüşür', () => {
    const m = tarihKisa('2026-07-01T10:00:00Z');
    assert.notEqual(m, '—');
    assert.match(m, /2026/);
  });
});

// ---------------------------------------------------------------------------
describe('Yetki uygulamada DEĞİL, sunucuda', () => {
  test('app/src ve App.js içinde MODERATOR_EMAILS geçmiyor', () => {
    // Yetki listesi backend/.env içindedir. Android paketi açılıp okunabilen
    // bir dosyadır; oraya yazılan liste herkese açık olurdu.
    for (const [yol, metin] of [...tumKaynaklar(), [join(buDizin, '..', 'App.js'), navigasyon]]) {
      assert.ok(!metin.includes('MODERATOR_EMAILS'), `yetki listesi uygulamaya sızmış: ${yol}`);
    }
  });

  test('moderasyon dosyalarında e-posta adresi yazılı değil', () => {
    const desen = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
    for (const [ad, metin] of [
      ['ModerationScreen.js', ekran], ['moderationView.js', gorunum],
      ['api.js', apiKaynak], ['ProfileScreen.js', profil],
    ]) {
      const bulunan = metin.match(desen);
      assert.ok(!bulunan, `${ad} içinde e-posta adresi: ${bulunan?.[0]}`);
    }
  });

  test('profil girişi sunucu cevabına bağlı, yerel karşılaştırmaya değil', () => {
    assert.match(profil, /moderationAccess\(\)/, 'yetki sunucudan sorulmuyor');
    assert.match(profil, /operator\s*===\s*true/, 'yetki cevabı katı biçimde okunmuyor');
    // Kendi e-postasını bir listeyle karşılaştıran bir kurgu, listeyi
    // uygulamanın içinde taşımak demekti.
    assert.ok(!/user\.email\s*===|user\.email\s*\.includes|email\s*===\s*['"]/.test(profil),
      'yetki kararı yerel e-posta karşılaştırmasıyla veriliyor');
  });

  test('giriş VARSAYILAN OLARAK gizlidir (fail-closed)', () => {
    // Başlangıç değeri true olsaydı, yetki cevabı gelene kadar giriş herkeste
    // bir an görünürdü.
    // Doğrudan O durumun başlangıç değerine bakılır; "yakınında bir yerde
    // useState(false) var mı" ölçümü, araya yorum girince yanılırdı.
    assert.match(profil, /const\s*\[\s*operator\s*,\s*setOperator\s*\]\s*=\s*useState\(\s*false\s*\)/,
      'operator durumu false ile başlamıyor');
    assert.match(profil, /\{operator\s*&&/, 'giriş koşulsuz çiziliyor');
    assert.match(profil, /navigate\('Moderation'\)/, 'inceleme ekranına geçiş yok');
  });

  test('yetki sorusu hata verirse giriş GÖSTERİLMEZ', () => {
    // Sunucuya ulaşılamadığında girişi göstermek, yetkisiz bir hesabı
    // reddedilecek bir ekrana sokardı.
    assert.match(profil, /catch\(\s*\(\)\s*=>\s*\{[^}]*setOperator\(false\)/,
      'hata durumunda operator false yapılmıyor');
  });

  test('inceleme ekranı da yetkisini kendisi sorar', () => {
    // Ekrana doğrudan (geri tuşu, derin bağlantı) gelinebilir; giriş gizli
    // olması tek başına yeterli değildir.
    assert.match(ekran, /api\.moderationAccess\(\)/, 'ekran yetkiyi sormuyor');
    assert.match(ekran, /if\s*\(!erisim\?\.operator\)/, 'yetkisizken liste isteği durdurulmuyor');
  });
});

// ---------------------------------------------------------------------------
describe('Bildiren kimliği hiçbir yerde görünmüyor', () => {
  test('ekran ve görünüm mantığı bildiren kimliği okumuyor', () => {
    for (const [ad, metin] of [['ModerationScreen.js', ekran], ['moderationView.js', gorunum]]) {
      for (const desen of [/reporter_id/, /reporterId/, /reporters\b/, /bildirenKimlik/i]) {
        assert.ok(!desen.test(metin), `${ad} içinde bildiren kimliği: ${desen}`);
      }
    }
  });

  test('ekran, bildiren kimliğinin gösterilmediğini kullanıcıya da söylüyor', () => {
    assert.match(ekran, /kimliği bu ekranda gösterilmez/,
      'gizlilik sözü ekranda yazılı değil');
  });

  test('operatöre gösterilen sayı KİŞİ sayısıdır ve etiketi vardır', () => {
    // reporterCount operatöre gerekli (eşik 3 kişidir) ama çıplak bir sayı
    // olarak değil, ne olduğu yazılı biçimde gösterilir.
    assert.match(gorunum, /reporterCount/, 'kişi sayısı hiç okunmuyor');
    assert.match(bildirimOzeti(yorum({ reporterCount: 3 })), /kişi/);
  });
});

// ---------------------------------------------------------------------------
describe('Uçlar ve ekran kaydı', () => {
  test('api beş moderasyon ucunu da tanımlıyor', () => {
    for (const ad of ['moderationAccess', 'moderationReports', 'hideComment', 'unhideComment', 'dismissReport']) {
      assert.ok(apiKaynak.includes(ad), `api.js içinde eksik: ${ad}`);
    }
  });

  test('uç adresleri sunucudaki rotalarla aynı', () => {
    const backend = readFileSync(join(buDizin, '..', '..', 'backend', 'src', 'routes', 'moderation.js'), 'utf8');
    // Sunucu rotaları '/api/moderation' altına bağlanır; uygulamanın yazdığı
    // yollar birebir tutmalı, yoksa 404 alınır.
    for (const [istemci, sunucu] of [
      ['/api/moderation/access', "'/access'"],
      ['/api/moderation/reports', "'/reports'"],
      ['/hide', "'/comments/:id/hide'"],
      ['/unhide', "'/comments/:id/unhide'"],
      ['/dismiss', "'/reports/:id/dismiss'"],
    ]) {
      assert.ok(apiKaynak.includes(istemci), `api.js içinde yol yok: ${istemci}`);
      assert.ok(backend.includes(sunucu), `sunucuda rota yok: ${sunucu}`);
    }
  });

  test('yorum numarası adrese güvenli biçimde konuyor', () => {
    // Numara doğrudan yapıştırılırsa beklenmedik bir değer yolu bozabilir.
    for (const ad of ['hideComment', 'unhideComment', 'dismissReport']) {
      const satir = apiKaynak.split('\n').find((l) => l.includes(`${ad}:`)) || '';
      assert.match(satir, /encodeURIComponent/, `${ad} adresi kaçışsız kuruluyor: ${satir}`);
    }
  });

  test('ekran App.js içinde kayıtlı', () => {
    assert.match(navigasyon, /import ModerationScreen from '\.\/src\/screens\/ModerationScreen'/);
    assert.match(navigasyon, /name="Moderation"\s+component=\{ModerationScreen\}/);
  });

  test('her işlemden sonra liste sunucudan yeniden okunuyor', () => {
    // Bir bildirimi yok saymak, eşiğin altına düşen BAŞKA bir yorumu da
    // görünür yapabilir. Ekranı yerel olarak güncellemek yanıltıcı olurdu.
    assert.match(ekran, /await calistir\(\);\s*await yukle\(\)/,
      'işlem sonrası liste yenilenmiyor');
  });

  test('yok sayma onay ister (geri alınamaz)', () => {
    assert.match(ekran, /geri alınamaz/, 'geri alınamazlık uyarısı yok');
    assert.match(ekran, /Evet, yok say/, 'onay adımı yok');
  });
});

// ---------------------------------------------------------------------------
describe('Topluluk Kuralları bağlantısı', () => {
  test('yol tek kaynaktan gelir ve sunucudaki rotayla aynıdır', () => {
    assert.equal(COMMUNITY_RULES_PATH, '/topluluk-kurallari');
    const sunucu = readFileSync(join(buDizin, '..', '..', 'backend', 'src', 'server.js'), 'utf8');
    assert.ok(sunucu.includes("'/topluluk-kurallari'"),
      'sunucuda topluluk kuralları rotası yok — bağlantı 404 verirdi');
  });

  test('legalUrls kuralları da üretir', () => {
    assert.equal(legalUrls('https://api.ornek.com').rules, 'https://api.ornek.com/topluluk-kurallari');
    assert.equal(legalUrls('https://api.ornek.com/').rules, 'https://api.ornek.com/topluluk-kurallari');
    assert.equal(legalUrls('').rules, '/topluluk-kurallari');
  });

  test('Hakkında ekranında bağlantı var ve elle yazılmamış', () => {
    assert.match(hakkinda, /links\.rules/, 'Topluluk Kuralları bağlantısı yok');
    assert.match(hakkinda, /Topluluk Kuralları/, 'bağlantı etiketi yok');
    assert.ok(!/['"]\/topluluk-kurallari['"]/.test(hakkinda), 'yol ekrana elle yazılmış');
  });

  test('kurallar sayfası uygulama KURULMADAN da açılabilir bir adres', () => {
    // Google Play incelemesi sayfayı uygulamayı kurmadan açar; bu yüzden
    // bağlantı bir uygulama içi ekran değil, sunucu adresidir.
    assert.ok(!/navigate\('CommunityRules'\)/.test(hakkinda));
  });
});
