// KAYNAK: app/src/security/bioLockPolicy.js — BİREBİR çeviri.
//
// BİYOMETRİK KİLİT POLİTİKASI — SAF MODÜL (cihaz bağımlılığı YOK; düz Dart
// testinde çalışır). Cihaza dokunan sarmalayıcı: biometric_lock.dart
//
// KESİN KURALLAR
//   • Biyometrik veri (parmak izi/yüz) uygulamaya ASLA girmez, kaydedilmez,
//     ağa gönderilmez — doğrulamayı cihazın kendi güvenli sistemi yapar;
//     uygulamaya yalnız "başarılı/başarısız" sonucu döner.
//   • Kilit yalnız KULLANICI AÇARSA etkindir (varsayılan: kapalı).
//   • Doğrulama başarısız olursa güvenli alternatif her zaman sunulur:
//     şifreyle yeniden giriş (oturum kapatılır, şifre istenir).

/// Cihazda biyometrik kilit SEÇENEĞİ sunulabilir mi?
bool canOfferBiometrics({
  required String platform,
  required bool hasHardware,
  required bool enrolled,
}) {
  if (platform == 'web') return false; // web'de cihaz kilidi yok
  return hasHardware && enrolled; // donanım + kayıtlı biyometri şart
}

/// Açılışta kilit gerekli mi?
/// Yalnız: kullanıcı girişli + kilidi kendisi açmış + cihaz destekliyor.
bool shouldLockOnLaunch({
  required bool loggedIn,
  required bool enabled,
  required bool supported,
}) => loggedIn && enabled && supported;

// Üst üste bu kadar başarısızlıkta şifreyle giriş ÖNE ÇIKARILIR
// (buton her denemede zaten görünür; bu eşik yalnız vurguyu değiştirir).
const int kFailureEmphasisThreshold = 2;

/// Başarısız denemeden sonra ne yapılmalı?
({bool allowRetry, bool emphasizePasswordFallback}) afterFailure(
  int attempts,
) => (
  allowRetry: true, // deneme hakkı kısıtlanmaz
  emphasizePasswordFallback: attempts >= kFailureEmphasisThreshold,
);

/// Cihaz doğrulama sonucunu tek tip duruma çevirir.
///
/// Kaynakta `result?.success` okunuyordu; Flutter'ın `local_auth` paketi
/// doğrudan `bool` döndürür, bu yüzden imza sadeleşti — davranış aynı.
String outcomeFromResult(bool? success) {
  if (success == true) return 'unlocked';
  // Kullanıcı vazgeçti ya da eşleşmedi — ikisinde de kilit SÜRER.
  return 'locked';
}
