// RADAR EKRANI DURUM MAKİNESİ TESTLERİ — boş ekran hatası regresyonu (frontend).
// Kural: güncellik backend'in current:true alanından okunur; roundId
// sıralamasından TAHMİN EDİLMEZ. Güncel haftada "arşiv yok" ASLA gösterilmez.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeWeeks, resolveCurrentId, isCurrentWeek,
  deriveScreenState, screenStateMessage, isMissingArchiveError,
} from '../src/radarScreenLogic.js';

test('normalizeWeeks: current alanı esas alınır; string roundId sayıya çevrilir', () => {
  const wk = normalizeWeeks({
    currentRoundId: '4300',
    weeks: [
      { roundId: '4300', current: true, archived: false, sealed: false },
      { roundId: 4290, current: false, archived: true, sealed: true },
    ],
  });
  assert.equal(wk.currentRoundId, 4300);
  assert.equal(wk.weeks[0].roundId, 4300);
  assert.equal(wk.weeks[0].current, true);
  assert.equal(wk.weeks[1].archived, true);
  assert.equal(wk.weeks[1].locked, true, 'sealed → locked türetilir');
});

test('normalizeWeeks: ESKİ backend yanıtı (current alanı yok) currentRoundId ile doldurulur', () => {
  const wk = normalizeWeeks({ currentRoundId: 4300, weeks: [{ roundId: 4300 }, { roundId: 4290, sealed: true }] });
  assert.equal(wk.weeks.find((w) => w.roundId === 4300).current, true);
  assert.equal(wk.weeks.find((w) => w.roundId === 4290).current, false);
  assert.equal(wk.weeks.find((w) => w.roundId === 4290).archived, true);
});

test('resolveCurrentId: weeks içindeki current işareti > currentRoundId > /current roundId', () => {
  assert.equal(resolveCurrentId(null, normalizeWeeks({ currentRoundId: 4300, weeks: [{ roundId: 4300, current: true }] })), 4300);
  assert.equal(resolveCurrentId({ roundId: 4250, current: true }, normalizeWeeks({ currentRoundId: null, weeks: [] })), 4250);
  // Geçmiş hafta yanıtındaki roundId "güncel" sanılmaz:
  assert.equal(resolveCurrentId({ roundId: 4290, current: false }, { currentRoundId: null, weeks: [] }), null);
});

test('isCurrentWeek: tip farkı (string/number) güncellik tespitini bozmaz', () => {
  assert.equal(isCurrentWeek({ roundId: '4300' }, 4300), true);
  assert.equal(isCurrentWeek({ roundId: 4290 }, 4300), false);
  assert.equal(isCurrentWeek({ roundId: 4290, current: true }, null), true, 'backend işareti yeterli');
});

test('durum makinesi: 5 durum doğru türetilir', () => {
  assert.equal(deriveScreenState({ loading: true }), 'loading');
  assert.equal(deriveScreenState({ loading: false, error: 'Sunucu hatası (500)', meta: { current: true } }), 'error');
  assert.equal(deriveScreenState({ loading: false, view: { hasData: true, matches: [{ no: 1 }] }, meta: { current: true } }), 'data');
  assert.equal(deriveScreenState({ loading: false, legacyRadar: [{ no: 1 }], meta: { current: false } }), 'data');
  assert.equal(deriveScreenState({ loading: false, view: null, legacyRadar: [], meta: { current: true, pending: true } }), 'currentPending');
  assert.equal(deriveScreenState({ loading: false, view: null, legacyRadar: [], meta: { current: false } }), 'pastUnarchived');
});

test('REGRESYON: güncel haftada "arşiv yok" hatası boş ekran DEĞİL dürüst bekleme olur', () => {
  assert.equal(isMissingArchiveError('Bu hafta için radar arşivi yok.'), true);
  const state = deriveScreenState({ loading: false, error: 'Bu hafta için radar arşivi yok.', meta: { current: true } });
  assert.equal(state, 'currentPending', 'güncel hafta arşiv hatasına düşürülmez');
  const msg = screenStateMessage(state, { current: true });
  assert.ok(msg.includes('bekleniyor'));
  assert.ok(!msg.includes('arşiv'), 'kullanıcıya güncel haftada arşiv metni gösterilmez');
});

test('geçmiş haftada gerçek "arşiv yok" → pastUnarchived + dürüst metin (retry hatası değil)', () => {
  const state = deriveScreenState({ loading: false, error: 'Bu hafta için radar arşivi yok.', meta: { current: false } });
  assert.equal(state, 'pastUnarchived');
  assert.ok(screenStateMessage(state).includes('arşivlenmemiş'));
});

test('API hatasında mesaj + tekrar dene metni üretimi', () => {
  assert.equal(screenStateMessage('error'), 'Radar verisi alınamadı.');
  assert.equal(screenStateMessage('data'), null);
});
