// MÜHÜR BEKÇİSİ — sunucuyu mühür anında UYANIK tutar.
// ---------------------------------------------------------------------------
// SORUN (ölçüldü, 22 Ağustos 2026): mühür, sunucunun freezeAt anında ÇALIŞIYOR
// olmasına bağlı. Render ücretsiz planda 15 dakika hareketsizlikte uykuya
// geçiyor; maç akşamı uygulamayı kimse açmazsa mühür hiç atılmıyor. Açılışta
// telafi eden mühür ise maçtan SONRA atılmış oluyor ve provenance kapısı onu
// haklı olarak karne dışında tutuyor (`late_lock`). Üretimde ölçülen bilanço:
// 3 hafta `late_unverified` — kaybedilen hafta, kaybedilen ölçüm.
//
// ÇÖZÜM: mühür anından kısa süre önce sunucuyu dışarıdan uyandırmak.
//
// NEDEN RENDER'I SÜREKLİ PINGLEMİYORUZ: ücretsiz plan 750 instance-saat/ay
// verir; 7/24 uyanık tutmak (~730 saat) bütçenin tamamını yer ve servis ayın
// sonunda askıya alınabilir — mevcut sorundan daha kötüsü. Bu yüzden bekçi
// ÖNCE Spor Toto'ya sorar (Render'a dokunmadan), mühür yaklaşmadıysa HİÇ
// uyandırmadan çıkar. Uyandırma yalnız pencerede olur: ayda ~1 saat.
//
// KULLANIM: .github/workflows/muhur-uyandirma.yml içinden çalışır.
//   node backend/scripts/muhur-bekcisi.mjs
// Ortam: API_URL (varsayılan üretim), ONCE_DK, KUYRUK_DK, ARALIK_SN.
import { getLatestBulletin } from '../src/sources/sportoto.js';
import { macAniMs } from '../src/time/turkiyeSaati.js';
import { FREEZE_BEFORE_MS } from '../src/archive/constants.js';
import { pathToFileURL } from 'node:url';

const API = (process.env.API_URL || 'https://sportoto-analiz.onrender.com').replace(/\/+$/, '');
const ONCE_MS = Number(process.env.ONCE_DK || 40) * 60 * 1000;   // pencere başlangıcı
const KUYRUK_MS = Number(process.env.KUYRUK_DK || 10) * 60 * 1000; // mühürden sonra
const ARALIK_MS = Number(process.env.ARALIK_SN || 60) * 1000;

/**
 * Şu an mühür penceresinde miyiz?
 *
 * Bu fonksiyon bekçinin TEK kararıdır: yanlışsa ya mühür kaçar (hafta karne
 * dışı kalır) ya da sunucu boşuna uyanık tutulur (instance-saat bütçesi yenir).
 * Bu yüzden ağdan ayrı, saf ve testli tutulur.
 */
/**
 * Hüküm → süreç çıkış kodu.
 *
 * Bekçinin sonucu yalnız log'da dursaydı görünmezdi: iş akışı log'unu okumak
 * kimlik doğrulaması ister. Çıkış kodu ise koşunun `conclusion` alanına
 * yansır ve herkese açık API'den okunur; ayrıca GitHub başarısız zamanlanmış
 * iş akışı için kendiliğinden bildirim yollar.
 *
 * Bilinmeyen hüküm DİKKAT sayılır: sessiz yeşil, kaçırılmış mühür demektir.
 */
export function hukumKodu(hukum) {
  return hukum === 'bilgi' || hukum === 'tamam' ? 0 : 1;
}

export function pencereDurumu(now, freezeMs, { onceMs, kuyrukMs } = {}) {
  if (!Number.isFinite(freezeMs)) return 'bilinmiyor';
  if (now < freezeMs - onceMs) return 'erken';
  if (now > freezeMs + kuyrukMs) return 'gecti';
  return 'acik';
}

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
const saat = (t) => new Date(t).toISOString().slice(11, 19);

async function ping(yol) {
  const t0 = Date.now();
  try {
    const r = await fetch(`${API}${yol}`, { signal: AbortSignal.timeout(60_000) });
    const govde = await r.text();
    return { ok: r.ok, kod: r.status, sure: Date.now() - t0, govde };
  } catch (e) {
    return { ok: false, kod: 0, sure: Date.now() - t0, hata: e.message };
  }
}

async function main() {
  // 1) MÜHÜR ANI — Spor Toto'dan doğrudan. Render'a DOKUNULMAZ.
  const bulletin = await getLatestBulletin();
  if (!bulletin?.published || !bulletin.matches?.length) {
    console.log('[bekçi] teyitli bülten yok — yapılacak iş yok.');
    return 'bilgi';
  }
  const kickoffs = bulletin.matches.map((m) => macAniMs(m.date)).filter(Number.isFinite);
  if (!kickoffs.length) {
    console.log('[bekçi] maç saati okunamadı — çıkılıyor.');
    return 'bilgi';
  }
  const freezeMs = Math.min(...kickoffs) - FREEZE_BEFORE_MS;
  const now = Date.now();
  const kalanDk = Math.round((freezeMs - now) / 60000);
  console.log(`[bekçi] ${bulletin.year} ${bulletin.round} (round ${bulletin.roundId}) · mühür ${new Date(freezeMs).toISOString()} · kalan ${kalanDk} dk`);

  // 2) PENCERE DIŞINDAYSA HİÇ UYANDIRMA — instance-saat bütçesinin korunması.
  const durum = pencereDurumu(now, freezeMs, { onceMs: ONCE_MS, kuyrukMs: KUYRUK_MS });
  if (durum === 'erken') {
    console.log(`[bekçi] pencere açılmadı (${Math.round(ONCE_MS / 60000)} dk kala açılır) — sunucuya dokunulmadı.`);
    return 'bilgi';
  }
  if (durum === 'gecti') {
    console.log('[bekçi] mühür penceresi geçti — sunucuya dokunulmadı.');
    return 'bilgi';
  }

  // 3) PENCEREDEYİZ: mühür anı geçene kadar uyanık tut.
  const bitis = freezeMs + KUYRUK_MS;
  console.log(`[bekçi] pencere AÇIK — ${new Date(bitis).toISOString()} kadar uyanık tutulacak.`);
  let tur = 0;
  while (Date.now() < bitis) {
    tur += 1;
    const r = await ping('/api/health');
    const veri = r.govde?.includes('"hasData":true') ? 'veri var' : 'veri yok';
    console.log(`[bekçi] ${saat(Date.now())} #${tur} → HTTP ${r.kod} (${r.sure} ms) ${r.ok ? veri : r.hata}`);
    const kalan = bitis - Date.now();
    if (kalan <= 0) break;
    await bekle(Math.min(ARALIK_MS, kalan));
  }

  // 4) MÜHÜR GERÇEKTEN ATILDI MI — bekçinin işe yarayıp yaramadığı burada
  // belli olur. "Uyandırdım" demek yetmez; kanıt mührün ZAMANINDA atılmış
  // olmasıdır. Dönen değer çıkış koduna çevrilir (aşağıya bakınız).
  const b = await ping('/api/bulletin');
  if (!b.ok) {
    console.log(`[bekçi] ⚠ bülten okunamadı (HTTP ${b.kod}) — mühür doğrulanamadı.`);
    return 'dikkat';
  }
  let arsiv = null;
  try { arsiv = JSON.parse(b.govde)?.archive ?? null; } catch { /* gövde bozuksa aşağıda bildirilir */ }
  if (!arsiv) {
    console.log('[bekçi] ⚠ arşiv durumu okunamadı.');
    return 'dikkat';
  }
  const gec = arsiv.snapshot?.late === true;
  console.log(`[bekçi] arşiv: durum=${arsiv.status} · kilit=${arsiv.lockedAt ?? '-'} · geç=${gec}`);
  if (arsiv.status === 'locked' && !gec) {
    console.log('[bekçi] ✅ mühür ZAMANINDA atıldı — hafta karneye girebilir.');
    return 'tamam';
  }
  if (gec) {
    console.log('[bekçi] ⚠ mühür GEÇ atılmış — bu hafta karne dışı kalır (late_lock).');
    return 'dikkat';
  }
  console.log(`[bekçi] ⚠ mühür henüz atılmadı (durum: ${arsiv.status}).`);
  return 'dikkat';
}

// YALNIZ DOĞRUDAN ÇALIŞTIRILDIĞINDA KOŞAR.
// `pencereDurumu` testten import ediliyor; koruma olmadan import ağ çağrısı
// tetikliyor ve test paketi Spor Toto'ya gerçek istek atıyordu.
const dogrudan = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (dogrudan) {
  // HÜKÜM ÇIKIŞ KODUNA YAZILIR.
  //
  // NEDEN: bekçinin sonucu yalnız iş akışı LOG'unda duruyordu ve log okumak
  // kimlik doğrulaması ister. Sonucu çıkış koduna taşımak iki şey kazandırır:
  //  * GitHub, başarısız zamanlanmış iş akışı için KENDİSİ bildirim yollar —
  //    ayrıca bir izleme kurmaya gerek kalmaz.
  //  * Koşunun `conclusion` alanı herkese açık API'den okunabilir; log'a
  //    erişemeyen bir denetçi bile mührün tutup tutmadığını görebilir.
  //    (Ölçüldü 22 Ağu 2026: bulut ortamı sunucunun adresine çıkamıyor,
  //    GitHub API'sini okuyabiliyor — tek okunabilir sinyal bu.)
  //
  // 'dikkat' = pencere çalıştı ama mühür ZAMANINDA atılmadı ya da
  // doğrulanamadı. Bu bir arızadır ve görünür olmalıdır.
  // 'bilgi'  = yapılacak iş yoktu (pencere kapalı) — yeşil.
  // 'tamam'  = mühür zamanında atıldı — yeşil.
  main()
    .then((hukum) => {
      const kod = hukumKodu(hukum);
      if (kod !== 0) {
        console.error('[bekçi] SONUÇ: DİKKAT — mühür zamanında atılmadı ya da doğrulanamadı.');
        process.exit(kod);
      }
      console.log(`[bekçi] SONUÇ: ${hukum === 'tamam' ? 'TAMAM' : 'yapılacak iş yok'}.`);
    })
    .catch((e) => {
      // Bekçi çökerse iş akışı KIRMIZI olsun — sessiz başarısızlık, mührü
      // kaçırmak demektir ve haftalar sonra "neden karne boş" diye aranır.
      console.error('[bekçi] HATA:', e?.message || e);
      process.exit(1);
    });
}
