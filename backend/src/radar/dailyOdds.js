// RADAR 4 — GÜNLÜK ORAN TAKİBİ (mühürlü)
// Bahis sitelerindeki GERÇEK 1/X/2 oranlarının GÜN GÜN hareketini üretir.
// Kaynak: arşivdeki DEĞİŞMEZ (append-only) oran gözlemleri (m.preOdds serisi).
//
// KURALLAR (kullanıcı isteği):
//  * Gün filtreleri: Pazar → Cuma (Cumartesi hariç). Pencere, ilk maça en yakın
//    Cuma'yı çıpa alıp geriye 6 gün (Pazar..Cuma) olarak kurulur.
//  * Her günün mührü = o günün 23:55 (Europe/Istanbul) VEYA maç günü ilk maç
//    −5 dk (hangisi önceyse) itibarıyla O GÜN gerçekten alınmış SON oran gözlemi.
//  * O güne ait gözlem yoksa GERİYE DÖNÜK oran ÜRETİLMEZ → hücre boş
//    ("Bu gün için oran kaydı yok"). Önceki günün oranı taşınmaz.
//  * Gözlemler değişmez olduğundan mühür de sonradan değişmez.
//  * Yüzde değil, GERÇEK ORAN gösterilir (Radar 3 = oynanma yüzdesi; ayrıdır).
//
// ÇOK KAYNAK (birincil + ikinci oran kaynağı):
//  * Her hücre, O GÜN gözlem yazmış HER kaynağın kendi mührünü `bySource`
//    altında AYRI tutar. Kaynaklar ORTALANMAZ/HARMANLANMAZ — biri 2.10, diğeri
//    2.30 diyorsa ikisi de öyle gösterilir; "tek doğru" uydurulmaz.
//  * Hücrenin üst düzey `odds` alanı GERİYE UYUMLULUK içindir ve BİRİNCİL
//    kaynağı gösterir; birincil o gün susmuşsa sıradaki kaynağa düşer ve
//    `source` alanı hangisi olduğunu AÇIKÇA söyler (sessiz karışma yok).
//  * Kaynak eklenmesi eski kuralı DEĞİŞTİRMEZ: bir kaynağın o güne ait gözlemi
//    yoksa o kaynak için o gün BOŞTUR; önceki günden taşınmaz.
//
// EKSİK ORANIN SEBEBİ (proje kuralı: "Veri yoksa 'Bu veri bulunamadı' yaz"):
// Boş hücre tek başına yalan söylemez ama HİÇBİR ŞEY de anlatmaz. Aynı boşluğun
// arkasında yapısal olarak FARKLI sebepler vardır ve kullanıcı için anlamları
// da farklıdır:
//   • maç kaynak kapsamı dışında (eşleşmedi)  → bu hafta oran GELMEYECEK,
//   • kaynak henüz oranı yayınlamadı          → maça gün var, GELEBİLİR,
//   • o gün mühür alınamadı                   → veri toplama boşluğu,
//   • gün henüz gelmedi / kilit sonrası       → yapısal olarak zaten olamaz.
// Bu yüzden her hücre kendi gerekçesini taşır (`notes`), her maç da kendi genel
// gerekçesini (`absence`). SEBEP YAZILIR — ORAN UYDURULMAZ, TAŞINMAZ.
//
// Saf/deterministik: ağ çağrısı yok — test edilebilir.
// (oddsSources.js de saf yaprak modüldür: yalnız kimlik + nötr etiket.)
import { LEGACY_ODDS_SOURCE, oddsSourceLabel, sortOddsSources } from '../providers/oddsSources.js';

// Türkiye 2016'dan beri kalıcı UTC+3 (yaz saati YOK) — sabit ofset güvenli.
import { TR_OFFSET_MS, dayKeyOf, istanbulTimeToUtcMs } from '../time/turkiyeSaati.js';
const WEEKDAY_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const MS_DAY = 86400e3;

// 23:55 MÜHÜR SINIRINA PAY. Günlük mühür turu tam 23:55te koşar ve kendi
// gözlemini saniyeler sonra yazar; katı sınır o gözlemi atıyordu. Aynı sabit
// playedDnaArchive.js içinde de var (SEAL_GRACE_MS) — iki yol aynı kuralda.
const SEAL_GRACE_MS = 60e3;

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const validOdds = (o) => o && num(o.home) > 1 && num(o.draw) > 1 && num(o.away) > 1;
// Oynanma yüzdesi geçerliliği: '1'/'X'/'2' mevcut, negatif değil, toplam ~100.
const validPct = (p) => {
  if (!p) return false;
  const a = num(p['1']), b = num(p.X), c = num(p['2']);
  if (a == null || b == null || c == null || a < 0 || b < 0 || c < 0) return false;
  const s = a + b + c;
  return s >= 80 && s <= 120;   // toplam ~100 dışındaki junk reddedilir
};

// UTC ms → İstanbul sivil tarih parçaları (weekday: 0=Pazar..6=Cumartesi).
function istanbulParts(ms) {
  const d = new Date(ms + TR_OFFSET_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, day: d.getUTCDate(), weekday: d.getUTCDay() };
}
// UTC ms → İstanbul saat etiketi ('21:29'), gün farklıysa tarihli ('01.08 21:29').
//
// NEDEN BURADA: çeviri sunucuda yapılır, cihazda değil. Kullanıcının telefonu
// başka bir saat diliminde ya da saati yanlışsa, "son güncelleme" saatini
// yanlış görürdü — ve bu sayı verinin GÜVENİLİRLİĞİNİ anlatan bir bilgidir.
function istanbulSaat(ms) {
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms + TR_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
// UTC ms → İstanbul gün anahtarı ('2026-07-19').
function addDaysKey(dayKey, delta) {
  const [y, m, d] = dayKey.split('-').map(Number);
  const nd = new Date(Date.UTC(y, m - 1, d) + delta * MS_DAY);
  return `${nd.getUTCFullYear()}-${String(nd.getUTCMonth() + 1).padStart(2, '0')}-${String(nd.getUTCDate()).padStart(2, '0')}`;
}

// Takip penceresi (Pazar→Cuma, gerekiyorsa Cumartesi de).
//
// Çıpa: ilk maça (İstanbul) en yakın <= Cuma. Pencere o Cuma'dan geriye
// 6 gün, yani Pazar..Cuma.
//
// CUMARTESİ (kullanıcı bildirimi, 2026-08-07): "nadir de olsa Cuma günü maç
// olmadığında kapanış Cumartesi'ye kayıyor." O haftalarda son gün Cuma değil
// Cumartesi'dir ve pencere Cuma'da bitince kapanış günü EKRANDA HİÇ GÖRÜNMEZ
// — veri arşivde durur ama kimse göremez.
//
// KURAL: çıpa Cuma'sının ertesi Cumartesi'si, İLK MAÇ GÜNÜNÜ GEÇMİYORSA
// pencereye eklenir. Böylece:
//   • İlk maç Cumartesi/Pazar ise → Pazar..Cumartesi (7 gün), kapanış görünür.
//   • İlk maç Cuma ise            → Pazar..Cuma (6 gün), değişiklik yok.
// Maçtan SONRAKİ gün asla eklenmez; takip ilk maçta biter.
export function buildDayWindow({ firstKickoffMs = null, now = Date.now() } = {}) {
  const anchorMs = firstKickoffMs || now;
  const wd = istanbulParts(anchorMs).weekday;   // 0..6
  const back = (wd - 5 + 7) % 7;                 // Cuma=5 → 0, Cmt=6 → 1, Paz=0 → 2 ...
  const ilkMacGunu = dayKeyOf(anchorMs);
  const anchorFriday = addDaysKey(ilkMacGunu, -back);
  const days = [];
  for (let i = 5; i >= 0; i--) days.push(addDaysKey(anchorFriday, -i)); // Pazar..Cuma

  // Gün anahtarı 'YYYY-MM-DD' olduğu için metin karşılaştırması tarih
  // sırasıyla aynıdır — ayrı bir tarih ayrıştırmaya gerek yok.
  const cumartesi = addDaysKey(anchorFriday, 1);
  if (cumartesi <= ilkMacGunu) days.push(cumartesi);

  return days;
}

// Metrik tanımları — ikisi de AYNI gün-mühürleme mantığını kullanır:
//  odds   → Radar 4: gerçek 1/X/2 oranı  (cells[date] = { odds:{home,draw,away} })
//  played → Radar 3: oynanma yüzdesi     (cells[date] = { percentages:{'1','X','2'} })
const METRICS = {
  odds: {
    cellKey: 'odds',
    // Gün-sınırlı ÇOK KAYNAK: her kaynak o günün penceresinde AYRI mühürlenir.
    // Taşıma YASAKTIR (bkz. başlıktaki kural). perSource (Radar 3) da artık
    // taşımıyor — iki metrik aynı kuralda; fark yalnız kaynakların gösterimi.
    multiSource: true,
    extract: (o) => (validOdds(o?.odds)
      ? { home: num(o.odds.home), draw: num(o.odds.draw), away: num(o.odds.away) } : null),
  },
  played: {
    cellKey: 'percentages',
    perSource: true,   // her sağlayıcı AYRI gösterilir (ortalanmaz)
    extract: (o) => (validPct(o?.playedPct)
      ? { '1': num(o.playedPct['1']), X: num(o.playedPct.X), '2': num(o.playedPct['2']) } : null),
  },
};

// --- EKSİK VERİNİN GEREKÇESİ -------------------------------------------------
// Metrik adı (kullanıcıya görünen): Radar 4 "Oran", Radar 3 "Oynanma yüzdesi".
const metricAd = (metric) => (metric === 'played' ? 'Oynanma yüzdesi' : 'Oran');

// İki UTC anı arasındaki TAKVİM günü farkı (İstanbul). "maça 6 gün var"
// derken insan takvim gününü kastediyor; saat farkını değil.
function takvimGunFarki(fromMs, toMs) {
  const a = istanbulTimeToUtcMs(dayKeyOf(fromMs), 12, 0);
  const b = istanbulTimeToUtcMs(dayKeyOf(toMs), 12, 0);
  return Math.round((b - a) / MS_DAY);
}
const kalanSure = (gun) => (gun <= 0 ? 'maç bugün' : gun === 1 ? 'maça 1 gün var' : `maça ${gun} gün var`);

// Maçın TÜM haftada hiç verisi yoksa sebebi. Sadece BİLİNEN gerçeklerden
// üretilir; bilinmiyorsa "bilinmiyor" denir — tahmin edilmez.
//   coverage: { ok, reason, code } | null   (null = bilinmiyor, ör. arşiv haftası)
function eksikSebebi({ coverage, kickoffMs, now, metric }) {
  const ad = metricAd(metric);
  // 1) Kaynak kapsamı DIŞINDA. Bu yalnız ORAN için geçerlidir: oran kaynağı
  //    maç eşleşmesine bağlıdır. Oynanma yüzdesi AYRI sağlayıcılardan gelir,
  //    onun eksikliği kapsamla açıklanamaz (yanlış sebep yazmak da uydurmaktır).
  if (metric !== 'played' && coverage && coverage.ok === false) {
    return {
      code: 'out_of_coverage',
      text: `Bu maç ${ad.toLowerCase()} kapsamı dışında`,
      detail: coverage.reason || null,
      willArrive: false,
    };
  }
  const gun = kickoffMs != null ? takvimGunFarki(now, kickoffMs) : null;
  const gelecek = kickoffMs != null && kickoffMs > now;
  // 2) Kapsam İÇİNDE ama kaynak henüz yayınlamamış → gelebilir, süre yazılır.
  if (gelecek && coverage && coverage.ok === true) {
    return { code: 'not_published_yet', text: `${ad} henüz yayınlanmadı — ${kalanSure(gun)}`, detail: null, willArrive: true };
  }
  // 3) Kapsam BİLİNMİYOR + maç gelecekte → "henüz alınamadı" (söz verilmez).
  if (gelecek) {
    return { code: 'not_recorded_yet', text: `${ad} kaydı henüz alınamadı — ${kalanSure(gun)}`, detail: null, willArrive: null };
  }
  // 4) Maç geçmiş/başlamış, hâlâ hiç kayıt yok → artık gelmeyecek.
  return { code: 'never_recorded', text: `Bu maç için hiç ${ad.toLowerCase()} kaydı alınamadı`, detail: coverage?.reason || null, willArrive: false };
}

// Ortak GÜN-MÜHÜRLÜ seri motoru (oran veya yüzde).
// matches: [{ no, matchId, home, away, kickoffAt, coverage }]  (home/away = görünür ad)
export function buildDailySeries({
  roundId = null, round = null, matches = [], observations = [],
  firstKickoffMs = null, freezeAt = null, sealed = false, now = Date.now(),
  metric = 'odds',
} = {}) {
  const cfg = METRICS[metric] || METRICS.odds;
  const freezeMs = freezeAt ? new Date(freezeAt).getTime()
    : (firstKickoffMs ? firstKickoffMs - 5 * 60e3 : null);
  const matchDayKey = firstKickoffMs ? dayKeyOf(firstKickoffMs) : null;

  // Gün meta + mühür sınırı. Mühür = min(o gün 23:55 + pay, freeze/ilk maç −5 dk).
  //
  // 23:55 SINIRINA PAY: günlük mühür turu tam 23:55'te koşar; kaynağı çekip
  // arşive yazması saniyeler sürer, yani KENDİ gözlemi 23:55:00'dan SONRA
  // damgalanır. Katı sınır, tam da o günün mührü olması gereken gözlemi
  // atıyordu. ÖLÇÜM (arşiv, 1526. bülten): 29.07 son gözlem 23:55:51 ve
  // 30.07 son gözlem 23:56:02 — ikisi de dışarıda kalmıştı.
  //
  // Aynı pay, DNA arşivinde (playedDnaArchive.SEAL_GRACE_MS) zaten vardı; bu
  // dosya almamıştı ve iki yol birbiriyle çelişiyordu. Artık aynı kural.
  //
  // DONMA sınırına pay YOKTUR: maç başladıktan sonraki veri tahmine giremez.
  // Bu yüzden pay yalnız 23:55'e eklenir, freeze ile karşılaştırma paysız yapılır.
  const days = buildDayWindow({ firstKickoffMs, now }).map((key) => {
    const muhur = istanbulTimeToUtcMs(key, 23, 55) + SEAL_GRACE_MS;
    const capMs = (freezeMs != null && freezeMs < muhur) ? freezeMs : muhur;
    const startMs = istanbulTimeToUtcMs(key, 0, 0);
    const p = istanbulParts(istanbulTimeToUtcMs(key, 12, 0));
    return {
      date: key,
      weekday: WEEKDAY_TR[p.weekday],
      label: `${WEEKDAY_TR[p.weekday]} ${String(p.day).padStart(2, '0')}.${String(p.m).padStart(2, '0')}`,
      sealCap: new Date(capMs).toISOString(),
      isMatchDay: matchDayKey === key,
      future: startMs > now,                     // gün henüz başlamadı (gelecek) → veri basılmaz
      sealed: !!sealed || now > capMs,          // o gün kapandı → değişmez
      _startMs: startMs,
      _capMs: capMs,
    };
  });

  // Gözlemleri maç bazında topla (yalnız geçerli değer), zamana göre sırala.
  const byMatch = new Map();
  for (const o of (observations || [])) {
    const val = cfg.extract(o);
    if (!val) continue;
    const k = String(o.matchId);
    if (!byMatch.has(k)) byMatch.set(k, []);
    byMatch.get(k).push({ at: new Date(o.observedAt).getTime(), val, source: o.source || null });
  }
  for (const arr of byMatch.values()) arr.sort((a, b) => a.at - b.at);

  const outMatches = (matches || []).map((m) => {
    const matchId = String(m.matchId ?? m.sportotoMatchId ?? m.no);
    const series = byMatch.get(matchId) || [];
    const cells = {};
    let hasAny = false;
    const bosGunler = [];   // hücresi boş kalan günler — sebep sonra yazılır
    for (const d of days) {
      if (cfg.perSource) {
        // O GÜNE AİT gözlem yoksa hücre BOŞ kalır — önceki günden DEĞER TAŞINMAZ.
        //
        // Eskiden taşınıyordu. Gerekçe şuydu: "oynanma yüzdesi değişmeyince yeni
        // satır yazılmaz, o yüzden satırın yokluğu 'değişmedi' demektir." O
        // gerekçe ARTIK GEÇERSİZ: `playedPercentages.js` GÜN BAŞINA EN AZ BİR
        // KAYIT garantisi verir — tekrar filtresi yalnız AYNI GÜN içinde
        // uygulanır, değer günlerce sabit kalsa bile her günün İLK gözlemi
        // yazılır.
        //
        // Dolayısıyla bir günün satırı YOKSA anlamı tektir: O GÜN GÖZLEM
        // ALINAMADI (ör. veritabanı erişilemedi, süreç durdu). Böyle bir günde
        // dünün yüzdesini göstermek, olmayan veriyi varmış gibi göstermektir.
        // Kullanıcı bunu "pazar günü oranları pazarteside de var" diye bildirdi.
        //
        // Radar 4 (oran) zaten bu kuralı uyguluyordu; iki radar artık aynı
        // dürüstlük kuralında: veri yoksa sebep yazılır, değer uydurulmaz.
        const bySource = {};
        if (d._startMs <= now) {
          const capNow = Math.min(d._capMs, now);
          for (const s of series) {
            if (s.at > capNow) break;
            if (s.at < d._startMs) continue;              // önceki günler taşınmaz
            if (dayKeyOf(s.at) !== d.date) continue;      // gün anahtarı da tutmalı
            // Aynı gün içinde birden çok gözlem varsa SONUNCUSU geçerlidir.
            bySource[s.source || 'bilinmiyor'] = {
              [cfg.cellKey]: s.val,
              observedAt: new Date(s.at).toISOString(),
              source: s.source || null,
            };
          }
        }
        // HESAP YOK — hücre yalnız her kaynağın KENDİ yüzdesini taşır.
        // Bir ara buraya kaynak ortalaması, "yayılım" göstergesi ve bir özet
        // cümlesi ekleniyordu; kullanıcı hepsini kaldırttı: "formül hesaplama
        // filan silinecek, sadece temiz oynanma yüzdeleri olacak".
        // Kaynaklar ORTALANMAZ: iki site farklı yüzde veriyorsa bu bir bilgidir,
        // tek sayıya indirilirse kaybolur.
        if (Object.keys(bySource).length) {
          cells[d.date] = { bySource };
          hasAny = true;
        } else { cells[d.date] = null; bosGunler.push(d); }
      } else if (cfg.multiSource) {
        // ÇOK KAYNAKLI GÜN MÜHRÜ (oran). Her kaynak için AYRI AYRI: o günün
        // penceresinde (00:00 İstanbul .. mühür) o kaynağın SON gözlemi.
        // Kaynak o gün hiç yazmadıysa o kaynak için kayıt YOKTUR — bir önceki
        // günden veya başka kaynaktan DEĞER TAŞINMAZ.
        const bySource = {};
        let sonGozlem = null;                      // günün en son gözlemi (herhangi kaynak)
        for (const s of series) {
          if (s.at > d._capMs) break;
          if (s.at < d._startMs) continue;
          const sid = s.source || 'bilinmiyor';
          bySource[sid] = { [cfg.cellKey]: s.val, observedAt: new Date(s.at).toISOString(), source: s.source || null };
          sonGozlem = s;
        }
        const sids = sortOddsSources(Object.keys(bySource));
        if (sids.length) {
          // Üst düzey alanlar GERİYE UYUMLULUK: eski okuyucular `cell.odds`
          // bekliyor. Birincil kaynak o gün varsa O gösterilir; yoksa sıradaki
          // kaynak — ve `source` hangisi olduğunu açıkça yazar.
          const birincil = bySource[LEGACY_ODDS_SOURCE] ? LEGACY_ODDS_SOURCE : sids[0];
          const b = bySource[birincil];
          cells[d.date] = {
            [cfg.cellKey]: b[cfg.cellKey],
            observedAt: b.observedAt,
            source: b.source ?? null,
            sourceLabel: oddsSourceLabel(b.source),
            primarySource: birincil,
            sourceCount: sids.length,
            bySource,
            latestObservedAt: sonGozlem ? new Date(sonGozlem.at).toISOString() : b.observedAt,
          };
          hasAny = true;
        } else { cells[d.date] = null; bosGunler.push(d); }
      } else {
        // O GÜNE ait (00:00 İstanbul .. mühür) SON gözlem. Yoksa null (üretilmez).
        let last = null;
        for (const s of series) {
          if (s.at >= d._startMs && s.at <= d._capMs) last = s;
          else if (s.at > d._capMs) break;
        }
        if (last) { cells[d.date] = { [cfg.cellKey]: last.val, observedAt: new Date(last.at).toISOString(), source: last.source || null }; hasAny = true; }
        else { cells[d.date] = null; bosGunler.push(d); }
      }
    }

    // --- BOŞ HÜCRELERİN SEBEBİ ---------------------------------------------
    // Hücre `null` KALIR (uydurma değer yazılmaz, önceki gün taşınmaz); sebep
    // AYRI bir alanda (`notes`) durur. Böylece mevcut okuyucular bozulmaz.
    const kickoffMs = m.kickoffAt ? new Date(m.kickoffAt).getTime() : null;
    const absence = hasAny ? null
      : eksikSebebi({ coverage: m.coverage ?? null, kickoffMs, now, metric });
    const ad = metricAd(metric);
    const notes = {};
    for (const d of bosGunler) {
      // Sıra ÖNEMLİ: önce yapısal olarak imkânsız olanlar, sonra maça özel
      // sebep, en sonda veri toplama boşluğu. Ters sıra yanlış sebep yazdırır.
      if (d._capMs < d._startMs) {
        // Mühür sınırı günün başlangıcından önce → kilit bu günden önce düştü.
        // Bu, "gün henüz gelmedi"den ÖNCE gelir: kilitli bültende gelecek gün
        // de asla dolmayacaktır; "henüz gelmedi" demek boş umut yazmak olur.
        notes[d.date] = { code: 'after_lock', text: `Kilit sonrası — bu güne ${ad.toLowerCase()} mühürlenmez` };
      } else if (d.future) {
        notes[d.date] = { code: 'day_not_reached', text: 'Bu gün henüz gelmedi' };
      } else if (absence) {
        notes[d.date] = { code: absence.code, text: absence.text, detail: absence.detail ?? null };
      } else if (!d.sealed) {
        notes[d.date] = { code: 'day_open', text: 'Bu gün henüz mühürlenmedi' };
      } else {
        notes[d.date] = { code: 'seal_missed', text: 'Bu gün mühür alınamadı' };
      }
    }
    return {
      no: m.no, matchId, home: m.home ?? null, away: m.away ?? null,
      kickoffAt: m.kickoffAt ?? null, cells, hasAny,
      absence,   // maçın TÜM hafta verisi yoksa sebebi; varsa null
      notes,     // boş kalan her gün için kendi sebebi
    };
  });

  // Bu görünümde gerçekten kullanılan sağlayıcılar (site) — kullanıcıya "kaynak".
  const srcSet = new Set();
  for (const m of outMatches) for (const c of Object.values(m.cells)) {
    if (!c) continue;
    if (c.bySource) Object.keys(c.bySource).forEach((s) => srcSet.add(s));
    else if (c.source) srcSet.add(c.source);
  }
  // Oranda sıra deterministik (birincil önce) + etiketler NÖTR (marka adı yok).
  const sources = cfg.multiSource ? sortOddsSources([...srcSet]) : [...srcSet];
  const sourceLabels = cfg.multiSource
    ? Object.fromEntries(sources.map((s) => [s, oddsSourceLabel(s)])) : null;

  const emptyNote = metric === 'played'
    ? 'Bu hafta için henüz oynanma yüzdesi kaydı yok.'
    : 'Bu hafta için henüz oran kaydı yok.';

  // SAYAÇ — "15 maçın 5'inde oran var". Kullanıcı ekranda TEK GÜN gördüğü için
  // asıl anlamlı sayı GÜNLÜK olandır; haftalık toplam da ayrıca verilir.
  const total = outMatches.length;
  const withAny = outMatches.filter((m) => m.hasAny).length;
  const outDays = days.map(({ _startMs, _capMs, ...d }) => {
    // Kaynak başına o gün kaç maçta kayıt var — "ikinci kaynak bugün 9 maç
    // verdi" gibi DÜRÜST sayı. Kaynaklar toplanmaz; her biri kendi sayısı.
    const perSourceCount = {};
    for (const m of outMatches) {
      const c = m.cells[d.date];
      if (!c) continue;
      const ids = c.bySource ? Object.keys(c.bySource) : (c.source ? [c.source] : []);
      for (const id of ids) perSourceCount[id] = (perSourceCount[id] || 0) + 1;
    }
    // O GÜNÜN son çekim saati. Haftanın tek bir "son güncelleme"si yetmiyor:
    // her gün AYRI mühürleniyor, dolayısıyla her günün kendi tazeliği var —
    // Salı 23:52'de kapanmış olabilir, Çarşamba 14:03'te susmuş olabilir.
    // Gün penceresi dışındaki gözlem sayılmaz: o günün hücresine giren veri
    // hangi aralıktan geliyorsa saat de oradan gelmeli.
    let gunSonMs = null;
    for (const arr of byMatch.values()) {
      for (const o of arr) {
        if (o.at < _startMs || o.at > _capMs) continue;
        if (gunSonMs == null || o.at > gunSonMs) gunSonMs = o.at;
      }
    }
    return {
      ...d,
      withData: outMatches.filter((m) => m.cells[d.date]).length,
      bySourceCounts: Object.keys(perSourceCount).length ? perSourceCount : null,
      // Çipte tarih zaten yazıyor → YALNIZ saat. Gözlem yoksa null (uydurma yok).
      lastObservedAt: gunSonMs != null ? new Date(gunSonMs).toISOString() : null,
      lastObservedLabel: istanbulSaat(gunSonMs),
    };
  });

  return {
    hasData: outMatches.some((m) => m.hasAny),
    metric,
    sources,
    sourceLabels,      // { kimlik: nötr etiket } — oran dışındaki metriklerde null
    roundId: roundId != null ? Number(roundId) : null,
    round,
    sealed: !!sealed,
    timezone: 'Europe/Istanbul',
    // NOT: haftalık tek "son çekim" alanı KASTEN YOK. Bir dönem vardı ve
    // ekranda "Son güncelleme: 22:39" diye gösteriliyordu; kullanıcı Pazar
    // sekmesindeyken Pazartesi'nin saatini görüyordu. Ekranda TEK GÜN görünür,
    // dolayısıyla çekim saati de GÜN BAZINDA anlamlıdır → days[].lastObservedAt.
    // Dahili alanları (_startMs/_capMs) sızdırma.
    days: outDays,
    matches: outMatches,
    counts: { total, withAny, withoutAny: total - withAny },
    note: outMatches.some((m) => m.hasAny) ? null : emptyNote,
  };
}

// Radar 4 — gerçek 1/X/2 oranı.
export function buildDailyOdds(opts = {}) {
  return buildDailySeries({ ...opts, metric: 'odds' });
}
// Radar 3 — oynanma yüzdesi (aynı gün-mühürleme; kaynak yoksa boş → uydurma yok).
export function buildDailyPlayed(opts = {}) {
  return buildDailySeries({ ...opts, metric: 'played' });
}
