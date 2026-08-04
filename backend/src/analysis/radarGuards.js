// RADAR KORUMALARI — 1525/1526 hafta analizlerinden çıkan düzeltmeler.
// (bkz. RAPOR-1525-tutmayan-tahminler.md · RAPOR-1526-tutmayan-tahminler.md)
//
// SORUN: kupon önerisi (analysis/prediction.js) Radar Merkezi'nin ürettiği
// sinyalleri (master favorisi, favori-yatma riski, sürpriz DNA, radar yönleri)
// HİÇ okumuyordu. Bu yüzden:
//   • 1525/15. maç: kupon tekli X yazdı, master %77 "1" diyordu — motorlar
//     birbirinden habersiz ters TEKLİ üretti (master haklı çıktı).
//   • 1525/8. maç (Malmö): sürpriz DNA 44 + Oran radarı "2" derken en yüksek
//     güvenle tekli 1 yazıldı ve yattı.
//   • 1526/5 ve 1526/13: radar/uyarı sinyalleri varken tekli kaldı.
//
// ÇÖZÜM: refresh sırasında Radar Merkezi hesaplandıktan SONRA çalışan bir
// koruma katmanı. Kupon önerisini yalnız GENİŞLETİR (seçenek ekler) —
// asla daraltmaz, asla seçenek çıkarmaz, kilitli/mühürlü haftaya dokunmaz.
//
// DÜRÜSTLÜK SINIRI: bu korumalar geriye dönük iki haftada 5 yanlışın hepsini
// kurtarmazdı (X biten maçlarda ikinci ihtimal çoğu kez "2" çıkıyor); amaç
// isabet garantisi değil, sinyal varken TEK seçeneğe sıkışmamak.
//
// SÖZLEŞMELER (bozulmaz):
//   • Etiket anahtarları mevcut kümede kalır: BANKO/NET/TEMKİNLİ/ÇİFTE/AÇIK/VERİ YOK.
//   • Sembol alfabesi aynı: '1','0','2','10','02','12','102','-' ('0' = X).
//   • Dönüş şekli predict() ile aynı alanlar + guardNotes (yalnız koruma çalışırsa).

// Karar eşikleri — tek yerde, testler ve ayar için dışa açık.
export const KORUMA_ESIKLERI = {
  RISK_TEKLI_UST: 50,     // favori-yatma riski bu değerin ÜZERİNDEyse tekli kalmaz (50 dahil değil)
  SURPRIZ_TEKLI_UST: 30,  // sürpriz DNA bu değere ulaştıysa tekli kalmaz
};

const GECERLI = new Set(['1', '0', '2']);

/** '102'/'10'/'1' gibi sembolü sonuç kümesine aç ('0' = X iç gösterimde '0' kalır). */
export const acSembol = (sym) => String(sym || '')
  .split('')
  .filter((c) => GECERLI.has(c));

/** Sonuç kümesini kanonik sembole çevir: '10', '02', '12', '102' sırası korunur. */
export const paketle = (set) => ['1', '0', '2'].filter((c) => set.has(c)).join('');

/** Radar Merkezi'nin 1/X/2 favorisini iç alfabeye ('0'=X) çevir. */
const icSembol = (s) => (String(s || '').toUpperCase() === 'X' ? '0' : String(s || ''));

/** Aktif radar yönlerini iç alfabede döndür (yalnız geçerli olanlar). */
function aktifYonler(radarMatch) {
  const r = radarMatch?.radars || {};
  const out = [];
  for (const key of ['performance', 'expectation', 'publicBetting', 'market']) {
    const yon = icSembol(r[key]?.direction);
    if (GECERLI.has(yon)) out.push({ radar: key, yon });
  }
  return out;
}

/** Master skorlarından ikinci en yüksek ihtimalin sembolü (iç alfabe). */
function ikinciIhtimal(radarMatch, haric) {
  const s = radarMatch?.master?.scores || {};
  const aday = [
    { k: '1', v: Number(s.home) || 0 },
    { k: '0', v: Number(s.draw) || 0 },
    { k: '2', v: Number(s.away) || 0 },
  ].filter((x) => !haric.has(x.k)).sort((a, b) => b.v - a.v);
  return aday.length ? aday[0].k : null;
}

const SYMBOL_TR = {
  '1': 'Ev sahibi kazanır',
  '0': 'Beraberlik',
  '2': 'Deplasman kazanır',
  '10': 'Ev sahibi kaybetmez',
  '02': 'Deplasman kaybetmez',
  '12': 'Beraberlik beklenmez',
  '102': 'Üç ihtimal de açık',
};

/**
 * Kupon önerisine radar korumalarını uygular.
 * @param prediction predict() çıktısı ({symbol,meaning,label,estimated,reason})
 * @param radarMatch radarCenter.matches[i] (master + radars)
 * @param opts { isLocked } — kilitli haftada HİÇBİR ŞEY değişmez
 * @returns aynı şekilde bir tahmin nesnesi; koruma çalıştıysa guardNotes eklenir
 */
export function applyRadarGuards(prediction, radarMatch, { isLocked = false } = {}) {
  // Dokunulmayacak durumlar: kilitli hafta, veri yok, radar kaydı yok.
  if (isLocked || !prediction || !radarMatch?.master) return prediction;
  if (!prediction.symbol || prediction.symbol === '-') return prediction;

  const set = new Set(acSembol(prediction.symbol));
  if (!set.size) return prediction;

  const notlar = [];
  const master = radarMatch.master;
  const fav = icSembol(master.favorite?.symbol);
  const risk = Number(master.favoriteFailureRisk);
  const surpriz = Number(master.surpriseDnaScore);

  // 1) MOTOR ÇELİŞKİSİ: master favorisi öneri kümesinde hiç yoksa eklenir.
  //    (1525/15: kupon "0", master "1" — öneri master favorisini dışlayamaz.)
  if (GECERLI.has(fav) && !set.has(fav)) {
    set.add(fav);
    notlar.push(`radar koruması: Radar Merkezi favorisi (%${Math.round(master.favorite?.percent ?? 0)} ${fav === '0' ? 'X' : fav}) öneri dışındaydı, eklendi`);
  }

  // 2) TEKLİ KORUMALARI — yalnız hâlâ tek seçenek kaldıysa.
  if (set.size === 1) {
    const tek = [...set][0];

    // 2a) Yüksek favori-yatma riski (1526/13 Molde profili).
    if (Number.isFinite(risk) && risk > KORUMA_ESIKLERI.RISK_TEKLI_UST) {
      const ek = ikinciIhtimal(radarMatch, set);
      if (ek) {
        set.add(ek);
        notlar.push(`radar koruması: favori-yatma riski ${Math.round(risk)} — tek seçenek genişletildi`);
      }
    }

    // 2b) Yüksek sürpriz DNA (1525/8 Malmö profili).
    if (set.size === 1 && Number.isFinite(surpriz) && surpriz >= KORUMA_ESIKLERI.SURPRIZ_TEKLI_UST) {
      const ek = ikinciIhtimal(radarMatch, set);
      if (ek) {
        set.add(ek);
        notlar.push(`radar koruması: sürpriz sinyali ${Math.round(surpriz)} puan — tek seçenek genişletildi`);
      }
    }

    // 2c) Aktif bir radar ters yön gösteriyorsa o yön eklenir (1526/5 Hacken:
    //     Oran radarı "2" derken tekli 1 kalmıştı).
    if (set.size === 1) {
      const ters = aktifYonler(radarMatch).find((r) => r.yon !== tek);
      if (ters) {
        set.add(ters.yon);
        notlar.push(`radar koruması: ${ters.radar === 'market' ? 'Oran' : ters.radar === 'publicBetting' ? 'Oynanma' : ters.radar === 'performance' ? 'Rakip Gücü' : 'xG'} radarı ${ters.yon === '0' ? 'X' : ters.yon} yönünde — tek seçenek genişletildi`);
      }
    }
  }

  // Değişiklik yoksa nesneye dokunma (arşiv/karşılaştırma kararlılığı).
  if (!notlar.length) return prediction;

  const symbol = paketle(set);
  const label = set.size >= 3 ? 'AÇIK' : set.size === 2 ? 'ÇİFTE' : prediction.label;
  const reason = [prediction.reason, ...notlar].filter(Boolean).join('; ');
  return {
    ...prediction,
    symbol,
    meaning: SYMBOL_TR[symbol] || prediction.meaning,
    label,
    reason,
    guardNotes: notlar,
  };
}

/**
 * Bülten sonucuna toplu uygulama: result.matches[i].prediction, radarCenter
 * kayıtlarıyla (maç no eşleşmesi) korunur. Kilitliyse hiçbir şey yapılmaz.
 */
export function applyRadarGuardsToBulletin(result, { isLocked = false } = {}) {
  if (isLocked) return 0;
  const rcMatches = result?.radarCenter?.matches;
  if (!Array.isArray(rcMatches) || !Array.isArray(result?.matches)) return 0;
  const byNo = new Map(rcMatches.map((m) => [Number(m.no), m]));
  let degisen = 0;
  for (const m of result.matches) {
    if (!m?.prediction) continue;
    const rc = byNo.get(Number(m.no));
    if (!rc) continue;
    const yeni = applyRadarGuards(m.prediction, rc, { isLocked });
    if (yeni !== m.prediction) { m.prediction = yeni; degisen += 1; }
  }
  return degisen;
}
