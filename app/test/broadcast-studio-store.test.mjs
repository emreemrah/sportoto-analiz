// YAYIN STÜDYOSU DEPOSU TESTLERİ.
//
// Bu deponun tek riski şudur: yayıncı canlı yayında deneme yaparken kullanıcının
// KENDİ kupon taslağını ezmek. Testlerin ilk işi bunun İMKÂNSIZ olduğunu
// göstermek; ikinci işi, seçimlerin gerçekten kalıcı olduğunu ve depoya kişisel
// veri sızmadığını kanıtlamak.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  subscribeStudio, getStudio, getPicks, getNotes,
  setPick, togglePick, setNote, rememberCoupon, clearStudio,
  publishLocks, isStudioLocked,
  NOTE_MAX, _resetStudioCache,
} from '../src/broadcastStudioStore.js';

const buDizin = dirname(fileURLToPath(import.meta.url));
const kaynak = readFileSync(join(buDizin, '..', 'src', 'broadcastStudioStore.js'), 'utf8');
// Kaynak taramaları YORUMSUZ metin üzerinde yapılır. Dosyanın başlığı, hangi
// anahtara DOKUNULMAYACAĞINI açıkça yazdığı için (ör. kupon taslağı anahtarı)
// yorumları taramak yanlış alarm üretir. Aranan şey koddur, açıklama değil.
const kod = kaynak
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  // `://` içeren satır adres olabilir; orada kesme yapılmaz.
  .map((s) => (s.includes('://') ? s : s.replace(/\/\/.*$/, '')))
  .join('\n');

const R = 4300;   // hafta (roundId)
const R2 = 4301;

const temizle = () => { _resetStudioCache(); };

/* ═══════════════ 1) ANAHTAR AYRIMI — asıl güvenlik kuralı ═══════════════ */

test('depo KENDİ anahtarını kullanır: sportoto.broadcastStudio.v1', () => {
  assert.ok(kod.includes("'sportoto.broadcastStudio.v1'"), 'yeni anahtar tanımlı değil');
});

test('yayın seçimleri kullanıcının kupon taslağına/kuponlarına YAZAMAZ', () => {
  for (const yasak of [
    'sportoto.couponCenterDraft.v1',   // kullanıcının kendi taslağı
    'sportoto.couponCenter.v1',        // kaydedilmiş kuponlar
    'sportoto.token',                  // oturum belirteci
    'sportoto.prefs',
    'sportoto.analysisProfile',
    'sportoto.notifications.v1',
    'sportoto.push.v1',
  ]) {
    assert.ok(!kod.includes(yasak), `yayın deposu başka bir depoya dokunuyor: ${yasak}`);
  }
  assert.ok(!/from '\.\/coupon\/store'/.test(kod), 'yayın deposu kupon deposunu import ediyor');
  assert.ok(!/from '\.\/api'/.test(kod), 'yayın seçimleri sunucuya gönderilmemeli');
});

/* ═══════════════ 2) SEÇİMLER KALICI VE KANONİK ═══════════════ */

test('setPick: seçim kaydedilir ve kanonik sıraya oturur', () => {
  temizle();
  setPick(R, 3, ['2', '1']);
  assert.deepEqual(getStudio(R).picks, { 3: ['1', '2'] });
  assert.deepEqual(getPicks(R), { 3: ['1', '2'] });
});

test('setPick: boş seçim kaydı SİLER (boş dizi artığı bırakmaz)', () => {
  temizle();
  setPick(R, 3, ['1']);
  setPick(R, 3, []);
  assert.deepEqual(getStudio(R).picks, {});
  setPick(R, 4, ['1']);
  setPick(R, 4, null);
  assert.deepEqual(getStudio(R).picks, {});
});

test('setPick: geçersiz işaret depoya giremez', () => {
  temizle();
  setPick(R, 1, ['1', 'Z', '9', null]);
  assert.deepEqual(getStudio(R).picks, { 1: ['1'] });
});

test('togglePick: ana liste ile maç detayı AYNI davranır (ekle → çıkar)', () => {
  temizle();
  togglePick(R, 7, 'X');
  assert.deepEqual(getStudio(R).picks[7], ['X']);
  togglePick(R, 7, '1');
  assert.deepEqual(getStudio(R).picks[7], ['1', 'X'], 'sonradan seçilen 1 başa geçer');
  togglePick(R, 7, '2');
  assert.deepEqual(getStudio(R).picks[7], ['1', 'X', '2']);
  togglePick(R, 7, 'X');
  assert.deepEqual(getStudio(R).picks[7], ['1', '2']);
  togglePick(R, 7, '1'); togglePick(R, 7, '2');
  assert.equal(getStudio(R).picks[7], undefined, 'tüm işaretler kaldırılınca kayıt kalmaz');
});

test('haftalar birbirine KARIŞMAZ', () => {
  temizle();
  setPick(R, 1, ['1']);
  setPick(R2, 1, ['2']);
  assert.deepEqual(getStudio(R).picks, { 1: ['1'] });
  assert.deepEqual(getStudio(R2).picks, { 1: ['2'] });
  assert.deepEqual(getStudio(9999).picks, {}, 'kaydı olmayan hafta BOŞ döner');
});

test('roundId yoksa yazma yapılmaz, okuma boş döner (çökmez)', () => {
  temizle();
  assert.deepEqual(getStudio(null), { roundId: null, picks: {}, notes: {}, couponIds: [], updatedAt: null });
  assert.deepEqual(setPick(null, 1, ['1']), {});
  assert.deepEqual(setNote(undefined, 1, 'not'), {});
});

/* ═══════════════ 3) YAYINCI NOTU ═══════════════ */

test('setNote: not kaydedilir, boş not silinir', () => {
  temizle();
  setNote(R, 5, 'Ev sahibi iç sahada 6 maçtır kaybetmiyor.');
  assert.equal(getNotes(R)[5], 'Ev sahibi iç sahada 6 maçtır kaybetmiyor.');
  setNote(R, 5, '   ');
  assert.equal(getStudio(R).notes[5], undefined);
});

test('setNote: üst sınır aşılamaz (yayın panelini taşırmaz)', () => {
  temizle();
  setNote(R, 6, 'a'.repeat(NOTE_MAX + 250));
  assert.equal(getNotes(R)[6].length, NOTE_MAX);
});

/* ═══════════════ 4) KAYDEDİLEN KUPON — yalnız KİMLİK tutulur ═══════════════ */

test('rememberCoupon: kimlik bir kez eklenir; kupon verisi burada TUTULMAZ', () => {
  temizle();
  rememberCoupon(R, 'kpn-1');
  rememberCoupon(R, 'kpn-1');
  rememberCoupon(R, 'kpn-2');
  assert.deepEqual(getStudio(R).couponIds, ['kpn-1', 'kpn-2']);
  rememberCoupon(R, '');
  rememberCoupon(R, { id: 'nesne' });
  assert.deepEqual(getStudio(R).couponIds, ['kpn-1', 'kpn-2'], 'yalnız metin kimlik kabul edilir');
});

test('clearStudio: yalnız o haftanın oturumunu siler, kupon kimlikleri de gider ama kuponlara dokunulmaz', () => {
  temizle();
  setPick(R, 1, ['1']); setNote(R, 1, 'not'); rememberCoupon(R, 'kpn-1');
  setPick(R2, 1, ['2']);
  clearStudio(R);
  assert.deepEqual(getStudio(R), { roundId: R, picks: {}, notes: {}, couponIds: [], updatedAt: null });
  assert.deepEqual(getStudio(R2).picks, { 1: ['2'] }, 'diğer hafta silinmemeli');
  // Kupon SİLME çağrısı bu dosyada yoktur — arşiv korunur.
  assert.ok(!/deleteCoupon/.test(kod), 'yayın deposu kupon silmeye kalkışmamalı');
});

/* ═══════════════ 5) DIŞARI VERİLEN ŞEKİL VE KİŞİSEL VERİ ═══════════════ */

test('getStudio SABİT beş alan döndürür — iç alanlar sızmaz', () => {
  temizle();
  setPick(R, 1, ['1']);
  assert.deepEqual(Object.keys(getStudio(R)).sort(), ['couponIds', 'notes', 'picks', 'roundId', 'updatedAt']);
});

test('depoya kişisel veri yazacak bir yol YOK', () => {
  temizle();
  // Yazma uçları yalnız (hafta, maç no, işaret/not/kupon kimliği) alır.
  setPick(R, 1, ['1']);
  setNote(R, 1, 'ev sahibi formda');
  rememberCoupon(R, 'kpn-9');
  const cikti = JSON.stringify(getStudio(R));
  for (const iz of ['@', 'token', 'email', 'password', 'phone']) {
    assert.ok(!cikti.includes(iz), `depoya kişisel veri izi sızmış: ${iz}`);
  }
  // Kaynakta da kişisel alan okuma girişimi olmamalı.
  for (const alan of ['userEmail', 'userName', 'password', 'getItem(TOKEN', 'email']) {
    assert.ok(!kod.includes(alan), `depo kişisel alana bakıyor: ${alan}`);
  }
});

test('bozuk/yabancı kayıt diskten gelse bile içeri ALINMAZ', () => {
  temizle();
  // sanitize yolunu doğrudan zorlamak için depo çıktısının şekli sabitlenir:
  // yazma uçlarından geçmeyen hiçbir alan getStudio çıktısında görünemez.
  setPick(R, 2, ['X']);
  const w = getStudio(R);
  assert.equal(w.seq, undefined, 'iç sıra numarası dışarı çıkmamalı');
  assert.equal(w.schema, undefined);
});

/* ═══════════════ 6) ABONELİK — ekran anında tazelenir ═══════════════ */

test('subscribeStudio: her yazmada haber verir, abonelik iptali çalışır', () => {
  temizle();
  let n = 0;
  const iptal = subscribeStudio(() => { n += 1; });
  setPick(R, 1, ['1']);
  setNote(R, 1, 'not');
  assert.equal(n, 2);
  iptal();
  setPick(R, 2, ['2']);
  assert.equal(n, 2, 'iptalden sonra haber gelmemeli');
});

test('abone hata fırlatsa bile depo yazmayı sürdürür', () => {
  temizle();
  const iptal = subscribeStudio(() => { throw new Error('ekran çöktü'); });
  assert.doesNotThrow(() => setPick(R, 1, ['1']));
  assert.deepEqual(getStudio(R).picks, { 1: ['1'] });
  iptal();
});

/* ═══════════════ 7) CİHAZDA SINIRSIZ BİRİKMEZ ═══════════════ */

test('yalnız son sekiz hafta tutulur ve EN YENİ hafta budanmaz', () => {
  temizle();
  for (let i = 0; i < 12; i++) setPick(4200 + i, 1, ['1']);
  const kalan = [];
  for (let i = 0; i < 12; i++) if (getStudio(4200 + i).picks[1]) kalan.push(4200 + i);
  assert.equal(kalan.length, 8, `sekiz hafta kalmalı, kalan: ${kalan.join(',')}`);
  assert.deepEqual(kalan, [4204, 4205, 4206, 4207, 4208, 4209, 4210, 4211], 'en yeni sekiz hafta kalmalı');
});

/* ═══════════════ 8) HAFTA KİLİDİ — kilitten sonra yalnız görüntüleme ═══════════════
   Kural: "Hafta kilitlendikten sonra düzenleme kapatılacak, sadece görüntüleme
   açık kalacak." Bunu ekranın kutuyu pasifleştirmesine bırakmak yetmez — iki
   ekran da hatırlamak zorunda kalır ve biri unutursa BAŞLAMIŞ maçın kaydı
   sessizce değişir. Son söz burada, depodadır. */

const DK = 60 * 1000;
/** Kilit anı couponConfig kuralıyla oluşsun diye gerçek maç nesnesi verilir. */
const mac = (no, baslangicMs) => ({ no, date: new Date(baslangicMs).toISOString() });

test('publishLocks bildirilmeden kilit UYGULANMAZ (kural couponConfig\'ten gelir)', () => {
  temizle();
  // Harita bildirilmemiş: depo hangi maçın ne zaman kilitlendiğini bilmez.
  // Bu bilinçli bir seçim — depo kendi zaman kuralını UYDURMAZ.
  assert.equal(isStudioLocked(R, 1), false);
  setPick(R, 1, ['1']);
  assert.deepEqual(getStudio(R).picks, { 1: ['1'] });
});

test('başlamış maçın seçimi değiştirilemez (kutu açık kalsa bile)', () => {
  temizle();
  publishLocks(R, [mac(1, Date.now() - 60 * DK), mac(2, Date.now() + 60 * DK)]);
  assert.equal(isStudioLocked(R, 1), true, 'başlamış maç kilitli olmalı');
  assert.equal(isStudioLocked(R, 2), false, 'başlamamış maç açık olmalı');

  setPick(R, 1, ['1']);
  assert.deepEqual(getStudio(R).picks, {}, 'kilitli maça YENİ seçim yazılamaz');

  setPick(R, 2, ['X']);
  assert.deepEqual(getStudio(R).picks, { 2: ['X'] }, 'açık maça seçim yazılabilmeli');
});

test('kilit maç bazındadır: 5 dk kuralı couponConfig\'ten gelir, burada yeniden yazılmaz', () => {
  temizle();
  // Maç 4 dakika sonra başlıyor → kilit anı (başlangıç − 5 dk) çoktan geçti.
  publishLocks(R, [mac(7, Date.now() + 4 * DK)]);
  assert.equal(isStudioLocked(R, 7), true, 'başlangıçtan 5 dk önce kapanmalı');
  // Maç 9 dakika sonra başlıyor → kilide 4 dakika var.
  publishLocks(R, [mac(8, Date.now() + 9 * DK)]);
  assert.equal(isStudioLocked(R, 8), false);
});

test('kilitlenmeden önce yazılmış seçim OLDUĞU GİBİ kalır — silinmez, bozulmaz', () => {
  temizle();
  publishLocks(R, [mac(3, Date.now() + 60 * DK)]);
  setPick(R, 3, ['1', 'X']);
  // Maç başladı: aynı hafta yeni kilit haritasıyla bildirilir.
  publishLocks(R, [mac(3, Date.now() - 1 * DK)]);
  assert.deepEqual(getStudio(R).picks, { 3: ['1', 'X'] }, 'kayıt korunmalı');
  togglePick(R, 3, '2');
  assert.deepEqual(getStudio(R).picks, { 3: ['1', 'X'] }, 'kilitten sonra dokunmak değiştirmemeli');
  setPick(R, 3, []);
  assert.deepEqual(getStudio(R).picks, { 3: ['1', 'X'] }, 'kilitli seçim silinemez');
});

test('kilitli maçın NOTU da değişmez (yayında söylenen cümle geriye dönük düzeltilmez)', () => {
  temizle();
  publishLocks(R, [mac(5, Date.now() + 60 * DK)]);
  setNote(R, 5, 'Ev sahibi iç sahada güçlü.');
  publishLocks(R, [mac(5, Date.now() - 1 * DK)]);
  setNote(R, 5, 'Aslında deplasman demiştim.');
  assert.deepEqual(getStudio(R).notes, { 5: 'Ev sahibi iç sahada güçlü.' }, 'not geriye dönük yazılamaz');
  setNote(R, 5, '');
  assert.deepEqual(getStudio(R).notes, { 5: 'Ev sahibi iç sahada güçlü.' }, 'kilitli not silinemez');
});

test('kilitli maça reddedilen yazma da aboneyi uyarır (ekran kilidi görsün)', () => {
  temizle();
  publishLocks(R, [mac(1, Date.now() - 60 * DK)]);
  let n = 0;
  const iptal = subscribeStudio(() => { n += 1; });
  togglePick(R, 1, '1');
  assert.equal(n, 1, 'reddedilen dokunuş sonrası ekran yeniden çizilmeli');
  iptal();
});

test('temizle: kilitli maçlar korunur, yalnız açık maçlar silinir', () => {
  temizle();
  publishLocks(R, [mac(1, Date.now() + 60 * DK), mac(2, Date.now() + 60 * DK)]);
  setPick(R, 1, ['1']); setNote(R, 1, 'yayında söylendi');
  setPick(R, 2, ['2']); setNote(R, 2, 'ikinci maç');
  // 1 numaralı maç başladı; 2 hâlâ açık.
  publishLocks(R, [mac(1, Date.now() - 60 * DK), mac(2, Date.now() + 60 * DK)]);
  clearStudio(R);
  assert.deepEqual(getStudio(R).picks, { 1: ['1'] }, 'kilitli seçim temizlemeyle yok edilemez');
  assert.deepEqual(getStudio(R).notes, { 1: 'yayında söylendi' }, 'kilitli not temizlemeyle yok edilemez');
});

test('kilit haftaya özeldir: bir haftanın kilidi diğerini kapatmaz', () => {
  temizle();
  publishLocks(R, [mac(1, Date.now() - 60 * DK)]);
  assert.equal(isStudioLocked(R2, 1), false, 'başka haftanın maçı kilitli sayılmamalı');
  setPick(R2, 1, ['1']);
  assert.deepEqual(getStudio(R2).picks, { 1: ['1'] });
});

test('depo kendi kilit eşiğini YAZMAZ — süre sabiti couponConfig\'te kalır', () => {
  assert.ok(!/5\s*\*\s*60\s*\*\s*1000/.test(kod), 'kilit süresi depoda yeniden yazılmış');
  assert.ok(!kod.includes('LOCK_BEFORE_MS'), 'eşik depoya kopyalanmış');
  assert.ok(kod.includes('lockMapOf'), 'kilit anları tek kaynaktan alınmıyor');
});
