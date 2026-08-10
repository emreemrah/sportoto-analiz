// RADAR 5 FİLTRE YÜKLEMLERİ — oynanma/oran YAKINLIK karşılaştırması (saf).
//
// AMAÇ: "Güncel haftanın aynı sırasındaki maça oynanma/oran olarak yakın
// geçmiş maçlar" süzgeci. HER SATIR KENDİ MAÇINA BAKAR: 1. sıra güncel
// 1. sıranın değerine, 6. sıra kendi maçınınkine göre süzülür — tek bir
// "hafta değeri" YOKTUR (kullanıcı kararı, 2026-08-08).
//
// KURALLAR (playedDna.js ile aynı ilkeler):
//  • Yakınlık KULLANICI SEÇİMİDİR; otomatik genişleme yok.
//  • Üç değer birden tolerans içinde olmalı — yalnız favoriye bakmak
//    yanıltıcı olurdu (isSimilarDistribution gerekçesi).
//  • Değeri BİLİNMEYEN maç filtreli modda EŞLEŞMEZ ve sayısı açıkça
//    raporlanır; eksik veriyle yüzde uydurulmaz.
//
// Saf modül: ağ/veritabanı yok. Gün-mühürleme TANIMI burada yeniden
// yazılmaz — girdi, dailyOdds.js motorunun (buildDailyPlayed/buildDailyOdds)
// çıktısıdır; iki ayrı mühür tanımı olamaz.
import { yuzdeye } from './siraOynanma.js';

// Oynanma yakınlık adımları YÜZDE PUANIDIR; 0 = birebir (kullanıcı kararı,
// 2026-08-08: birebir / ±3 / ±5 / ±10). Oran adımları ONDALIK ORAN FARKIDIR
// ve DARDIR: birebir / ±0.02 / ±0.03 (kullanıcı kararı, 2026-08-10 — önceki
// ±0.10/±0.25/±0.50 adımları "aynı maç" aramak için fazla genişti).
export const OYNANMA_TOLERANSLARI = [0, 3, 5, 10];
export const ORAN_TOLERANSLARI = [0, 0.02, 0.03];

const PCT_ANAHTARLAR = ['1', 'X', '2'];
const ORAN_ANAHTARLAR = ['home', 'draw', 'away'];
const sayi = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Kayan nokta payı: 1.85 − 1.75 ikilik tabanda 0.10000000000000009 çıkar;
// paysız karşılaştırma tam sınırdaki maçı sessizce dışarıda bırakırdı.
const PAY = 1e-9;

function hepsiYakin(a, b, anahtarlar, tol) {
  if (!a || !b) return false;
  for (const k of anahtarlar) {
    const x = sayi(a[k]);
    const y = sayi(b[k]);
    if (x == null || y == null) return false;
    if (Math.abs(x - y) > tol + PAY) return false;
  }
  return true;
}

export const oynanmaYakin = (a, b, tol) => hepsiYakin(a, b, PCT_ANAHTARLAR, tol);
export const oranYakin = (a, b, tol) => hepsiYakin(a, b, ORAN_ANAHTARLAR, tol);

// Gün-mühürlü seri görünümünden sıra → SON kayıtlı günün değeri.
//
// Günler görünümde Pazar→Cuma(→Cmt) sıralı gelir; "son" = değer taşıyan en
// ileri gün. Motor taşıma yapmadığı için dolu her hücre kendi gününün gerçek
// kaydıdır. Oynanmada değer, arşivle AYNI ölçeğe çekilir (yuzdeye: 0-100 ya
// da 0-1 kayıtları tek ölçekte buluşturur) — ölçek uyuşmazsa yakınlık
// karşılaştırması sessizce her şeyi elerdi. Geçersiz/ölçeksiz gün atlanır ve
// bir önceki dolu güne bakılır; değer UYDURULMAZ.
export function sonGunDegerleri(gorunum, { metric = 'played', source = 'nesine' } = {}) {
  const cikti = new Map();
  const gunler = (gorunum?.days || []).map((d) => d.date);
  for (const m of gorunum?.matches || []) {
    if (m?.no == null) continue;
    for (let i = gunler.length - 1; i >= 0; i -= 1) {
      const hucre = m.cells?.[gunler[i]];
      if (!hucre) continue;
      const ham = metric === 'played' ? hucre.bySource?.[source]?.percentages : hucre.odds;
      const deger = metric === 'played' ? yuzdeye(ham) : ham;
      if (!deger) continue;
      cikti.set(Number(m.no), { gun: gunler[i], deger });
      break;
    }
  }
  return cikti;
}
