// KUPON KULLANICI İZOLASYONU — bir kullanıcının kuponu diğerine geçmez.
//
// DOĞRULANMIŞ HATA: kupon deposunun anahtarları CİHAZA aitti, kullanıcıya
// değil (`sportoto.couponCenter.v1`). `logout()` yalnız belirteç/oturum kaydını
// siliyordu (tokenStore.clearPersisted); kupon deposuna dokunmuyordu.
//
// İki sonucu vardı:
//   1. A çıkış yapınca B, A'nın kuponlarını GÖRÜYORDU.
//   2. Daha kötüsü: senkron `putCoupons([...serverLegacy, ...readAll()])`
//      ile yereli sunucuya yazdığı için A'nın kuponları B'NİN HESABINA
//      kaydedilebiliyordu.
//
// Koruma iki katmanlı ve ikisi de burada sınanır:
//   * `yereliTemizle()`  → çıkışta çağrılır
//   * `sahibiAyarla(id)` → girişte çağrılır; depoda BAŞKA sahip varsa siler.
//     Bu ikincisi çıkışın hiç çalışmadığı hâlleri de kapatır (uygulama
//     öldürüldü, çökme, eski sürümden yükseltme).

// Depo localStorage'a yazıyor; node'da yok, sahtesini kuruyoruz.
const bellek = new Map();
globalThis.localStorage = {
  getItem: (k) => (bellek.has(k) ? bellek.get(k) : null),
  setItem: (k, v) => { bellek.set(k, String(v)); },
  removeItem: (k) => { bellek.delete(k); },
};

import {
  createCoupon, getWeekCoupons, buildVersion, yereliTemizle, sahibiAyarla,
  setDraftPick, getDraft,
} from '../src/coupon/store';

const KUPON_ANAHTAR = 'sportoto.couponCenter.v1';

// Kilit kuralı devrede: maç başlamamış olmalı. Zamanı ŞİMDİYE GÖRE veriyoruz
// ki test takvimle eskimesin (sabit tarih kullanmak daha önce testleri bozdu).
// lockMap SAYISAL zaman damgası ister (couponConfig.matchLockAt ms döner);
// ISO string verilirse karşılaştırma NaN üretip her maçı kilitli sayar.
const ILERIDE = Date.now() + 30 * 86400e3;
const secim = () => buildVersion([{ no: 1, selectedOutcomes: ['1'] }], {
  lockMap: { 1: ILERIDE },
});

function kuponYarat(ad) {
  return createCoupon({ roundId: 1600, lockMap: { 1: ILERIDE } }, secim(), ad);
}

beforeEach(() => { bellek.clear(); yereliTemizle(); });

test('ÇIKIŞTA yerel kupon ve taslak tamamen siliniyor', () => {
  sahibiAyarla('kullanici-A');
  kuponYarat('A kuponu');
  setDraftPick(1600, 2, ['X']);
  expect(getWeekCoupons(1600).length).toBe(1);
  expect(getDraft(1600).picks[2]).toEqual(['X']);

  yereliTemizle();

  expect(getWeekCoupons(1600).length).toBe(0, 'kupon çıkışta silinmedi');
  expect(getDraft(1600).picks).toEqual({});
  expect(bellek.get(KUPON_ANAHTAR)).toBe(undefined, 'depoda kayıt kaldı');
});

test('BAŞKA kullanıcı girince önceki kullanıcının kuponu SİLİNİYOR', () => {
  sahibiAyarla('kullanici-A');
  kuponYarat('A kuponu');
  expect(getWeekCoupons(1600).length).toBe(1);

  // A çıkış yapmadı (uygulama öldürüldü) — B giriyor.
  const silindi = sahibiAyarla('kullanici-B');

  expect(silindi).toBe(true, 'sahip değişimi fark edilmedi');
  expect(getWeekCoupons(1600).length).toBe(0, "B, A'nın kuponunu görüyor");
});

test('AYNI kullanıcı tekrar girince kuponu KORUNUYOR', () => {
  // İzolasyon veri kaybına dönüşmemeli: aynı hesap yeniden girdiğinde
  // kendi kuponu yerinde kalmalı.
  sahibiAyarla('kullanici-A');
  kuponYarat('A kuponu');

  const silindi = sahibiAyarla('kullanici-A');

  expect(silindi).toBe(false);
  expect(getWeekCoupons(1600).length).toBe(1, 'kendi kuponu silinmiş');
});

test('sahipsiz depoya ilk giriş veriyi silmez (misafirken yapılan kupon)', () => {
  // Giriş yapmadan kupon kuran kullanıcı, sonra giriş yaptığında kuponunu
  // kaybetmemeli — depoda henüz bir sahip yazılı değildir.
  kuponYarat('misafir kuponu');
  expect(getWeekCoupons(1600).length).toBe(1);

  const silindi = sahibiAyarla('kullanici-A');

  expect(silindi).toBe(false);
  expect(getWeekCoupons(1600).length).toBe(1, 'misafir kuponu kayboldu');
});

test('çıkıştan sonra sahip kaydı da temizleniyor', () => {
  // Sahip kaydı kalsaydı, aynı kullanıcı yeniden girdiğinde "değişmedi" denip
  // bir sonraki kullanıcı için koruma yanlış tarafa çalışabilirdi.
  sahibiAyarla('kullanici-A');
  yereliTemizle();
  kuponYarat('B kuponu');                    // çıkış sonrası misafir kuponu
  const silindi = sahibiAyarla('kullanici-B');
  expect(silindi).toBe(false, 'sahip kaydı çıkışta temizlenmemiş');
  expect(getWeekCoupons(1600).length).toBe(1);
});
