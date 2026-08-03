// TAHMİN KAPISI — maç başladıktan sonra tahmin/puan girilemez.
//
// DOĞRULANMIŞ AÇIK: tahmin uçları (skor, oyuncu, kadro, anket) yalnız
// `matchId` gönderilmiş mi diye bakıyordu. Maçın var olup olmadığı, hangi
// bültene ait olduğu ve BAŞLAYIP BAŞLAMADIĞI hiç doğrulanmıyordu. İki istismar:
//
//   1. Sonuç açıklandıktan sonra doğru tahmin gönderilip "önceden bilmiş" gibi
//      kaydedilebiliyor ve katılım puanı alınabiliyordu.
//   2. Uydurma bir matchId ile sınırsız puan toplanabiliyordu.
//
// İstemcideki kilit yeterli değildir — istemci kodu kullanıcının elindedir.
// Bu testler kuralın SUNUCUDA durduğunu bağlar.
import test from 'node:test';
import assert from 'node:assert/strict';

import { tahminKabulEdilirMi, KILIT_ONCESI_MS } from '../src/security/tahminKapisi.js';

// Zaman SABİT değil, "şimdi"ye görelidir: sabit tarihli fikstürler takvim
// ilerleyince sessizce anlamını yitiriyordu (projede yaşanmış bir hata).
const SIMDI = Date.parse('2026-08-02T12:00:00Z');
const bulten = (dakikaSonra) => ({
  matches: [
    { sportotoMatchId: 'm1', no: 1, date: new Date(SIMDI + dakikaSonra * 60e3).toISOString() },
    { sportotoMatchId: 'm2', no: 2, date: new Date(SIMDI + 600 * 60e3).toISOString() },
  ],
});

test('maça bir saat varsa tahmin KABUL edilir', () => {
  const r = tahminKabulEdilirMi('m1', bulten(60), SIMDI);
  assert.equal(r.ok, true);
});

test('maç BAŞLADIYSA tahmin reddedilir', () => {
  const r = tahminKabulEdilirMi('m1', bulten(-30), SIMDI);   // 30 dk önce başlamış
  assert.equal(r.ok, false);
  assert.equal(r.code, 'match_started');
});

test('maç BİTTİYSE de reddedilir (asıl istismar buydu)', () => {
  const r = tahminKabulEdilirMi('m1', bulten(-180), SIMDI);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'match_started');
});

test('kilit maçtan 5 dk ÖNCE kapanır — sınır davranışı', () => {
  // Kupon tarafındaki kuralla aynı: her maç kendi başlangıcından 5 dk önce.
  assert.equal(KILIT_ONCESI_MS, 5 * 60e3);
  // Kilide 1 saniye kala: hâlâ açık.
  const acik = tahminKabulEdilirMi('m1', bulten(5.02), SIMDI);
  assert.equal(acik.ok, true);
  // Tam kilit anı: kapalı.
  const kapali = tahminKabulEdilirMi('m1', bulten(5), SIMDI);
  assert.equal(kapali.ok, false, 'kilit anında hâlâ açık');
  assert.equal(kapali.code, 'match_started');
});

test('BÜLTENDE OLMAYAN maça tahmin girilemez (uydurma matchId ile puan yok)', () => {
  const r = tahminKabulEdilirMi('uydurma-999', bulten(60), SIMDI);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'unknown_match');
});

test('matchId boşsa reddedilir', () => {
  assert.equal(tahminKabulEdilirMi('', bulten(60), SIMDI).code, 'missing_match');
  assert.equal(tahminKabulEdilirMi(null, bulten(60), SIMDI).code, 'missing_match');
});

test('bülten okunamıyorsa istek KABUL EDİLMEZ (doğrulanamayan geçmez)', () => {
  // Doğrulayamadığımızda kabul etmek kapıyı tümüyle açardı.
  assert.equal(tahminKabulEdilirMi('m1', null, SIMDI).code, 'no_bulletin');
  assert.equal(tahminKabulEdilirMi('m1', { matches: [] }, SIMDI).code, 'no_bulletin');
});

test('maç saati bilinmiyorsa reddedilir', () => {
  const bozuk = { matches: [{ sportotoMatchId: 'm1', no: 1, date: null }] };
  assert.equal(tahminKabulEdilirMi('m1', bozuk, SIMDI).code, 'no_kickoff');
});

test('maç no ile de bulunabiliyor (sportotoMatchId yoksa)', () => {
  const b = { matches: [{ no: 7, date: new Date(SIMDI + 60 * 60e3).toISOString() }] };
  assert.equal(tahminKabulEdilirMi('7', b, SIMDI).ok, true);
});

test('bir maç kapalıyken DİĞERİ açık kalır (kilit maç bazında)', () => {
  // Bülten geneli için tek kilit olsaydı, ilk maç başlayınca haftanın tamamı
  // kapanırdı; kural her maç için ayrıdır.
  const b = bulten(-30);                       // m1 başlamış, m2 10 saat sonra
  assert.equal(tahminKabulEdilirMi('m1', b, SIMDI).ok, false);
  assert.equal(tahminKabulEdilirMi('m2', b, SIMDI).ok, true);
});
