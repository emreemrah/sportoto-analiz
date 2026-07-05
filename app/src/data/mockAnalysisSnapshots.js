// app/src/data/mockAnalysisSnapshots.js
// Her bültenin maç-başlamadan-önceki analiz halinin "kilitli" kopyası.
// Sonuç bilgisi (resultInfo) skor/1-X-2 için mockBulletins'teki maçı tek
// doğruluk kaynağı olarak kullanır — burada tekrar edilmez, sadece
// sistemin o maç için doğru/yanlış çıktığı ve hata etiketi hesaplanır.

import { mockBulletins, findMockBulletin } from './mockBulletins';
import { MATCH_STATUS } from './../types/bulletin';
import { ERROR_TAGS } from '../types/analysis';

const HOUR = 60 * 60 * 1000;

function resultInfoFor(match, prediction, forcedErrorTag) {
  const resolved = match.status === MATCH_STATUS.FINISHED && !!match.result1x2;
  if (!resolved) {
    return {
      halfTimeScore: match.halfTimeScore || null,
      fullTimeScore: null,
      actualResult: null,
      systemCorrect: null,
      userCorrect: null,
      errorTag: null,
      errorNote: null,
    };
  }
  const systemCorrect = prediction === match.result1x2;
  return {
    halfTimeScore: match.halfTimeScore || null,
    fullTimeScore: match.fullTimeScore,
    actualResult: match.result1x2,
    systemCorrect,
    userCorrect: null, // couponService checkCoupon() doldurur
    errorTag: systemCorrect ? null : (forcedErrorTag || ERROR_TAGS.UNKNOWN),
    errorNote: systemCorrect ? null : `Sistem ${prediction} bekliyordu, sonuç ${match.result1x2} geldi.`,
  };
}

function buildSnapshot(bulletinId, isLocked, lockedAt, rows) {
  const bulletin = findMockBulletin(bulletinId);
  const matchesAnalysis = rows.map(([orderNo, prediction, confidenceScore, surpriseRisk, analysisComment, statsSummary, lineupComment, missingPlayers, errorTag]) => {
    const match = bulletin.matches.find((m) => m.orderNo === orderNo);
    return {
      matchId: match.id,
      prediction,
      confidenceScore,
      surpriseRisk,
      analysisComment,
      statsSummary,
      lineupComment,
      missingPlayers: missingPlayers || [],
      dataTimestamp: new Date(new Date(match.startTime).getTime() - 3 * HOUR).toISOString(),
      createdAt: bulletin.createdAt,
      version: 1,
      isLocked,
      resultInfo: resultInfoFor(match, prediction, errorTag),
    };
  });
  return {
    id: `snap-${bulletinId}`,
    bulletinId,
    version: 1,
    createdAt: bulletin.createdAt,
    lockedAt: lockedAt || null,
    isLocked,
    matchesAnalysis,
  };
}

/* B27 — ACTIVE, snapshot editable (isLocked:false) */
const snapB27 = buildSnapshot('b27', false, null, [
  [1, '1', 62, 30, 'Galatasaray iç sahada net favori, son 5 derbinin 4ünü kazandı.', 'Ev sahibi son 5 maç: 4G 1B. Deplasman son 5: 2G 1B 2M.', 'Her iki takım da tam kadro, sakatlık riski düşük.', [], null],
  [2, '1', 58, 34, 'Beşiktaş formda ama Trabzonspor deplasmanda dirençli.', 'Karşılıklı gollü geçme oranı yüksek (%70).', 'Trabzonspor’da bir sağ bek şüpheli.', [{ name: 'Umut Bozok', reason: 'doubtful' }], null],
  [3, '1', 55, 38, 'Başakşehir evinde güçlü, Sivasspor deplasmanda gol sıkıntısı yaşıyor.', 'Sivasspor son 5 deplasmanda sadece 3 gol attı.', 'Kadro planlanan haliyle sahada.', [], null],
  [4, 'X', 48, 45, 'Konyaspor-Alanyaspor dengeli, beraberlik riski var.', 'Son 4 karşılaşmanın 2si berabere bitti.', 'Konyaspor’da orta saha eksikliği hissedilebilir.', [{ name: 'Berkan Emir', reason: 'injury' }], null],
  [5, '1', 60, 32, 'Antalyaspor son 3 iç saha maçını kazandı.', 'Kasımpaşa deplasmanda savunma zaafı gösteriyor.', 'İki takımda da cezalı yok.', [], null],
  [6, '1', 66, 26, 'Malmö FF ligde lider, AIK deplasmanda istikrarsız.', 'Malmö son 6 iç saha maçında 5 galibiyet.', 'Kadro tam.', [], null],
  [7, '1', 44, 52, 'Djurgården-Hammarby İsveç derbisi, sürprize açık.', 'Son 5 karşılaşmada 3 farklı sonuç türü çıktı.', 'Hammarby’de forvet sakat şüpheli.', [{ name: 'Kevin Ozua', reason: 'doubtful' }], null],
  [8, '1', 53, 41, 'IFK Göteborg evinde iyi, Elfsborg deplasmanda ortalama.', 'Ev sahibi son 5 maçta 3 galibiyet.', 'Elfsborg’da bir stoper cezalı.', [{ name: 'Marcus Boström', reason: 'suspension' }], null],
  [9, '1', 70, 20, 'Bodø/Glimt ligin en golcü takımı, evinde neredeyse yenilmiyor.', 'Son 8 iç saha maçında 7 galibiyet.', 'Kadro tam, rotasyon riski düşük.', [], null],
  [10, '2', 50, 47, 'Viking evinde zayıf, Rosenborg deplasmanda güçlü seri yakaladı.', 'Rosenborg son 4 deplasmanda 3 galibiyet.', 'Viking’de savunma hattında iki eksik.', [{ name: 'Kristoffer Løkberg', reason: 'injury' }], null],
  [11, '1', 57, 39, 'Arsenal Emirates’te güçlü, Chelsea deplasmanda dalgalı.', 'Arsenal son 6 iç saha maçında 5 galibiyet.', 'Chelsea’de orta saha rotasyonu bekleniyor.', [], null],
  [12, '1', 54, 40, 'Liverpool Anfield’de baskın, Tottenham deplasmanda savunma açığı veriyor.', 'Liverpool son 5 iç saha maçında 12 gol attı.', 'Tottenham’da bir stoper şüpheli.', [{ name: 'Cristian Romero', reason: 'doubtful' }], null],
  [13, '1', 68, 22, 'Real Madrid Bernabéu’de favori, Sevilla deplasmanda zayıf seri yaşıyor.', 'Sevilla son 5 deplasmanda sadece 1 galibiyet.', 'Real Madrid’de rotasyon riski düşük.', [], null],
  [14, 'X', 46, 50, 'Inter-Napoli zirve maçı, iki takım da form durumunda.', 'Son 3 karşılaşmanın 2si berabere bitti.', 'Napoli’de bir orta saha oyuncusu cezalı.', [{ name: 'Frank Anguissa', reason: 'suspension' }], null],
  [15, '1', 63, 29, 'Bayern Münih Allianz Arena’da çok güçlü, Leipzig deplasmanda istikrarsız.', 'Bayern son 7 iç saha maçında 6 galibiyet.', 'Kadro tam, sakatlık yok.', [], null],
]);

/* B26 — LOCKED (ilk maç başladı, snapshot donduruldu) */
const snapB26 = buildSnapshot('b26', true, findMockBulletin('b26').lockedAt, [
  [1, '1', 60, 30, 'Fenerbahçe iç sahada favoriydi.', 'Ev sahibi son 5: 4G 1M.', 'Kadro tam.', [], null],
  [2, '1', 56, 36, 'Galatasaray hafif favoriydi, Beşiktaş direnç göstermesi bekleniyordu.', 'Beraberlik oranı ligde yüksek.', 'İki takımda da eksik yoktu.', [], ERROR_TAGS.DRAW_MISSED],
  [3, 'X', 47, 46, 'Sivasspor-Konyaspor dengeliydi, X ağırlıklı görülmüştü.', 'Son 4 maçın 2si berabere bitmişti.', 'Sivasspor’da bir sağ bek şüpheliydi.', [{ name: 'Mert Hakan', reason: 'doubtful' }], ERROR_TAGS.AWAY_WIN_MISSED],
  [4, '1', 59, 33, 'Alanyaspor evinde güçlüydü.', 'Antalyaspor deplasmanda gol sıkıntısı yaşıyordu.', 'Kadro tam.', [], null],
  [5, '2', 45, 48, 'Başakşehir deplasmanda az farkla favoriydi.', 'Kasımpaşa evinde savunma açığı veriyordu.', 'Başakşehir’de bir forvet sakattı.', [{ name: 'Deniz Türüç', reason: 'injury' }], ERROR_TAGS.DRAW_MISSED],
  [6, '1', 57, 38, 'AIK evinde iyi seri yakalamıştı.', 'Malmö FF deplasmanda istikrarsızdı.', 'Kadro tam.', [], ERROR_TAGS.FAVORITE_FAILED],
  [7, '1', 61, 31, 'Hammarby evinde güçlüydü.', 'Djurgården deplasmanda savunma zaafı gösteriyordu.', 'Kadro tam.', [], null],
  [8, '1', 52, 43, 'Elfsborg evinde hafif favoriydi.', 'IFK Göteborg deplasmanda ortalama form gösteriyordu.', 'Elfsborg’da bir stoper şüpheliydi.', [{ name: 'Anton Israelsson', reason: 'doubtful' }], ERROR_TAGS.DRAW_MISSED],
  [9, '2', 49, 49, 'Molde-Bodø/Glimt dengeli görülmüştü, hafif deplasman favorisi.', 'Bodø/Glimt deplasmanda çok golcüydü.', 'Kadro tam.', [], null],
  [10, '2', 51, 44, 'Rosenborg deplasmanda güçlü seri yakalamıştı.', 'Viking evinde zayıf form gösteriyordu.', 'Viking’de iki savunma eksiği vardı.', [{ name: 'Kristoffer Løkberg', reason: 'injury' }], ERROR_TAGS.FAVORITE_FAILED],
  [11, '2', 55, 39, 'Arsenal deplasmanda az farkla favori görülmüştü.', 'Chelsea evinde dalgalıydı.', 'Kadro tam.', [], null],
  [12, '2', 53, 41, 'Liverpool deplasmanda favoriydi.', 'Tottenham evinde savunma açığı veriyordu.', 'Tottenham’da bir stoper şüpheliydi.', [{ name: 'Cristian Romero', reason: 'doubtful' }], null],
  [13, '1', 65, 25, 'Real Madrid deplasmanda bile güçlü görülüyor.', 'Sevilla evinde form arayışında.', 'Kadro tam.', [], null],
  [14, 'X', 48, 50, 'Napoli-Inter zirve maçı, dengeli.', 'Son 3 karşılaşmanın 2si berabere.', 'Napoli’de bir orta saha cezalı.', [{ name: 'Frank Anguissa', reason: 'suspension' }], null],
  [15, '2', 58, 34, 'Bayern Münih deplasmanda da çok güçlü görülüyor.', 'Leipzig evinde istikrarsız.', 'Kadro tam.', [], null],
]);

/* B24 — COMPLETED */
const snapB24 = buildSnapshot('b24', true, findMockBulletin('b24').lockedAt, [
  [1, '2', 55, 42, 'Galatasaray deplasmanda da favori görülmüştü.', 'Trabzonspor evinde savunma sıkıntısı yaşıyordu.', 'Kadro tam.', [], null],
  [2, '1', 54, 44, 'Beşiktaş evinde hafif favoriydi, Fenerbahçe direnç göstermesi bekleniyordu.', 'Beraberlik oranı derbilerde yüksek.', 'Kadro tam.', [], ERROR_TAGS.DRAW_MISSED],
  [3, '1', 61, 30, 'Konyaspor evinde güçlüydü.', 'Sivasspor deplasmanda gol sıkıntısı yaşıyordu.', 'Kadro tam.', [], null],
  [4, '1', 52, 45, 'Antalyaspor evinde az farkla favoriydi.', 'Alanyaspor deplasmanda savunma ağırlıklı oynuyordu.', 'Antalyaspor’da bir forvet şüpheliydi.', [{ name: 'Fernando', reason: 'doubtful' }], ERROR_TAGS.DRAW_MISSED],
  [5, '1', 63, 27, 'Başakşehir evinde çok güçlüydü.', 'Kasımpaşa deplasmanda savunma açığı veriyordu.', 'Kadro tam.', [], null],
  [6, '1', 66, 24, 'Malmö FF evinde ligin en iyisiydi.', 'Hammarby deplasmanda istikrarsızdı.', 'Kadro tam.', [], null],
  [7, '1', 55, 40, 'Djurgården evinde hafif favoriydi.', 'AIK deplasmanda direnç gösteriyordu.', 'Kadro tam.', [], ERROR_TAGS.DRAW_MISSED],
  [8, '1', 53, 43, 'IFK Göteborg evinde iyi seri yakalamıştı.', 'Elfsborg deplasmanda ortalama form gösteriyordu.', 'Elfsborg’da bir stoper cezalıydı.', [{ name: 'Marcus Boström', reason: 'suspension' }], ERROR_TAGS.FAVORITE_FAILED],
  [9, '1', 71, 18, 'Bodø/Glimt evinde neredeyse yenilmiyordu.', 'Viking deplasmanda çok zayıftı.', 'Kadro tam.', [], null],
  [10, '1', 50, 48, 'Rosenborg evinde az farkla favoriydi.', 'Molde deplasmanda güçlü seri yakalamıştı.', 'Rosenborg’da bir bek sakattı.', [{ name: 'Even Hovland', reason: 'injury' }], ERROR_TAGS.AWAY_WIN_MISSED],
  [11, '1', 56, 40, 'Arsenal evinde favoriydi.', 'Liverpool deplasmanda gol garantiliydi.', 'Kadro tam.', [], ERROR_TAGS.DRAW_MISSED],
  [12, 'X', 46, 47, 'Tottenham-Chelsea dengeli görülmüştü, X ağırlıklıydı.', 'Son 4 maçın 2si berabere bitmişti.', 'Tottenham’da bir stoper şüpheliydi.', [{ name: 'Cristian Romero', reason: 'doubtful' }], ERROR_TAGS.AWAY_WIN_MISSED],
  [13, '1', 69, 20, 'Real Madrid evinde çok güçlüydü.', 'Napoli deplasmanda form arayışındaydı.', 'Kadro tam.', [], null],
  [14, '2', 44, 55, 'Inter evinde hafif favoriydi ama Bayern Münih deplasmanda çok golcüydü.', 'Karşılıklı gollü geçme oranı yüksekti.', 'Inter’de bir stoper cezalıydı.', [{ name: 'Francesco Acerbi', reason: 'suspension' }], ERROR_TAGS.SURPRISE_MATCH],
  [15, '1', 60, 32, 'Sevilla evinde toparlanma sürecindeydi.', 'Leipzig deplasmanda istikrarsızdı.', 'Kadro tam.', [], null],
]);

/* B22 — COMPLETED (daha eski, başarılı hafta) */
const snapB22 = buildSnapshot('b22', true, findMockBulletin('b22').lockedAt, [
  [1, '1', 68, 22, 'Galatasaray evinde çok güçlüydü.', 'Konyaspor deplasmanda gol sıkıntısı yaşıyordu.', 'Kadro tam.', [], null],
  [2, '1', 65, 25, 'Fenerbahçe evinde favoriydi.', 'Sivasspor deplasmanda savunma açığı veriyordu.', 'Kadro tam.', [], null],
  [3, '1', 62, 27, 'Beşiktaş evinde güçlüydü.', 'Antalyaspor deplasmanda ortalama form gösteriyordu.', 'Kadro tam.', [], null],
  [4, '1', 60, 30, 'Trabzonspor evinde favoriydi.', 'Kasımpaşa deplasmanda zayıftı.', 'Kadro tam.', [], null],
  [5, 'X', 48, 44, 'Başakşehir-Alanyaspor dengeliydi.', 'Son 3 maçın 2si berabere bitmişti.', 'Kadro tam.', [], null],
  [6, '1', 64, 26, 'Malmö FF evinde güçlüydü.', 'Elfsborg deplasmanda istikrarsızdı.', 'Kadro tam.', [], null],
  [7, 'X', 50, 46, 'AIK-Hammarby dengeli görülmüştü.', 'Son 4 maçın 2si berabere bitmişti.', 'Kadro tam.', [], ERROR_TAGS.UNKNOWN],
  [8, '1', 58, 35, 'Djurgården evinde hafif favoriydi.', 'IFK Göteborg deplasmanda savunma açığı veriyordu.', 'Kadro tam.', [], null],
  [9, '1', 70, 19, 'Bodø/Glimt evinde neredeyse yenilmiyordu.', 'Rosenborg deplasmanda ortalamaydı.', 'Kadro tam.', [], null],
  [10, '2', 52, 45, 'Molde deplasmanda güçlü seri yakalamıştı.', 'Viking evinde zayıftı.', 'Kadro tam.', [], null],
  [11, '1', 63, 28, 'Arsenal evinde çok güçlüydü.', 'Tottenham deplasmanda savunma açığı veriyordu.', 'Kadro tam.', [], null],
  [12, '1', 51, 44, 'Liverpool evinde az farkla favoriydi.', 'Chelsea deplasmanda direnç gösteriyordu.', 'Kadro tam.', [], ERROR_TAGS.DRAW_MISSED],
  [13, '1', 55, 41, 'Real Madrid evinde favoriydi.', 'Inter deplasmanda gol garantiliydi.', 'Kadro tam.', [], ERROR_TAGS.FAVORITE_FAILED],
  [14, '1', 59, 33, 'Napoli evinde güçlüydü.', 'Sevilla deplasmanda zayıf seri yaşıyordu.', 'Kadro tam.', [], null],
  [15, '1', 66, 24, 'Bayern Münih evinde çok güçlüydü.', 'Leipzig deplasmanda istikrarsızdı.', 'Kadro tam.', [], null],
]);

export const mockAnalysisSnapshots = [snapB27, snapB26, snapB24, snapB22];

export function findMockSnapshot(bulletinId) {
  return mockAnalysisSnapshots.find((s) => s.bulletinId === bulletinId) || null;
}

// --- dosya sonu güvenlik dolgusu (sandbox yazma/senkron katmanındaki olası
// artık baytları zararsız hale getirmek için bilinçli olarak eklendi) ---
//
//
//
//
//
//
//
//
//
//
