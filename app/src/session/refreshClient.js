// OTURUM YENİLEME İSTEMCİSİ — erişim belirteci süresi dolunca kullanıcıdan
// tekrar giriş İSTENMEZ; yenileme anahtarıyla sessizce yeni belirteç alınır.
//
//   • Yenileme anahtarı TEK KULLANIMLIKTIR (rotasyon): her yenilemede yenisi
//     gelir ve kalıcı depoya yazılır.
//   • Sunucu oturumu uzaktan kapatılmışsa yenileme REDDEDİLİR → oturum burada
//     da temizlenir ve kullanıcı giriş ekranına düşer (güvenli davranış).
//   • Tek uçuş (single-flight): aynı anda birden çok 401 gelirse tek yenileme
//     yapılır; diğer istekler onu bekler.
import { API_BASE } from '../config';
import {
  getRefreshToken, getSessionId, isCookieMode, setSession, clearSession,
} from './tokenState';
import { persistSession, clearPersisted } from './tokenStore';

let inflight = null;

export async function tryRefresh() {
  if (inflight) return inflight; // tek uçuş
  inflight = (async () => {
    const refreshToken = getRefreshToken();
    const cookieMode = isCookieMode();
    if (!refreshToken && !cookieMode) return false;
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({
          refreshToken: cookieMode ? undefined : refreshToken,
          sessionId: getSessionId() || undefined,
          cookieMode: cookieMode || undefined,
        }),
      });
      if (!res.ok) {
        // OTURUM YALNIZ KİMLİK REDDEDİLDİĞİNDE SİLİNİR.
        //
        // Eski hâl HER `!res.ok` durumunda yerel oturumu siliyordu. Sunucudan
        // gelen GEÇİCİ bir hata — 500/502/503/504 (dağıtım, yeniden başlatma)
        // ya da 429 (hız sınırı) — kullanıcıyı oturumdan atıyordu; oysa
        // belirteç hâlâ geçerliydi ve birkaç saniye sonra çalışacaktı.
        //
        // Sunucu, oturum gerçekten geçersizse 401 döner (süresi doldu ya da
        // kapatılmış); 400 de kalıcıdır (anahtar hiç gönderilmemiş). Diğer
        // her durum GEÇİCİ sayılır → yerel oturum KORUNUR ve çağıran mevcut
        // belirteçle devam etmeyi dener.
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          clearSession();
          await clearPersisted();
        }
        return false;
      }
      const data = await res.json();
      setSession({
        token: data.token || null,
        refreshToken: data.refreshToken || null,
        cookieMode: !!data.cookieMode,
      });
      await persistSession({
        token: data.token,
        refreshToken: data.refreshToken,
        sessionId: getSessionId(),
        cookieMode: !!data.cookieMode,
      });
      return true;
    } catch {
      return false; // ağ hatası: mevcut belirteçle devam denenebilir
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
