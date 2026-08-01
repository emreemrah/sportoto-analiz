// GELİŞTİRME TESTİ — GERÇEK MAÇ HATIRLATMASINI 1 DAKİKAYA KURMA (SAF MODÜL)
//
// React Native / expo-notifications burada İMPORT EDİLMEZ; bu dosya yalnız
// "hangi gerçek maç seçilir ve bildirimi ne olur" sorusunu yanıtlar. Cihazla
// konuşan taraf `pushSync.testMacKur` → `services/pushService.js`.
//
// NEDEN VAR: üretimdeki maç hatırlatması maçtan 60 dakika önce düşer. Bildirime
// dokununca doğru maç detayının açıldığını gerçek telefonda görmek için saatlerce
// beklemek gerekirdi. Bu modül, ÜRETİMDE KULLANILAN `match-starting`
// bildiriminin aynısını 1 dakika sonrasına kurmak için gereken seçimi yapar.
// Amaç yeni bir bildirim sistemi kurmak DEĞİL, var olanı kanıtlamaktır.
//
// KESİN KURALLAR
//  1) MAÇ UYDURULMAZ. Yalnız güncel bültendeki gerçek ve başlamamış bir maç
//     kullanılır. Bülten yoksa ya da uygun maç kalmadıysa dürüstçe "bulunamadı"
//     denir; sahte maç, sahte saat, sahte takım üretilmez.
//  2) Bildirimin içeriği `pushPlanner.macBildirimIcerigi` ile üretilir — yani
//     üretimdeki hatırlatmanın TIPKISI. Ayrı/sahte bir içerik yolu yoktur.
//  3) Üretimdeki 60 dakika düzeni DEĞİŞMEZ. Bu kayıt ayrı bir kimlik taşır
//     (`test:mac`), `mac:<hafta>:<no>` ailesine girmez; bu yüzden eşitleme
//     (`diffSchedule`) onu ne kurar ne de siler, "kurulu hatırlatma" sayısına
//     da karışmaz.
//  4) Bildirimde yalnız maç numarası, takım adları ve saat bulunur. Kupon verisi
//     bu dosyada HİÇ okunmaz; tahmin, seçim, kullanıcı, e-posta ve oturum
//     bilgisi taşınmaz.
//  5) Yalnız geliştirme kipinde açılır. Yayın derlemesinde `__DEV__` false'tur;
//     bu seçenek müşteriye HİÇ görünmez.

import { isOfficial } from './notifications';
import { macBilgisi, macBildirimIcerigi } from './pushPlanner';

/** Geliştirme testi kaydının sabit kimliği — üretim ailesine (`mac:`) girmez. */
export const TEST_MAC_ID = 'test:mac';

/** Kaç saniye sonra düşsün (kullanıcıya "1 dakika" denir). */
export const TEST_MAC_ONCE_SN = 60;

// Telefonda gerçek hatırlatmayla karışmasın diye başlık açıkça işaretlidir.
// Gövde ve yönlendirme verisi üretimdekinin AYNISIDIR; yönlendirmeyi belirleyen
// de zaten gövde değil, verideki `kind` alanıdır (pushRoute.js).
export const TEST_MAC_BASLIK = 'Geliştirme testi: maç birazdan başlıyor';

/**
 * Geliştirme kipi mi?
 *
 * `__DEV__` ÇAĞRI ANINDA okunur (import anında değil): testler kipi geçici
 * olarak değiştirip geri alabilsin diye — `demoGate.js` ile aynı desen.
 * Yayın derlemesinde `__DEV__` false'tur, bu yüzden kapı orada DAİMA kapalıdır.
 */
export function gelistirmeKipi() {
  return typeof __DEV__ !== 'undefined' ? __DEV__ === true : false;
}

/**
 * Testte kullanılacak GERÇEK maçı seçer: güncel bültendeki, başlamamış,
 * başlama saati ve takım adları bilinen maçlar arasından EN YAKIN olanı.
 *
 * En yakın maç seçilir çünkü bülten ilerledikçe bu maç da ilerler; böylece test
 * her zaman "gerçekten sırada olan" bir maçla yapılır.
 *
 * @param {{now?:number, bulletin?:object}} g
 * @returns {{ok:boolean, neden:string, mac:{no:number,ev:string,dep:string,baslama:number}|null}}
 *   neden: '' | 'bulten-yok' | 'mac-yok'
 */
export function testMacSec({ now = 0, bulletin = null } = {}) {
  const maclar = Array.isArray(bulletin?.matches) ? bulletin.matches : null;
  // Bülten okunamadıysa maç UYDURULMAZ; bu dürüstçe ayrı bir nedendir.
  if (!maclar || !maclar.length) return { ok: false, neden: 'bulten-yok', mac: null };

  let secilen = null;
  for (const m of maclar) {
    // Başlamış / canlı / resmî sonucu gelmiş maç testte de kullanılmaz.
    if (m?.status === 'finished' || m?.status === 'live' || isOfficial(m)) continue;

    const bilgi = macBilgisi(m);
    if (!bilgi) continue;                     // numara/saat/takım eksik → atla
    if (bilgi.baslama <= now) continue;       // başlama saati geçmiş → atla

    if (!secilen || bilgi.baslama < secilen.baslama) secilen = bilgi;
  }

  if (!secilen) return { ok: false, neden: 'mac-yok', mac: null };
  return { ok: true, neden: '', mac: secilen };
}

/**
 * Seçilen gerçek maç için kurulacak bildirim kaydı.
 *
 * Kayıt, üretimdeki hatırlatmayla aynı biçimdedir ({id, fireAt, title, body,
 * data}); yalnız kimliği ve düşme anı farklıdır.
 *
 * @returns {{ok:boolean, neden:string, mac:object|null, kayit?:object}}
 */
export function testMacIcerigi({ now = 0, bulletin = null } = {}) {
  const secim = testMacSec({ now, bulletin });
  if (!secim.ok) return secim;

  return {
    ok: true,
    neden: '',
    mac: secim.mac,
    kayit: {
      id: TEST_MAC_ID,
      fireAt: Number(now) + TEST_MAC_ONCE_SN * 1000,
      ...macBildirimIcerigi({ ...secim.mac, baslik: TEST_MAC_BASLIK }),
    },
  };
}
