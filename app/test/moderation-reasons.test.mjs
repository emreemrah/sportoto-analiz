// MODERASYON ARAYÜZÜ — SEBEP LİSTESİ EŞLEŞMESİ VE SIZINTI TESTLERİ (E9)
//
// NEDEN VAR: bildirim sebepleri ÜÇ yerde yazılı — arayüz etiketleri
// (app/src/moderationReasons.js), sunucu doğrulaması (backend/src/moderation.js)
// ve veritabanı kısıtı (backend/migrations/007...sql). Üçü birbirinden bağımsız
// dosyalar; biri değişip diğeri unutulursa kullanıcı sebebi seçer, "Gönder"e
// basar ve "Geçerli bir sebep seçilmeli." yanıtını alır. Hatayı biz yaparız,
// hatayı kullanıcı görür. Bu dosya arayüz ↔ sunucu eşleşmesini ölçer;
// sunucu ↔ veritabanı eşleşmesini backend/test/moderation.test.mjs ölçer.
//
// Ayrıca ARAYÜZ SIZINTISI ölçülür: bildirim sayısı, bildiren kişi ve engelin
// yönü kullanıcıya GÖSTERİLMEMELİ. Bunlar görünürse:
//   • bildirim sayısı → bildiren kişi eşiğe ne kadar kaldığını görür,
//   • gizlenme anı → yorumun sahibi kimin bildirdiğini tahmin eder,
//   • engelin yönü → "seni engelledi" bilgisi tacizin devamına yol açar.
//
// UYARI: burada ölçülen ARAYÜZ KAYNAĞIDIR. Geçmesi, gerçek telefonda bildirme
// akışının çalıştığını KANITLAMAZ; yalnız listelerin tuttuğunu ve metinlerin
// sızıntı içermediğini gösterir.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  BILDIRIM_SEBEPLERI as ARAYUZ_SEBEPLERI,
  SEBEP_ANAHTARLARI,
  NOT_SINIRI as ARAYUZ_NOT_SINIRI,
  sebepEtiketi,
  aciklamaZorunluMu,
} from '../src/moderationReasons.js';

import {
  BILDIRIM_SEBEPLERI as SUNUCU_SEBEPLERI,
  NOT_SINIRI as SUNUCU_NOT_SINIRI,
} from '../../backend/src/moderation.js';

const buDizin = dirname(fileURLToPath(import.meta.url));
const oku = (p) => readFileSync(join(buDizin, '..', p), 'utf8');

describe('Sebep listesi — arayüz ile sunucu aynı', () => {
  test('anahtarlar birebir aynı (sıra dâhil)', () => {
    // Sıra da karşılaştırılır: sunucu listesi hem doğrulama hem de 400 yanıtında
    // arayüze DÖNEN liste olarak kullanılıyor. Sıranın tutması, iki tarafın
    // gerçekten tek bir listeden konuştuğunu gösterir.
    assert.deepEqual(SEBEP_ANAHTARLARI, [...SUNUCU_SEBEPLERI]);
  });

  test('arayüzde sunucunun tanımadığı sebep YOK', () => {
    for (const s of ARAYUZ_SEBEPLERI) {
      assert.ok(
        SUNUCU_SEBEPLERI.includes(s.key),
        `arayüzde olup sunucuda olmayan sebep: ${s.key} — kullanıcı bunu seçerse isteği reddedilir`,
      );
    }
  });

  test('sunucunun kabul ettiği her sebebin arayüzde bir düğmesi var', () => {
    for (const key of SUNUCU_SEBEPLERI) {
      assert.ok(
        SEBEP_ANAHTARLARI.includes(key),
        `sunucuda olup arayüzde gösterilmeyen sebep: ${key} — kullanıcı bunu hiç seçemez`,
      );
    }
  });

  test('not sınırı iki tarafta aynı', () => {
    // Arayüz sınırı daha GENİŞ olsaydı kullanıcı yazar, gönderir ve reddedilirdi;
    // daha DAR olsaydı sunucunun izin verdiği alanı hiç kullanamazdı.
    assert.equal(ARAYUZ_NOT_SINIRI, SUNUCU_NOT_SINIRI);
  });
});

describe('Sebep listesinin kendi tutarlılığı', () => {
  test('anahtarlar benzersiz', () => {
    assert.equal(new Set(SEBEP_ANAHTARLARI).size, SEBEP_ANAHTARLARI.length);
  });

  test('anahtarlar ASCII ve küçük harf (veritabanı kısıtına birebir gider)', () => {
    // Türkçe harf içeren bir anahtar (ör. "şiddet") kopyalanırken sessizce
    // bozulabilir; CHECK kısıtı da tam eşleşme arar. Anahtar makine, etiket
    // insan içindir.
    for (const key of SEBEP_ANAHTARLARI) {
      assert.match(key, /^[a-z]+$/, `anahtar ASCII küçük harf olmalı: ${key}`);
    }
  });

  test('her sebebin dolu bir etiketi ve açıklaması var', () => {
    for (const s of ARAYUZ_SEBEPLERI) {
      assert.ok(s.label && s.label.trim().length > 2, `etiketi eksik: ${s.key}`);
      assert.ok(s.hint && s.hint.trim().length > 10, `açıklaması eksik: ${s.key}`);
    }
  });

  test('etiketler birbirinden farklı', () => {
    const etiketler = ARAYUZ_SEBEPLERI.map((s) => s.label);
    assert.equal(new Set(etiketler).size, etiketler.length);
  });

  test('liste donmuş — çalışma anında değiştirilemez', () => {
    assert.ok(Object.isFrozen(ARAYUZ_SEBEPLERI));
    assert.ok(Object.isFrozen(SEBEP_ANAHTARLARI));
  });

  test('sebepEtiketi bilinmeyen anahtarda boş metin DÖNDÜRMEZ', () => {
    // Boş metin, kullanıcıya sebepsiz bir düğme gösterirdi.
    assert.equal(sebepEtiketi('spam'), 'Spam / reklam');
    assert.equal(sebepEtiketi('olmayan'), 'olmayan');
    assert.equal(sebepEtiketi(null), '');
  });

  test('yalnız "diger" açıklama zorunlu kılar', () => {
    // "Diğer" tek başına hiçbir bilgi taşımaz; moderasyon için açıklama şart.
    assert.ok(aciklamaZorunluMu('diger'));
    for (const key of SEBEP_ANAHTARLARI.filter((k) => k !== 'diger')) {
      assert.equal(aciklamaZorunluMu(key), false, `gereksiz zorunluluk: ${key}`);
    }
  });
});

describe('Arayüz sızıntı ölçümü — kaynak taraması', () => {
  const yorumlar = oku('src/CommentsSection.js');
  const engelEkrani = oku('src/screens/BlockedUsersScreen.js');
  const apiKaynak = oku('src/api.js');

  test('yorum arayüzü bildirim SAYISI göstermiyor', () => {
    // Sunucu zaten sayı döndürmüyor; arayüzde de böyle bir alan okunmamalı ki
    // ileride sunucuya eklenirse sessizce ekrana düşmesin.
    for (const desen of [/reportCount/i, /reportedBy/i, /bildirenSayisi/i, /reporterId/i]) {
      assert.ok(!desen.test(yorumlar), `yorum arayüzünde bildirim sızıntısı: ${desen}`);
    }
  });

  test('gizlenen yorumun sahibine sebebi GÖSTERİLİYOR', () => {
    // Sızıntıyı önlemek uğruna kullanıcıyı karanlıkta bırakmak da bir hata olur:
    // yazar yorumunun neden görünmediğini öğrenebilmeli.
    assert.match(yorumlar, /hiddenNote/, 'gizli yorum açıklaması arayüzde okunmuyor');
  });

  test('engelin YÖNÜ hiçbir ekranda yazmıyor', () => {
    // "seni engelledi" bilgisi karşı tarafa ilan edilmez.
    for (const kaynak of [yorumlar, engelEkrani]) {
      assert.ok(!/seni engelledi|beni engelleyen|engelleyenler/i.test(kaynak));
    }
  });

  test('"beni kim engelledi" diye bir uç çağrılmıyor', () => {
    assert.ok(!/blocked-by|blockedBy|blockers/i.test(apiKaynak));
  });

  test('engelleme ekranı geri almanın yolunu gösteriyor', () => {
    // Google Play, engelleme sunan uygulamada geri almanın da uygulama içinden
    // erişilebilir olmasını bekler.
    assert.match(engelEkrani, /unblockUser/, 'engel kaldırma çağrısı yok');
    assert.match(engelEkrani, /Engeli Kaldır/, 'engel kaldırma düğmesi yok');
  });

  test('bildirme penceresi SONUÇ sözü vermiyor', () => {
    // "Bu yorum kaldırılacak / silinecek" tutamayacağımız bir sözdür: kararı
    // moderasyon verir ve sonucu bildiren kişiye açıklanmaz.
    const pencereMetni = yorumlar.match(/Bildirimin[\s\S]{0,400}?<\/Text>/)?.[0] || '';
    assert.ok(pencereMetni.length > 0, 'bildirme penceresi açıklaması bulunamadı');
    assert.ok(
      !/kaldırılacak|silinecek|engellenecek|garanti/i.test(pencereMetni),
      `bildirme penceresi tutulamayacak söz veriyor: ${pencereMetni}`,
    );
  });

  test('bildir/engelle düğmeleri KENDİ yorumunda gösterilmiyor', () => {
    // Sunucu da reddeder; ama reddedilecek bir yola hiç sokmamak gerekir.
    assert.match(
      yorumlar,
      /canAct\s*&&\s*!comment\.mine/,
      'moderasyon düğmeleri "kendi yorumu değil" koşuluna bağlı değil',
    );
  });

  test('api dört moderasyon ucunu da tanımlıyor', () => {
    for (const ad of ['reportComment', 'blocks:', 'blockUser', 'unblockUser']) {
      assert.ok(apiKaynak.includes(ad), `api.js içinde eksik: ${ad}`);
    }
  });
});
