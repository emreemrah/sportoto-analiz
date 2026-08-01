// GÜVENLİ HATA CEVABI — iç hata metni istemciye SIZMAZ.
//
// Supabase/pg hataları tablo, sütun ve kısıt adlarını mesajın içinde taşır
// ("duplicate key value violates unique constraint \"comments_pkey\"" gibi).
// Bu metin istemciye dönerse iç şema dışarı sızar (güvenlik denetimi O-1).
// Kural: istemci JENERİK Türkçe mesaj alır; ayrıntı yalnız sunucu logunda.
//
// DİKKAT: Kendi tipli hatalarımız (NotFoundError/ValidationError/Immutable...)
// bilerek kullanıcıya dönen Türkçe mesajlar taşır — onlar bu yardımcıdan
// GEÇMEZ (bkz. routes/bulletins.js hataCevabi). Bu yardımcı yalnız
// dış-katman (Supabase/pg/fetch) hataları içindir.
export function safeError(res, err, publicMsg = 'İşlem şu an tamamlanamadı. Lütfen tekrar dene.', status = 500) {
  // Ayrıntı SUNUCUDA kalır: yol + iç mesaj (parola/token içermez; Supabase
  // hata metinleri kimlik bilgisi taşımaz, şema adı taşır).
  console.error(`[api${res.req?.path ? ' ' + res.req.path : ''}]`, publicMsg, '→', err?.message || err);
  return res.status(status).json({ error: publicMsg });
}
