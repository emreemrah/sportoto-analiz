// BİLDİRİM MERKEZİ SERVİSİ — gerçek uçlardan veri toplar, saf modüle verir.
//
// Depolama anahtarı: 'sportoto.notifications.v1' (YENİ anahtar; mevcut hiçbir
// anahtarın adı değiştirilmedi). İçinde kişisel veri YOK: yalnız en son
// görülme zamanı, son puan toplamı, kazanılmış başarı anahtarları ve okunmuş
// bildirim kimlikleri tutulur.

import { api } from '../api';
import { getWeekCoupons } from '../coupon/store';
import { buildNotifications, nextState, seedState } from '../notifications';

export const NOTIF_KEY = 'sportoto.notifications.v1';

function store() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

export function readState() {
  try {
    const raw = store()?.getItem(NOTIF_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function writeState(s) {
  try { store()?.setItem(NOTIF_KEY, JSON.stringify(s)); } catch { /* depo yoksa sessiz geç */ }
}

/** Bir isteğin patlaması diğerlerini engellemesin — eksik veri "yok" sayılır. */
async function safe(p) {
  try { return await p; } catch { return null; }
}

/**
 * Gerçek verileri çeker ve bildirim listesini üretir.
 * Hiçbir uç cevap vermezse sonuç BOŞ listedir (uydurma yapılmaz).
 */
export async function loadNotifications({ now = Date.now() } = {}) {
  const state = readState();

  // (api.progress kaldırıldı — oyunlaştırma söküldü, 2026-08-06)
  const [bulletin, roundsRes] = await Promise.all([
    safe(api.bulletin()),
    safe(api.rounds()),
  ]);
  const progress = null;

  // Kapanan hafta: hafta listesindeki güncel haftadan bir öncesi.
  let history = null;
  const list = Array.isArray(roundsRes?.rounds) ? roundsRes.rounds : [];
  const guncelId = roundsRes?.currentRoundId ?? bulletin?.roundId ?? null;
  const idx = list.findIndex((r) => String(r.id) === String(guncelId));
  const onceki = idx > 0 ? list[idx - 1] : (idx === -1 && list.length > 1 ? list[list.length - 2] : null);
  if (onceki?.id != null) {
    const h = await safe(api.history(onceki.id));
    if (h && Array.isArray(h.matches)) {
      history = { roundId: onceki.id, roundName: onceki.name || null, matches: h.matches };
    }
  }

  const gRound = bulletin?.roundId ?? bulletin?.round?.id ?? guncelId ?? null;
  let coupons = [];
  try { coupons = gRound != null ? getWeekCoupons(gRound) : []; } catch { coupons = []; }

  // İlk kurulum: geçmişe dönük bildirim yağmuru olmasın diye durum tohumlanır.
  const ilkKez = state.lastPoints == null && !Array.isArray(state.knownRoundIds);
  if (ilkKez) {
    writeState(seedState({ now, bulletin, progress }));
    return { items: [], unread: 0, firstRun: true };
  }

  const { items, unread } = buildNotifications({ now, bulletin, history, coupons, progress, state });
  return { items, unread, firstRun: false, ctx: { bulletin, progress } };
}

/**
 * Telefon hatırlatmalarını planlamak için gereken GERÇEK girdiler.
 *
 * pushService bilerek `api`'yi tanımaz (cihaz katmanı ile veri katmanı ayrı
 * kalsın diye); veriyi toplayan taraf burasıdır. Uç cevap vermezse bülten
 * null döner ve hiçbir hatırlatma kurulmaz — uydurma yapılmaz.
 */
export async function loadPushInputs() {
  const bulletin = await safe(api.bulletin());
  const gRound = bulletin?.roundId ?? bulletin?.round?.id ?? null;
  let coupons = [];
  try { coupons = gRound != null ? getWeekCoupons(gRound) : []; } catch { coupons = []; }
  return { bulletin, coupons };
}

/** Kullanıcı bildirimleri açtı: okunmuş say ve durumu kaydet. */
export function markSeen({ now = Date.now(), items = [], ctx = {} } = {}) {
  const s = nextState({ now, state: readState(), items, bulletin: ctx.bulletin, progress: ctx.progress });
  writeState(s);
  return s;
}
