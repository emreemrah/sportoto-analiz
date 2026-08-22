// MÜHÜR BEKÇİSİ — pencere kararı.
//
// NEDEN TEST EDİLİYOR: bekçinin tek kararı "şu an mühür penceresinde miyim".
// Yanlış olursa iki yönde de zarar var:
//   * çok dar  → mühür kaçar, hafta karne dışı kalır (late_lock). Üretimde
//                ölçülen bilanço zaten 3 kayıp hafta.
//   * çok geniş→ Render boşuna uyanık tutulur; ücretsiz planın 750 saat/ay
//                bütçesi yenir ve servis ayın sonunda askıya alınabilir.
//
// GitHub zamanlayıcısı 30 dakikada bir çalışır ve GECİKEBİLİR; pencere bu
// yüzden 40 dakikadır. Aşağıdaki "gecikme" testi tam olarak bunu bağlar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pencereDurumu } from '../scripts/muhur-bekcisi.mjs';

const DK = 60 * 1000;
const ONCE = 40 * DK;
const KUYRUK = 10 * DK;
const secenek = { onceMs: ONCE, kuyrukMs: KUYRUK };
const freeze = new Date('2026-08-21T18:25:00Z').getTime();
const anda = (dkFark) => freeze + dkFark * DK;

test('pencereden ÖNCE sunucuya dokunulmaz', () => {
  assert.equal(pencereDurumu(anda(-120), freeze, secenek), 'erken');
  assert.equal(pencereDurumu(anda(-41), freeze, secenek), 'erken');
});

test('pencere tam sınırda AÇILIR', () => {
  assert.equal(pencereDurumu(anda(-40), freeze, secenek), 'acik');
});

test('mühür anında pencere AÇIK', () => {
  assert.equal(pencereDurumu(freeze, freeze, secenek), 'acik');
});

test('mühürden sonra kuyruk payı boyunca AÇIK kalır', () => {
  // Mühür tam anında atılmayabilir (worker tick'i, ağ). Kuyruk bu payı verir.
  assert.equal(pencereDurumu(anda(10), freeze, secenek), 'acik');
  assert.equal(pencereDurumu(anda(11), freeze, secenek), 'gecti');
});

test('30 dk’lık zamanlayıcı GECİKSE BİLE mühür yakalanır', () => {
  // GitHub cron'u garantili değildir; serbest planda 10-15 dk gecikebilir.
  // 30 dk aralık + 40 dk pencere → en kötü ihtimalle bile en az bir koşu
  // pencerenin içine düşer. Aşağıdaki tarama bunu kanıtlar.
  for (let gecikme = 0; gecikme <= 15; gecikme += 1) {
    const koslar = [];
    // Mühürden 3 saat önce başlayıp 30 dk’da bir koşan zamanlayıcı.
    for (let t = -180; t <= 30; t += 30) {
      koslar.push(pencereDurumu(anda(t + gecikme), freeze, secenek));
    }
    assert.ok(
      koslar.includes('acik'),
      `gecikme ${gecikme} dk iken hiçbir koşu pencereye düşmedi — mühür kaçar`,
    );
  }
});

test('mühür anı bilinmiyorsa karar verilmez', () => {
  // Bilinmezlikte "uyandır" demek, her yarım saatte sunucuyu diriltmek olurdu.
  assert.equal(pencereDurumu(Date.now(), NaN, secenek), 'bilinmiyor');
  assert.equal(pencereDurumu(Date.now(), null, secenek), 'bilinmiyor');
});
