// TELEFON / KİLİT EKRANI BİLDİRİMİ — PLANLAYICI (SAF MODÜL)
//
// React Native bağımlılığı YOKTUR — böylece node testlerinde doğrudan
// çalıştırılabilir (`src/notifications.js` ve `src/demoGate.js` ile aynı gerekçe).
// expo-notifications burada İMPORT EDİLMEZ; bu dosya yalnız "hangi bildirim, ne
// zaman, hangi metinle" sorusunu yanıtlar. Cihazla konuşan taraf
// `services/pushService.js`.
//
// NEDEN AYRI BİR PLANLAYICI: uygulama içi bildirim merkezi (`notifications.js`)
// kullanıcı uygulamayı AÇTIĞINDA olup biteni gösterir. Telefon bildirimi ise
// uygulama KAPALIYKEN çalmak zorundadır; bu yüzden önceden zamanlanır. Önceden
// zamanlanabilecek TEK dürüst olay, başlama saati zaten bilinen maçtır.
//
// KESİN KURALLAR:
//  1) Uydurma yok. Gerçek başlama saati olmayan maç için bildirim KURULMAZ.
//  2) Yalnız kullanıcının KENDİ kuponunda işaretlediği maçlar hatırlatılır.
//  3) Geçmiş zamana bildirim kurulmaz (kurulursa telefon anında çalar — yanlış).
//  4) Başlamış / resmî sonucu gelmiş maça hatırlatma kurulmaz.
//  5) İddialı dil yok, kupon oynamaya teşvik yok: yalnız "şu maç birazdan
//     başlıyor" denir. "kesin/garanti/banko/net favori" gibi kelimeler geçmez.
//  6) Metinde kişisel veri yok: e-posta, telefon, belirteç, kullanıcı adı, puan
//     yazılmaz. Yalnız bültende zaten herkese açık olan maç no / takım / saat.
//  7) Sonucu ÖNCEDEN bildiren bildirim kurulmaz — sonuç gelecekte oluşur,
//     zamanlanmış metin onu bilemez (bilirmiş gibi yazmak sahtelik olurdu).

import { isOfficial, seciliMacNolari } from './notifications';

/** Varsayılan: maç başlamadan 60 dk önce (bildirim merkeziyle aynı pencere). */
export const VARSAYILAN_ONCE_DK = 60;

// iOS bekleyen yerel bildirimde 64 sınırına takılır ve fazlasını SESSİZCE atar.
// 15 maçlık bültende bu sınıra yaklaşmayız; yine de üst sınır koyuyoruz ki
// beklenmedik veride sessiz kayıp yaşanmasın (atılanlar raporlanır).
export const EN_FAZLA_BILDIRIM = 32;

function toTime(v) {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
}

function saatMetni(ms) {
  try {
    return new Date(ms).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function takimAdi(x) {
  if (!x) return '';
  if (typeof x === 'string') return x.trim();
  return String(x.name || '').trim();
}

function haftaKimlik(bulletin) {
  if (bulletin?.roundId != null) return bulletin.roundId;
  if (bulletin?.round && typeof bulletin.round === 'object' && bulletin.round.id != null) return bulletin.round.id;
  return null;
}

/** Maç hatırlatmasının varsayılan başlığı (üretim). */
export const MAC_BASLIK = 'Kuponundaki maç birazdan başlıyor';

/**
 * Bülten kaydını bildirime uygun hâle getirir.
 *
 * @returns {{no:number, ev:string, dep:string, baslama:number}|null}
 *          null → numara, başlama saati ya da takım adı eksik. Bu durumda
 *          bildirim UYDURULMAZ; kayıt atlanır.
 */
export function macBilgisi(m) {
  const no = Number(m?.no);
  if (!Number.isInteger(no) || no <= 0) return null;
  const baslama = toTime(m?.date);
  if (baslama == null) return null;              // saat yoksa UYDURMA
  const ev = takimAdi(m?.home);
  const dep = takimAdi(m?.away);
  if (!ev || !dep) return null;
  return { no, ev, dep, baslama };
}

/**
 * `match-starting` bildiriminin BAŞLIK / GÖVDE / VERİ'si — TEK KAYNAK.
 *
 * Hem üretimdeki 60 dakikalık hatırlatma hem de geliştirme testi
 * (`pushDevTest.js`) bu işlevi kullanır; böylece testte telefona düşen bildirim,
 * üretimdekinden BAŞKA bir yoldan üretilmiş olmaz. Gövdede yalnız maç numarası,
 * takım adları ve saat bulunur — tahmin, kupon seçimi, kullanıcı, e-posta ya da
 * oturum bilgisi geçmez.
 *
 * @param {{no:number, ev:string, dep:string, baslama:number, baslik?:string}} g
 */
export function macBildirimIcerigi({ no, ev, dep, baslama, baslik = MAC_BASLIK }) {
  return {
    // Not: "başlıyor" haber cümlesidir; tahmin ya da tavsiye içermez.
    title: baslik,
    body: `${no}. ${ev} – ${dep} · ${saatMetni(baslama)}`,
    data: { tab: 'BulletinTab', screen: 'LiveMatchDetail', params: { no }, kind: 'match-starting' },
  };
}

/**
 * Kurulacak YEREL bildirimlerin planı.
 *
 * Dönen her kayıt: { id, fireAt, title, body, data }
 *  - id     : kararlı kimlik ("mac:<hafta>:<macNo>") — tekrar kurulmayı önler
 *  - fireAt : telefonun çalacağı an (ms, gelecekte)
 *
 * @param {object} g
 * @param {number} g.now                şu an (ms) — dışarıdan verilir (test edilebilir)
 * @param {object} [g.bulletin]         güncel bülten { roundId, matches: [{no, date, home, away, status}] }
 * @param {Array}  [g.coupons]          kullanıcının o haftaki kuponları
 * @param {number} [g.onceDk]           kaç dakika önce hatırlatılsın
 * @param {number} [g.enFazla]          üst sınır
 * @returns {{items: Array, atlanan: {saatYok:number, gecmis:number, basladi:number, sinir:number}}}
 */
export function planMatchReminders({
  now = 0,
  bulletin = null,
  coupons = [],
  onceDk = VARSAYILAN_ONCE_DK,
  enFazla = EN_FAZLA_BILDIRIM,
} = {}) {
  const atlanan = { saatYok: 0, gecmis: 0, basladi: 0, sinir: 0 };
  const maclar = Array.isArray(bulletin?.matches) ? bulletin.matches : [];
  const secili = seciliMacNolari(coupons);

  // Kupon yoksa hatırlatma da yoktur — "her maçı bildir" davranışı kullanıcının
  // istemediği bir bildirim yağmuru olurdu.
  if (!secili.size || !maclar.length) return { items: [], atlanan };

  const hafta = haftaKimlik(bulletin);
  const oncesiMs = Math.max(0, Number(onceDk) || 0) * 60 * 1000;
  const gorulen = new Set();
  const items = [];

  for (const m of maclar) {
    if (!secili.has(Number(m?.no))) continue;

    // Başlamış ya da resmîleşmiş maça hatırlatma kurulmaz.
    if (m?.status === 'finished' || m?.status === 'live' || isOfficial(m)) { atlanan.basladi += 1; continue; }

    // Numara / saat / takım adı eksikse bildirim UYDURULMAZ.
    const bilgi = macBilgisi(m);
    if (!bilgi) { atlanan.saatYok += 1; continue; }
    const { baslama } = bilgi;

    const fireAt = baslama - oncesiMs;
    // Geçmişe kurulan bildirim telefonu ANINDA çaldırır — kurmuyoruz.
    // Maçın kendisi de geçmişte kalmışsa zaten hatırlatılacak bir şey yok.
    if (fireAt <= now || baslama <= now) { atlanan.gecmis += 1; continue; }

    const id = `mac:${hafta ?? '?'}:${bilgi.no}`;
    if (gorulen.has(id)) continue;
    gorulen.add(id);

    items.push({ id, fireAt, ...macBildirimIcerigi(bilgi) });
  }

  items.sort((a, b) => a.fireAt - b.fireAt);
  if (items.length > enFazla) {
    atlanan.sinir = items.length - enFazla;
    items.length = enFazla;
  }
  return { items, atlanan };
}

/**
 * Planla cihazda HÂLİHAZIRDA kurulu olanları karşılaştırır.
 *
 * Neden gerekli: her açılışta hepsini silip yeniden kurmak, aynı bildirimin
 * kısa süre için kaybolmasına ve (saat değiştiyse) yanlış anda çalmasına yol
 * açar. Burada yalnız GERÇEKTEN değişen kayıtlar dokunulur.
 *
 * @param {Array} planlanan  planMatchReminders() çıktısındaki items
 * @param {Array} kurulu     [{ id, fireAt }] — cihazdan okunan mevcut kayıtlar
 */
export function diffSchedule(planlanan = [], kurulu = []) {
  const planMap = new Map(planlanan.map((p) => [p.id, p]));
  const kuruluMap = new Map((kurulu || []).filter((k) => k && k.id).map((k) => [k.id, k]));

  const kurulacak = [];
  for (const [id, p] of planMap) {
    const mevcut = kuruluMap.get(id);
    // Saat değiştiyse (maç ertelendi/öne alındı) eski kayıt iptal edilip yenisi kurulur.
    if (!mevcut || Number(mevcut.fireAt) !== Number(p.fireAt)) kurulacak.push(p);
  }

  const iptal = [];
  for (const [id, k] of kuruluMap) {
    const p = planMap.get(id);
    if (!p || Number(p.fireAt) !== Number(k.fireAt)) iptal.push(id);
  }

  return { kurulacak, iptal };
}
