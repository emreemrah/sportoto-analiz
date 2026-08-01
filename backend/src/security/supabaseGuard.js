// ÜYELİK SİSTEMİ KAPIŞI
//
// Üyelik/profil verisi Supabase'de tutulur. Supabase yapılandırılmamışsa
// (SUPABASE_URL / anahtarlar yoksa) `sbAdmin` null olur. Bunu kontrol etmeyen
// bir rota `sbAdmin.from(...)` çağırınca TypeError fırlatır.
//
// Bu kapı olmadan sonuç ölçüldü: giriş bile gerektirmeyen
// `GET /api/comments?matchId=...` isteği backend sürecini komple çökertiyordu.
// asyncGuard artık süreci ayakta tutuyor ama istemciye "beklenmeyen hata"
// dönerdi. Doğru yanıt bu değil: sorun beklenmeyen değil, BİLİNEN bir
// yapılandırma eksiği. O yüzden 503 + açık Türkçe mesaj döner.
//
// muaf: Supabase kapalıyken de çalışması GEREKEN yollar (kendi zarif boş
// yanıtını veren uçlar). Örn. /ms-summary bülten kartlarında 15 maç için
// çağrılır; kapalıyken boş özet dönmesi doğru davranıştır, hata değil.
export function uyelikKapisi(supabaseAcik, muaf = []) {
  const muafKume = new Set(muaf);
  return (req, res, next) => {
    if (supabaseAcik) return next();
    if (muafKume.has(req.path)) return next();
    return res.status(503).json({ error: 'Üyelik sistemi şu an kullanılamıyor.' });
  };
}
