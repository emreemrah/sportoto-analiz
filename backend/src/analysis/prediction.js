// KUPON TAHMİN MOTORU
// Girdi: surprise.js çıktısı (ihtimaller, sürpriz puanı, unsurlar) + enrich.js
//        istatistikleri (puan durumu, iç/dış saha formu, H2H, gol beklentisi).
// Çıktı: her maça 1/0/2/10/02/12/102 ve bir güven etiketi.
//
// ————————————————————————————————————————————————————————————————
// BU DOSYA NEDEN YENİDEN YAZILDI (kullanıcı bildirimi: "çok saçma tahminler
// yapıyor daha mantıklı tahminler olması lazım"). 1526. hafta verisi üzerinde
// kanıtlanmış ÜÇ kusur vardı:
//
// 1) OLMAYAN VERİ, DELİL SAYILIYORDU.
//    Eski `ppgOf`, `Math.max(1, oynanan)` kullandığı için hiç maç oynamamış bir
//    0-0-0 kaydına 0 puan üretiyordu. 0 ≤ 0.9 olduğu için "ev sahibi iç sahada
//    zayıf" (−8), 0 ≤ 0.8 olduğu için "deplasman dış sahada zayıf" (−8) tetikleniyordu.
//    Aynı şekilde boş `potentials.over25` alanı 0 geldiği için `over25 <= 35`
//    doğru çıkıyor ve "az gollü beklenti" (+6) ekleniyordu. 1526/2. maçta yazılan
//    gerekçenin TAMAMI — 22 puanlık oynama — hiç veri olmadan uydurulmuştu.
//    Proje kuralı: "Veri yoksa ... Olmayan veriyi varmış gibi gösterme."
//    ÇÖZÜM: ölçüm yoksa null döner, hiçbir kural tetiklenmez.
//
// 2) SEÇİM, FAVORİNİN MUTLAK GÜCÜNE HİÇ BAKMIYORDU.
//    Karar yalnız `lead = birinci − ikinci` farkına bakıyordu. Bu yüzden
//    44/25/31 gibi bir dağılımda (favori %44, yani maçların yarısından azını
//    kazanır) tek başına "1" yazılıyor ve üstüne "NET" etiketi konuyordu —
//    üstelik aynı maçın analiz unsurları harfiyen "Net bir favori yok" ve
//    "İhtimaller çok yakın (çekişmeli)" diyorken. Kart kendi kendisiyle
//    çelişiyordu. ÇÖZÜM: tek seçim için favorinin kendi yüzdesi bir tabanı
//    geçmeli; analiz "sürprize açık" ya da "net favori yok" diyorsa tek seçim
//    yazılmaz, kupon genişletilir.
//
// 3) ORAN HİÇ YOKKEN BİLE EN YÜKSEK GÜVEN VERİLEBİLİYORDU.
//    `estimated` (oran yok, ihtimaller formdan/xG'den çıkarıldı) yalnız gerekçe
//    metnine "oran yok, tahmini" eklemekle kalıyordu; etiketi düşürmüyordu.
//    1526/7. maç oransız olduğu hâlde 'BANKO' etiketi aldı.
//    Proje kuralı: "Veri yoksa ... risk/güven seviyesini düşür."
//    ÇÖZÜM: oran yoksa eşik yükselir ve etiket en fazla TEMKİNLİ olur.
//
// AYRICA: enrichSurprise()'ın ürettiği üç unsur ("Son maç formunda rakip önde",
// "Saha performansı favoriyi desteklemiyor", "Favorinin savunması gol yemeye
// açık") hesaplanıyor ama predict() tarafından hiç okunmuyordu; artık okunuyor.
//
// DEĞİŞMEYEN SÖZLEŞME: etiket ANAHTARLARI (BANKO/NET/TEMKİNLİ/ÇİFTE/AÇIK/
// VERİ YOK) aynen korunur — arşiv, karne ve geçmiş kayıtlar bu anahtarlara
// bağlıdır (bkz. app/src/labels.js). Yalnız hangi koşulda hangi anahtarın
// verildiği değişti. Dönüş şekli de aynı: { symbol, meaning, label, estimated, reason }.
// ————————————————————————————————————————————————————————————————

/**
 * Bir iç/dış saha kaydından maç başına puan (form göstergesi).
 * Hiç maç oynanmamışsa **null** döner — "veri yok" ile "kötü form" ayrı şeylerdir.
 */
const ppgOf = (r) => {
  if (!r) return null;
  const oynanan = (r.wins || 0) + (r.draws || 0) + (r.losses || 0);
  if (!oynanan) return null; // 0 DÖNMEZ: veri yokluğu zayıflık delili değildir
  return ((r.wins || 0) * 3 + (r.draws || 0)) / oynanan;
};

/** Yüzde/oran alanları için güvenli okuma: yok/0/geçersiz ise null (delil sayılmaz). */
const olcum = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);

// Karar eşikleri tek yerde — testler ve ileride ayar için dışa açık.
export const ESIKLER = {
  TEK_ALT: 50,          // tek seçim için favorinin en az yüzdesi (oran varken)
  TEK_ALT_TAHMINI: 56,  // oran yokken (estimated) daha yüksek taban istenir
  TEK_FARK: 12,         // birinci ile ikinci arasında en az fark
  CIFT_ALT: 70,         // çifte şans için ilk iki ihtimalin toplamı en az
  DUZ_YAYILIM: 12,      // birinci ile sonuncu bu kadar yakınsa üç ihtimal de açık
  GUCLU_ALT: 60,        // "güçlü aday" için favorinin en az yüzdesi
  GUCLU_FARK: 30,       // "güçlü aday" için en az fark
  GUCLU_SURPRIZ: 25,    // "güçlü aday" için sürpriz puanı bunun altında olmalı
  NET_ALT: 55,          // NET etiketi için favorinin en az yüzdesi
};

const SYMBOL_TR = {
  '1': 'Ev sahibi kazanır',
  '0': 'Beraberlik',
  '2': 'Deplasman kazanır',
  '10': 'Ev sahibi kaybetmez',
  '02': 'Deplasman kaybetmez',
  '12': 'Beraberlik beklenmez',
  '102': 'Üç ihtimal de açık',
  '-': 'Veri yok',
};

export function predict(m) {
  const a = (m && m.analysis) || {};
  const s = (m && m.stats) || {};
  if (!a.probabilities) {
    return { symbol: '-', meaning: SYMBOL_TR['-'], label: 'VERİ YOK', estimated: false, reason: 'Yeterli veri yok' };
  }

  const tahmini = !!a.estimated; // oran yok, ihtimaller formdan çıkarıldı
  let sc1 = Number(a.probabilities['1']) || 0;
  let sc0 = Number(a.probabilities.X) || 0;
  let sc2 = Number(a.probabilities['2']) || 0;

  const reasons = [];
  const bump = (cond, side, pts, txt) => {
    if (!cond) return;
    if (side === 1) sc1 += pts; else if (side === 0) sc0 += pts; else sc2 += pts;
    if (txt) reasons.push(txt);
  };

  // 1) İç / dış saha formu — yalnız GERÇEKTEN oynanmış maç varsa
  const homePpg = ppgOf(s.home?.standing?.home);
  const awayPpg = ppgOf(s.away?.standing?.away);
  bump(homePpg != null && homePpg >= 2.0, 1, 8, 'ev sahibi iç sahada çok güçlü');
  bump(homePpg != null && homePpg <= 0.9, 1, -8, 'ev sahibi iç sahada zayıf');
  bump(awayPpg != null && awayPpg >= 1.8, 2, 8, 'deplasman dış sahada güçlü');
  bump(awayPpg != null && awayPpg <= 0.8, 2, -8, 'deplasman dış sahada zayıf');

  // 2) Karşılıklı geçmiş — H2H
  const h = s.h2h;
  if (h && h.played >= 5) {
    const dom = ((h.homeWins || 0) - (h.awayWins || 0)) / h.played;
    bump(dom >= 0.22, 1, 6, 'geçmiş karşılaşmalar ev sahibi lehine');
    bump(dom <= -0.22, 2, 6, 'geçmiş karşılaşmalar deplasman lehine');
    bump((h.draws || 0) / h.played >= 0.30, 0, 6, 'geçmişte sık beraberlik');
  }

  // 3) Beraberlik riski — over25 ölçümü YOKSA hiçbir şey çıkarılmaz
  const over25 = olcum(s.potentials?.over25);
  bump(over25 != null && over25 <= 35, 0, 6, 'az gollü beklenti');
  const hr = s.home?.standing?.home;
  const hrOynanan = hr ? (hr.wins || 0) + (hr.draws || 0) + (hr.losses || 0) : 0;
  bump(hrOynanan > 0 && hr.draws >= 4 && hr.draws >= hr.wins + hr.losses, 0, 6, 'ev sahibi iç sahada sürekli berabere');

  // 4) Sürpriz unsurları — surprise.js + enrichSurprise faktörleri
  const fav = a.favorite?.symbol; // '1' | 'X' | '2'
  const favSide = fav === '1' ? 1 : fav === '2' ? 2 : 0;
  const oppSide = favSide === 1 ? 2 : favSide === 2 ? 1 : 0;
  const has = (t) => (a.factors || []).some((f) => String(f?.label || '').includes(t));
  bump(has('Favori son dönemde formsuz') && favSide !== 0, favSide, -6, 'favori formsuz');
  bump(has('Rakip son dönemde daha formda') && oppSide !== 0, oppSide, 6, 'rakip daha formda');
  bump(has('xG') && favSide !== 0, favSide, -4, 'beklenen gol favoriyi öne çıkarmıyor');
  bump(has('Beraberlik ihtimali yüksek'), 0, 6, 'beraberlik ihtimali yüksek');
  bump(has('İç/dış saha formu çok yakın') || has('İhtimaller çok yakın'), 0, 3, 'güçler çok yakın');
  // enrichSurprise'ın "kader kriterleri" — daha önce hesaplanıp okunmuyordu
  bump(has('Son maç formunda rakip önde') && favSide !== 0, favSide, -5, 'son maçlarda rakip daha iyi');
  bump(has('Saha performansı favoriyi desteklemiyor') && favSide !== 0, favSide, -5, 'saha performansı favoriyi desteklemiyor');
  bump(has('savunması gol yemeye açık') && favSide !== 0, favSide, -4, 'favorinin savunması kırılgan');

  // --- Puanları yeniden yüzdeye çevir ---
  // Oynamalardan sonra toplam 100 olmaktan çıkar. Eşikler "favorinin yüzdesi"
  // olarak konuşulduğu için karşılaştırmadan ÖNCE normalleştirilir; yoksa eşikler
  // maçtan maça farklı anlama gelir.
  const ham = [Math.max(0, sc1), Math.max(0, sc0), Math.max(0, sc2)];
  const toplam = ham[0] + ham[1] + ham[2];
  const yuzde = toplam > 0 ? ham.map((x) => (x * 100) / toplam) : [100 / 3, 100 / 3, 100 / 3];

  const arr = [{ k: '1', v: yuzde[0] }, { k: '0', v: yuzde[1] }, { k: '2', v: yuzde[2] }]
    .sort((x, y) => y.v - x.v);
  const [top, mid, low] = arr;
  const lead = top.v - mid.v;    // birinci ile ikinci arası fark
  const spread = top.v - low.v;  // birinci ile sonuncu arası fark
  const surprise = a.surpriseScore ?? 50;
  const r0 = (x) => Math.round(x);

  const doubleOf = (x, y) => {
    const set = new Set([x, y]);
    if (set.has('1') && set.has('0')) return '10';
    if (set.has('0') && set.has('2')) return '02';
    return '12';
  };

  // --- Tek seçim yazmaya ENGEL olan sebepler ---
  // Bir tanesi bile varsa tek işaret yazılmaz; kupon genişletilir ve SEBEBİ yazılır.
  const tekAlt = tahmini ? ESIKLER.TEK_ALT_TAHMINI : ESIKLER.TEK_ALT;
  const engeller = [];
  if (top.v < tekAlt) engeller.push(`favori %${r0(top.v)} — tek seçim için gereken %${tekAlt} eşiğinin altında`);
  if (lead < ESIKLER.TEK_FARK) engeller.push(`ilk iki ihtimal arası fark yalnız ${r0(lead)} puan`);
  if (a.label === 'SÜRPRİZE AÇIK') engeller.push('analiz bu maçı sürprize açık buluyor');
  if (has('Net bir favori yok')) engeller.push('net bir favori yok');

  let symbol; let label; let kararSebebi;

  if (spread <= ESIKLER.DUZ_YAYILIM) {
    symbol = '102';
    label = 'AÇIK';
    kararSebebi = `üç ihtimal de birbirine yakın (%${r0(top.v)}/%${r0(mid.v)}/%${r0(low.v)})`;
  } else if (!engeller.length) {
    symbol = top.k;
    if (!tahmini && top.v >= ESIKLER.GUCLU_ALT && lead >= ESIKLER.GUCLU_FARK && surprise < ESIKLER.GUCLU_SURPRIZ) {
      label = 'BANKO'; // ekranda "GÜÇLÜ ADAY" yazar (app/src/labels.js)
      kararSebebi = `favori %${r0(top.v)}, fark ${r0(lead)} puan, sürpriz sinyali düşük`;
    } else if (!tahmini && top.v >= ESIKLER.NET_ALT) {
      label = 'NET';
      kararSebebi = `favori %${r0(top.v)}, fark ${r0(lead)} puan`;
    } else {
      label = 'TEMKİNLİ';
      kararSebebi = tahmini
        ? `oran yok; ihtimaller form/gol verisinden çıkarıldı, güven düşürüldü (favori %${r0(top.v)})`
        : `favori %${r0(top.v)} — tek seçim yazıldı ama üstünlük sınırlı`;
    }
  } else if (top.v + mid.v >= ESIKLER.CIFT_ALT) {
    symbol = doubleOf(top.k, mid.k);
    label = 'ÇİFTE';
    kararSebebi = `${engeller[0]}; ilk iki ihtimal birlikte %${r0(top.v + mid.v)}`;
  } else {
    symbol = '102';
    label = 'AÇIK';
    kararSebebi = `${engeller[0]}; ilk iki ihtimal birlikte %${r0(top.v + mid.v)}, üç ihtimal de açık bırakıldı`;
  }

  // Gerekçe KARARI VEREN kuralla başlar, sonra destekleyici gözlemler gelir.
  const gerekce = [kararSebebi, ...reasons];
  if (tahmini && label !== 'TEMKİNLİ') gerekce.push('oran yok, ihtimaller tahmini');

  return {
    symbol,
    meaning: SYMBOL_TR[symbol] || '',
    label,
    estimated: tahmini,
    reason: gerekce.slice(0, 3).join('; ') || 'oranlara göre',
  };
}
