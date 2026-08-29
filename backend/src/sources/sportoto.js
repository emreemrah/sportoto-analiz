// Spor Toto resmi API'sinden haftalık bülteni çeker.
// Test edilmiş açık uçlar (anahtar gerekmez):
//   api/GameRound/GetGameRoundYears
//   api/GameRound/GetGameRoundNamesByYear?year=YYYY/YYYY
//   api/GameMatch/GetGameMatches/?gameRoundId=<id>
import { createHash } from 'node:crypto';
import { config } from '../config.js';
// Dış servis çağrılarında zaman aşımı — takılan kaynak akışı kilitlemesin.
import { zamanAsimliFetch } from './zamanAsimi.js';

const BASE = config.sportotoApi;

// Resmi kaynak imzası: roundId + her maçın (sıra|ev|deplasman|tarih) → sha256.
// Aynı resmi veri her zaman aynı imzayı üretir; en ufak fark (takım/tarih/sıra/
// roundId/maç sayısı) imzayı değiştirir → kilit sonrası "sessiz değişiklik" tespiti.
export function buildOfficialSignature(roundId, matches) {
  const parts = [String(roundId)];
  for (const m of matches || []) {
    parts.push(`${m.no}|${m.home?.name || ''}|${m.away?.name || ''}|${m.date || ''}`);
  }
  return createHash('sha256').update(parts.join('~')).digest('hex');
}

// RESMİ TEYİT: yeni haftayı göstermeden önce tüm zorunlu alanları tek tek
// doğrular ve resmi kaynak imzasını üretir. Sonuç: { confirmed, status,
// checkedAt, signature, checks, failedChecks }.
//   status: 'confirmed'          → hepsi geçti, bülten gösterilebilir
//           'pendingVerification' → hafta API'de var ama yayınlanmamış (isPublished!=true)
//           'failed'              → yayınlanmış görünüyor ama alan/format teyidi geçmedi
export function verifyOfficialBulletin(round, matches) {
  const list = Array.isArray(matches) ? matches : [];
  const all15 = (fn) => list.length === 15 && list.every(fn);
  const checks = {
    isPublished: round?.isPublished === true,
    hasRoundId: round?.id != null,
    hasSeason: round?.year != null,
    hasWeek: round?.name != null,
    exactly15: list.length === 15,
    allHaveOrder: all15((m) => m.no != null),
    allHaveHome: all15((m) => !!m.home?.name),
    allHaveAway: all15((m) => !!m.away?.name),
    allHaveDate: all15((m) => !!m.date),
  };
  const signature = (checks.hasRoundId && checks.exactly15)
    ? buildOfficialSignature(round.id, list) : null;
  checks.signatureBuilt = signature != null;
  const failedChecks = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  const confirmed = failedChecks.length === 0;
  const status = confirmed ? 'confirmed'
    : (round?.isPublished !== true ? 'pendingVerification' : 'failed');
  return { confirmed, status, checkedAt: new Date().toISOString(), signature, checks, failedChecks };
}

async function get(path) {
  const res = await zamanAsimliFetch(BASE + path);
  if (!res.ok) throw new Error(`sportoto ${path}: HTTP ${res.status}`);
  const json = await res.json();
  if (json && json.isSucceed === false) throw new Error(`sportoto ${path}: ${json.message}`);
  return json.object;
}

// Mevcut sezonları döndürür (en yenisi başta)
export async function getYears() {
  const years = await get('api/GameRound/GetGameRoundYears');
  return years.map((y) => y.year);
}

// Bir sezonun haftalarını döndürür: [{ name, id, isPublished }]
export async function getRounds(year) {
  const enc = encodeURIComponent(year);
  return get(`api/GameRound/GetGameRoundNamesByYear?year=${enc}`);
}

// Bir haftanın 15 maçını ham olarak çeker
async function getRoundMatches(roundId) {
  return get(`api/GameMatch/GetGameMatches/?gameRoundId=${roundId}`);
}

// Ham maçı uygulamanın kullandığı temiz yapıya çevirir
function normalizeMatch(row, index) {
  const m = row.match || {};
  const home = m.homeTeam || {};
  const away = m.awayTeam || {};
  const score = m.score || {};
  const skorVar = score.homeRegular != null && score.awayRegular != null
    && m.fullTimeWin != null;

  // NOTER KARARI RESMÎ API'DE VARMIŞ (2026-08-20 canlı bulgu, 1. Hafta 15.
  // maç): ertelenen maçın kura sonucu `noterWin` alanında yayımlanıyor.
  // "Ertelenen maçın sonucu sağlayıcıdan ASLA gelmez" varsayımı (10 Ağustos,
  // resultsService) bu alanla çürüdü; elle giriş artık yalnız API'nin de
  // yayımlamadığı durumlar için yedek.
  //
  // ALAN DAVRANIŞI ÖLÇÜLDÜ (1528 + 1529, 15+15 satır):
  //   oynanmamış maç        → noterWin NULL (0 bile değil)
  //   oynanmış normal maç   → noterWin 0 (varsayılan dolgu — kura DEĞİL)
  //   kura kararlı maç      → noterWin 1 (skor yok)
  //
  // KUPON GERÇEĞİ KURALI: kura kararı verilmiş maç SONRADAN OYNANSA BİLE
  // (Celta Vigo – Osasuna 27 Ağustos'ta oynanacak) Spor Toto haftayı KURAYLA
  // değerlendirdi ve ikramiye ona göre dağıtıldı — bu bültende o maçın kupon
  // sonucu sonsuza dek kuradır, maç skoru değil. Bu yüzden skorlu satırda
  // noterWin 1/2 ise NOTER kazanır (skor bu bültenin verisi değildir, null
  // kalır). Skorlu satırda 0, normal maçların varsayılan dolgusundan ayırt
  // EDİLEMEZ → burada karar verilmez; X kurası çekilmiş-sonra-oynanmış maçı
  // /api/history'deki arşiv katmanı düzeltir (notary kaydı koşulsuz kazanır).
  // Satır viaNotary taşır: ekran "Ertelendi · Noter Kararı" basar, radar
  // karnesi motor isabeti SAYMAZ, kupon değerlendirmesi işareti sayar.
  const noterKarar = winToSymbol(m.noterWin ?? row.noterWin);
  const noterSonuc = skorVar
    ? (noterKarar === '1' || noterKarar === '2' ? noterKarar : null)
    : noterKarar;
  const finished = skorVar && !noterSonuc;

  return {
    no: index + 1,
    sportotoMatchId: m.id || row.id,
    date: m.date || row.date,
    league: (m.stage && m.stage.name) || '',
    home: {
      name: home.name || '',
      shortName: home.shortName || '',
      mediumName: home.mediumName || home.name || '',
      externalTeamId: home.externalTeamId ?? null,
    },
    away: {
      name: away.name || '',
      shortName: away.shortName || '',
      mediumName: away.mediumName || away.name || '',
      externalTeamId: away.externalTeamId ?? null,
    },
    status: finished ? 'finished' : 'upcoming',
    score: finished
      ? { home: score.homeRegular, away: score.awayRegular }
      : null,
    // 1 / X / 2 sonucu (bilen için): fullTimeWin 1=ev, 0=beraberlik, 2=deplasman
    result: finished ? winToSymbol(m.fullTimeWin) : noterSonuc,
    ...(noterSonuc ? { viaNotary: true } : {}),
  };
}

function winToSymbol(fullTimeWin) {
  if (fullTimeWin === 1) return '1';
  if (fullTimeWin === 2) return '2';
  if (fullTimeWin === 0) return 'X';
  return null;
}

// Şu an oynanmakta olan / oynanacak (güncel) haftayı bulur.
// api/GameRound tüm haftaları kapanış tarihiyle verir; ama resmi Spor Toto
// takvimi, bir sonraki haftanın maçlarını/kapanış tarihini önceden sisteme
// GİRER (isPublished: false) — o hafta ancak Pazar günü resmen YAYINLANINCA
// (isPublished: true) siteye ve gerçek bültene düşer. Bu yüzden sadece en
// yakın kapanışa bakmak yeterli değildir: geçerli haftanın kapanış saati
// geçmiş olsa bile, bir sonraki hafta henüz yayınlanmadıysa güncel bülten
// hâlâ ONDAN öncekidir (aynı sportoto.gov.tr/spor-toto-listeler sayfasının
// davranışı). Sadece isPublished=true olan haftalar "güncel" adayı olabilir.
// KAPANIŞ ANI (ms). Spor Toto bazen yeni haftayı KAPANIŞ TARİHİ GİRMEDEN
// yayınlar (4. Hafta, 29 Ağu 2026: isPublished=true, roundCloseDate=null,
// 15 maç hazır). `new Date(null)` 1970'i verip bu haftayı en ESKİ sıraya
// atıyor, güncel tur bir önceki haftada kalıyor ve uygulamaya yeni bülten
// hiç gelmiyordu. Kapanışı girilmemiş yayınlanmış hafta "kapanışı bilinmiyor
// = gelecek" sayılır (+∞); bozuk tarih NaN kalır ve elenir.
export function kapanisAni(r) {
  const ham = r?.roundCloseDate;
  if (ham == null || ham === '') return Infinity;
  return new Date(ham).getTime();
}

// İki bilinmeyen kapanış (∞−∞ = NaN) sıralamayı bozmasın.
const kapanisaGore = (a, b) => (a.close === b.close ? 0 : a.close - b.close);

// Yayınlanmış turlar kapanışa göre eski→yeni; kapanışı bilinmeyenler EN SONDA.
// SAF: ağ yok, doğrudan test edilir.
export function yayinlanmisTurlar(all) {
  return (all || [])
    .filter((r) => r && r.isPublished === true)
    .map((r) => ({ ...r, close: kapanisAni(r) }))
    .filter((r) => !Number.isNaN(r.close))
    .sort(kapanisaGore);
}

// GÜNCEL TUR: kapanışı henüz gelmemiş (ya da bilinmeyen) YAYINLANMIŞ ilk
// hafta. Yayınlanmış haftaların hepsinin kapanışı geçtiyse (yeni hafta henüz
// yayınlanmadıysa) en son kapanan hafta gösterilmeye devam eder.
export function guncelTurSec(all, now = Date.now()) {
  const turlar = yayinlanmisTurlar(all);
  const future = turlar.filter((r) => r.close >= now);
  return future[0] || turlar[turlar.length - 1] || null;
}

export async function getCurrentRound() {
  return guncelTurSec(await get('api/GameRound'));
}

// Navigasyon için haftalar: tüm YAYINLANMIŞ haftalar (kapanış tarihine göre,
// eski→yeni; kapanışı girilmemiş yeni hafta en sonda) + güncel hafta id'si.
// Henüz yayınlanmamış (isPublished: false) gelecek haftalar — resmi sitede de
// görünmedikleri için — listeye hiç girmez; aksi halde kullanıcı henüz
// açıklanmamış bir haftayı gezebilir.
export async function getRoundsForNav() {
  const all = await get('api/GameRound');
  const now = Date.now();
  const rounds = yayinlanmisTurlar(all)
    .map((r) => ({ id: r.id, name: r.name, year: r.year, closeDate: r.roundCloseDate ?? null, isPublished: r.isPublished, close: r.close }))
    .filter((r) => r.id != null);
  const future = rounds.filter((r) => r.close >= now);
  const current = future[0] || rounds[rounds.length - 1];
  return {
    currentRoundId: current ? current.id : null,
    rounds: rounds.map(({ close, ...r }) => r),
  };
}

// Belirli bir haftanın (geçmiş/herhangi) maç listesini skor + resmi 1/X/2 ile getirir.
export async function getBulletinByRoundId(roundId) {
  const rawMatches = await getRoundMatches(roundId);
  const matches = rawMatches.map(normalizeMatch);
  return { roundId, matchCount: matches.length, matches };
}

// Bir haftanın resmi sonuç + ikramiye dağılımını getirir. Açıklanmamışsa null.
export async function getRoundResult(roundId) {
  try {
    const o = await get(`api/GameResult/GetGameResultByGameRoundId?Id=${roundId}`);
    if (!o) return null;
    const tiers = [
      { hit: 15, count: o.fifteenWinCount, prize: o.fifteenWinPrize },
      { hit: 14, count: o.fourteenWinCount, prize: o.fourteenWinPrize },
      { hit: 13, count: o.thirteenWinCount, prize: o.thirteenWinPrize },
      { hit: 12, count: o.twelveWinCount, prize: o.twelveWinPrize },
    ];
    const any = tiers.some((t) => t.count != null || t.prize != null);
    if (!any) return null;
    return { tiers, description: o.resultDescription || null, closeDate: o.gameRoundCloseDate || null };
  } catch {
    return null;
  }
}

// Güncel haftanın bültenini getirir.
// RESMİ DOĞRULAMA: gerçek bir Spor Toto bülteni ancak şu üç şart birlikte
// sağlanınca oluşturulur — (1) hafta resmen YAYINLANMIŞ (isPublished=true),
// (2) TAM 15 maç var, (3) her maçın gerçek ev/deplasman takım adı var.
// Aksi halde (yayın öncesi boş/eksik hafta, API hatası) bülten "yayınlanmadı"
// sayılır (published=false) — asla uydurma/eksik/otomatik bülten üretilmez.
export async function getLatestBulletin() {
  const round = await getCurrentRound();
  if (!round || !round.id) {
    const verification = verifyOfficialBulletin(round, []);
    return { published: false, verification, verifyReason: 'Yayınlanmış hafta bulunamadı', year: null, round: null, roundId: null, closeDate: null, matchCount: 0, matches: [] };
  }
  const rawMatches = await getRoundMatches(round.id);
  const matches = rawMatches.map(normalizeMatch);
  const verification = verifyOfficialBulletin(round, matches);

  return {
    published: verification.confirmed,               // geriye dönük alias
    verification,                                    // { confirmed, status, signature, checks, ... }
    verifyReason: verification.confirmed ? null
      : `Resmi teyit başarısız (${verification.status}): ${verification.failedChecks.join(', ')}`,
    year: round.year,
    round: round.name,
    roundId: round.id,
    closeDate: round.roundCloseDate,
    matchCount: matches.length,
    matches,
  };
}
