// PREMIUM SINIRLARI + KOD MANTIĞI — saf modüllerin testi.
// Veritabanı gerekmez: kurallar burada, sonuçları burada doğrulanır.
import test from 'node:test';
import assert from 'node:assert/strict';

import { OZELLIKLER, SINIRLAR, sinirlar, erisim, kilitMetni } from '../src/premiumLimits.js';
import {
  kodNormalize, kodUret, kodGecerliMi, premiumDurumu, etkinEngel, bitisHesapla,
} from '../src/premiumBan.js';

// ═══════════════════ SINIRLAR ═══════════════════

test('premium her özelliğe erişir', () => {
  for (const o of Object.values(OZELLIKLER)) {
    assert.equal(erisim(o, true, { radarNo: 5, haftaGeriSayi: 99, kriterSayisi: 40 }).izin, true, o);
  }
});

test('ücretsiz: Radar 1 açık, 2 ve üstü kilitli', () => {
  assert.equal(erisim(OZELLIKLER.RADAR_ILERI, false, { radarNo: 1 }).izin, true);
  for (const no of [2, 3, 4, 5]) {
    const r = erisim(OZELLIKLER.RADAR_ILERI, false, { radarNo: no });
    assert.equal(r.izin, false, `Radar ${no} açık kalmış`);
    assert.equal(r.sinir, SINIRLAR.ucretsiz.radar);
  }
});

test('ücretsiz: son 4 hafta açık, 5. hafta geriye kilitli', () => {
  for (const geri of [0, 1, 2, 3]) {
    assert.equal(erisim(OZELLIKLER.GECMIS_DERIN, false, { haftaGeriSayi: geri }).izin, true, String(geri));
  }
  assert.equal(erisim(OZELLIKLER.GECMIS_DERIN, false, { haftaGeriSayi: 4 }).izin, false);
});

test('ücretsiz: 8 kriter sınırı — sınır DAHİL', () => {
  assert.equal(erisim(OZELLIKLER.KRITER_TAM, false, { kriterSayisi: 8 }).izin, true);
  assert.equal(erisim(OZELLIKLER.KRITER_TAM, false, { kriterSayisi: 9 }).izin, false);
});

test('ücretsiz: 3 kupon varken YENİSİ açılamaz', () => {
  assert.equal(erisim(OZELLIKLER.KUPON_COK, false, { kuponSayisi: 2 }).izin, true);
  assert.equal(erisim(OZELLIKLER.KUPON_COK, false, { kuponSayisi: 3 }).izin, false);
});

test('BİLİNMEYEN özellik ve eksik bağlam SERBEST kalır', () => {
  // Ters tasarım (bilinmeyeni kilitle) yeni bir ekranı sessizce kapatırdı.
  assert.equal(erisim('yeni-ekran', false).izin, true);
  assert.equal(erisim(OZELLIKLER.RADAR_ILERI, false, {}).izin, true);
  assert.equal(erisim(OZELLIKLER.GECMIS_DERIN, false, {}).izin, true);
});

test('sınır kümesi ücretsizde sonlu, premiumda sonsuz', () => {
  assert.equal(Number.isFinite(sinirlar(false).gecmisHafta), true);
  assert.equal(sinirlar(true).gecmisHafta, Infinity);
});

test('kilit metni her sebep için insan diliyle var', () => {
  for (const s of ['radar', 'gecmis', 'kriter', 'kupon', 'karne', 'bilinmeyen']) {
    const m = kilitMetni(s);
    assert.ok(typeof m === 'string' && m.length > 10, s);
  }
});

// ═══════════════════ KOD MANTIĞI ═══════════════════

test('kod normalize: büyük harf, tire/boşluk atılır', () => {
  assert.equal(kodNormalize(' a7k2-m9p4 '), 'A7K2M9P4');
  assert.equal(kodNormalize('abc.def'), 'ABCDEF');
  assert.equal(kodNormalize(null), '');
});

test('üretilen kodda KARIŞAN harf yok (0 O 1 I L)', () => {
  for (let i = 0; i < 200; i += 1) {
    const k = kodUret(12);
    assert.equal(k.length, 12);
    assert.doesNotMatch(k, /[01OIL]/, `karışan karakter üretildi: ${k}`);
  }
});

test('kod geçerliliği: iptal, süre, kullanım sınırı', () => {
  const temel = { code: 'X', grants_days: 30, max_uses: 2, revoked_at: null, expires_at: null };
  assert.equal(kodGecerliMi(temel, 0).ok, true);
  assert.equal(kodGecerliMi(temel, 2).ok, false, 'kullanım dolmuşken geçerli sayıldı');
  assert.equal(kodGecerliMi({ ...temel, revoked_at: new Date().toISOString() }, 0).ok, false);
  assert.equal(kodGecerliMi({ ...temel, expires_at: '2000-01-01T00:00:00Z' }, 0).ok, false);
  assert.equal(kodGecerliMi(null, 0).ok, false, 'olmayan kod geçerli sayıldı');
});

test('premium durumu: iptal edilen ve süresi geçen hak SAYILMAZ', () => {
  const gecmis = new Date(Date.now() - 86400000).toISOString();
  const gelecek = new Date(Date.now() + 86400000).toISOString();
  assert.equal(premiumDurumu([]).premium, false);
  assert.equal(premiumDurumu([{ expires_at: gecmis }]).premium, false);
  assert.equal(premiumDurumu([{ expires_at: gelecek, revoked_at: gecmis }]).premium, false);
  assert.equal(premiumDurumu([{ expires_at: gelecek }]).premium, true);
});

test('premium durumu: süresiz hak her zaman kazanır', () => {
  const yakin = new Date(Date.now() + 3600000).toISOString();
  const d = premiumDurumu([{ expires_at: yakin }, { expires_at: null }]);
  assert.equal(d.premium, true);
  assert.equal(d.suresiz, true);
  assert.equal(d.bitis, null, 'süresizken bitiş tarihi yazılmamalı');
});

test('premium durumu: en GEÇ biten hak kazanır', () => {
  const a = new Date(Date.now() + 86400000).toISOString();
  const b = new Date(Date.now() + 10 * 86400000).toISOString();
  assert.equal(premiumDurumu([{ expires_at: a }, { expires_at: b }]).bitis, b);
});

test('etkin engel: kaldırılmış ve süresi dolmuş engel SAYILMAZ', () => {
  const gecmis = new Date(Date.now() - 1000).toISOString();
  const gelecek = new Date(Date.now() + 86400000).toISOString();
  assert.equal(etkinEngel([]), null);
  assert.equal(etkinEngel([{ lifted_at: gecmis }]), null);
  assert.equal(etkinEngel([{ until: gecmis }]), null);
  assert.ok(etkinEngel([{ until: gelecek }]), 'süresi dolmamış engel görülmedi');
  assert.ok(etkinEngel([{ until: null }]), 'süresiz engel görülmedi');
});

test('bitiş hesabı: 0 veya negatif gün SÜRESİZ demektir', () => {
  assert.equal(bitisHesapla(0), null);
  assert.equal(bitisHesapla(-5), null);
  const b = bitisHesapla(30);
  assert.ok(new Date(b).getTime() > Date.now() + 29 * 86400000);
});
