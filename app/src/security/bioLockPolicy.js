// BİYOMETRİK KİLİT POLİTİKASI — SAF MODÜL (React Native bağımlılığı YOK;
// düz Node testinde çalışır). Cihaza dokunan sarmalayıcı: biometricLock.js
//
// KESİN KURALLAR
//   • Biyometrik veri (parmak izi/yüz) uygulamaya ASLA girmez, kaydedilmez,
//     ağa gönderilmez — doğrulamayı cihazın kendi güvenli sistemi yapar;
//     uygulamaya yalnız "başarılı/başarısız" sonucu döner.
//   • Kilit yalnız KULLANICI AÇARSA etkindir (varsayılan: kapalı).
//   • Doğrulama başarısız olursa güvenli alternatif her zaman sunulur:
//     şifreyle yeniden giriş (oturum kapatılır, şifre istenir).

/** Cihazda biyometrik kilit SEÇENEĞİ sunulabilir mi? */
export function canOfferBiometrics({ platform, hasHardware, enrolled }) {
  if (platform === 'web') return false;          // web'de cihaz kilidi yok
  return !!hasHardware && !!enrolled;            // donanım + kayıtlı biyometri şart
}

/**
 * Açılışta kilit gerekli mi?
 * Yalnız: kullanıcı girişli + kilidi kendisi açmış + cihaz destekliyor.
 */
export function shouldLockOnLaunch({ loggedIn, enabled, supported }) {
  return !!loggedIn && !!enabled && !!supported;
}

// Üst üste bu kadar başarısızlıkta şifreyle giriş ÖNE ÇIKARILIR
// (buton her denemede zaten görünür; bu eşik yalnız vurguyu değiştirir).
export const FAILURE_EMPHASIS_THRESHOLD = 2;

/** Başarısız denemeden sonra ne yapılmalı? */
export function afterFailure(attempts) {
  return {
    allowRetry: true,                                        // deneme hakkı kısıtlanmaz
    emphasizePasswordFallback: attempts >= FAILURE_EMPHASIS_THRESHOLD,
  };
}

/** Cihaz doğrulama sonucunu tek tip duruma çevirir. */
export function outcomeFromResult(result) {
  if (result?.success) return 'unlocked';
  // Kullanıcı vazgeçti ya da eşleşmedi — ikisinde de kilit SÜRER.
  return 'locked';
}
