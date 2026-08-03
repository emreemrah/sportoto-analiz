// SAĞLAYICI TEMPOSU TESTLERİ.
//
// NEDEN VAR: gözlem döngüsü 15 dakikada bir çalışıyor ve tüm kaynakları aynı
// tempoda deniyordu. Hız sınırlı bir kaynak bunu kaldırmaz; denemelerin
// KENDİSİ engeli tazeler ve kaynak hiç açılmaz. Ölçümle görüldü (2 Ağustos
// 2026, o gün projeden çıkarılan üçüncü kaynak üzerinde): temiz başlangıçta
// ilk istek 200, aynı dakikada 10 istek 10/10 400.
//
// İki uç da hatalı:
//   * tempo yoksa → kaynak sürekli engelli kalır,
//   * tempo fazla uzarsa → kaynak açıkken bile veri gelmez (sessiz kayıp).
//
// ÜRETİMDE ŞU AN HIZ SINIRLI KAYNAK YOK (TEMPO boş). Kuralı sınamak için
// tablolar parametreyle veriliyor — gerçek tabloya test verisi yazmak,
// üretim önbelleğini kirlettiği için geçmişte gerçek bir hataya yol açmıştı.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  denenebilir, durumuGuncelle, TEMPO, HATA_SONRASI_TEMPO, EN_UZUN_BEKLEME_MS,
} from '../src/providers/saglayiciTempo.js';

const T0 = 1_000_000_000_000;
const SAAT = 3600e3;

// Sahte kaynaklar — üretim tablolarına DOKUNMADAN kuralı sınamak için.
const YAVAS = { tempo: { yavas: SAAT } };                                  // hız sınırlı
const DALGALI = { tempo: { dalgali: SAAT }, hataTempo: { dalgali: 10 * 60e3 } }; // kararsız

describe('denenebilir', () => {
  test('temposu OLMAYAN kaynak her tur denenir', () => {
    assert.equal(denenebilir('serbest', {}, T0), true);
    assert.equal(denenebilir('serbest', { serbest: { sonDeneme: T0 } }, T0 + 1000), true);
  });

  test('üretimde hiçbir kaynak bekletilmiyor (TEMPO boş)', () => {
    // Bu, "hız sınırlı kaynak kalmadı" kararının kayda geçmiş hâli. İleride
    // biri eklenirse bu test kırılır ve gerekçesi burada yazılı olur.
    assert.deepEqual(TEMPO, {});
    assert.deepEqual(HATA_SONRASI_TEMPO, {});
  });

  test('hiç denenmemiş kaynak hemen denenir', () => {
    assert.equal(denenebilir('yavas', {}, T0, YAVAS), true);
  });

  test('bekleme dolmadan TEKRAR denenmez', () => {
    const d = { yavas: { sonDeneme: T0, ardisikHata: 0 } };
    assert.equal(denenebilir('yavas', d, T0 + 30 * 60e3, YAVAS), false);
    assert.equal(denenebilir('yavas', d, T0 + SAAT, YAVAS), true);
  });

  test('İLK hata beklemeyi UZATMIYOR — geçici engel yarım gün sessizlik yapmasın', () => {
    // İlk sürümde üs doğrudan hata sayısıydı ve tek bir başarısızlık beklemeyi
    // 1 saatten 2 saate çıkarıyordu. Hız sınırına takılan bir kaynakta bu,
    // geçici bir engeli saatlerce uzatıyordu.
    const bir = { yavas: { sonDeneme: T0, ardisikHata: 1 } };
    assert.equal(denenebilir('yavas', bir, T0 + SAAT, YAVAS), true);
  });

  test('ISRARLI hatada bekleme uzuyor (üstel geri çekilme)', () => {
    const uc = { yavas: { sonDeneme: T0, ardisikHata: 3 } };   // 1sa × 2² = 4sa
    assert.equal(denenebilir('yavas', uc, T0 + 2 * SAAT, YAVAS), false);
    assert.equal(denenebilir('yavas', uc, T0 + 4 * SAAT, YAVAS), true);
  });

  test('bekleme SINIRSIZ uzamıyor — kaynak açılırsa geri dönülür', () => {
    // Üst sınır olmasaydı 20 hatadan sonra bekleme yıllara çıkar ve kaynak
    // açıldığında sistem bunu hiç fark etmezdi.
    const cok = { yavas: { sonDeneme: T0, ardisikHata: 20 } };
    assert.equal(denenebilir('yavas', cok, T0 + EN_UZUN_BEKLEME_MS, YAVAS), true);
  });

  test('KARARSIZ kaynakta hatadan sonra KISA aralıkla tekrar denenir', () => {
    // Dalgalı bir uç için üstel geri çekilme TERS çalışır: tek bir 400 yüzünden
    // saatlerce susulur ve veri hiç gelmez. Bu kaynaklarda hata sonrası sabit
    // kısa aralık kullanılır.
    const uc = { dalgali: { sonDeneme: T0, ardisikHata: 3 } };
    assert.equal(denenebilir('dalgali', uc, T0 + 5 * 60e3, DALGALI), false);
    assert.equal(denenebilir('dalgali', uc, T0 + 10 * 60e3, DALGALI), true);
    // Israrlı hata bu aralığı UZATMAZ — kaynak dalgalı, kapalı değil.
    const cok = { dalgali: { sonDeneme: T0, ardisikHata: 20 } };
    assert.equal(denenebilir('dalgali', cok, T0 + 10 * 60e3, DALGALI), true);
  });

  test('kararsız kaynak BAŞARIDAN sonra normal tempoya döner', () => {
    const iyi = { dalgali: { sonDeneme: T0, ardisikHata: 0 } };
    assert.equal(denenebilir('dalgali', iyi, T0 + 30 * 60e3, DALGALI), false);
    assert.equal(denenebilir('dalgali', iyi, T0 + SAAT, DALGALI), true);
  });
});

describe('durumuGuncelle', () => {
  test('başarıda hata sayacı SIFIRLANIR', () => {
    const once = { yavas: { sonDeneme: T0 - SAAT, ardisikHata: 3 } };
    const sonra = durumuGuncelle('yavas', once, true, T0, YAVAS);
    assert.equal(sonra.yavas.ardisikHata, 0);
    assert.equal(sonra.yavas.sonBasari, T0);
    assert.equal(sonra.yavas.sonDeneme, T0);
  });

  test('hatada sayaç ARTAR ve son başarı korunur', () => {
    const once = { yavas: { sonDeneme: T0 - SAAT, ardisikHata: 1, sonBasari: T0 - 5 * SAAT } };
    const sonra = durumuGuncelle('yavas', once, false, T0, YAVAS);
    assert.equal(sonra.yavas.ardisikHata, 2);
    assert.equal(sonra.yavas.sonBasari, T0 - 5 * SAAT);   // geçmiş başarı silinmez
  });

  test('boş durumla çağrılabilir', () => {
    const sonra = durumuGuncelle('yavas', undefined, true, T0, YAVAS);
    assert.equal(sonra.yavas.ardisikHata, 0);
  });
});

describe('kalıcı durum kirliliği', () => {
  test('TEMPOSU OLMAYAN sağlayıcı duruma HİÇ yazılmaz', () => {
    // Testlerin uydurma sağlayıcıları (testprov, bozuk, saglam…) kalıcı cache
    // dosyasına sızıyordu: dosya şişiyor ve bir testin sabit tarihi gerçek bir
    // kaynağın "son başarı" değeri gibi görünüyordu.
    const sonra = durumuGuncelle('testprov', {}, false, T0, YAVAS);
    assert.deepEqual(sonra, {});
  });

  test('temposu OLAN sağlayıcı normal şekilde kaydediliyor', () => {
    const sonra = durumuGuncelle('yavas', {}, false, T0, YAVAS);
    assert.equal(sonra.yavas.ardisikHata, 1);
  });
});
