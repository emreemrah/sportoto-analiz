// KAYNAK: app/src/security/passwordStrength.js — BİREBİR çeviri.
//
// ŞİFRE GÜCÜ — SAF MODÜL (Flutter bağımlılığı YOK; düz testte çalışır).
//
// Amaç kullanıcıya DÜRÜST geri bildirim vermektir; "güçlü" etiketi bir garanti
// değildir ve şifre hiçbir yerde saklanmadığı için bu hesap yalnız cihazda,
// anlık olarak yapılır — şifre ağa/loga/depoya YAZILMAZ.

const int kMinPasswordLength = 8;

/// 'red' | 'orange' | 'yellow' | 'green'
typedef PasswordStrengthResult = ({
  int score,
  String label,
  String color,
  bool ok,
  List<String> hints,
});

/// Şifre gücünü 0-4 arası puanlar.
PasswordStrengthResult passwordStrength(String? pw) {
  final s = pw ?? '';
  final hints = <String>[];

  if (s.isEmpty) {
    return (
      score: 0,
      label: 'Şifre gir',
      color: 'red',
      ok: false,
      hints: ['En az $kMinPasswordLength karakter'],
    );
  }

  var score = 0;
  if (s.length >= kMinPasswordLength) {
    score += 1;
  } else {
    hints.add('En az $kMinPasswordLength karakter olmalı');
  }
  if (s.length >= 12) score += 1;

  final variety = [
    RegExp(r'[a-zçğıöşü]').hasMatch(s),
    RegExp(r'[A-ZÇĞİÖŞÜ]').hasMatch(s),
    RegExp(r'\d').hasMatch(s),
    RegExp(r'[^A-Za-z0-9çğıöşüÇĞİÖŞÜ]').hasMatch(s),
  ].where((x) => x).length;

  if (variety >= 2) {
    score += 1;
  } else {
    hints.add('Harf + rakam karışımı kullan');
  }
  if (variety >= 3) score += 1;

  // Çok bilinen kalıplar gücü düşürür (dürüst uyarı).
  final yaygin = RegExp(
    r'^(123456|12345678|password|şifre|sifre|qwerty|111111|abc123)',
    caseSensitive: false,
  ).hasMatch(s);
  final tekKarakter = RegExp(r'^(.)\1+$').hasMatch(s);
  if (yaygin || tekKarakter) {
    if (score > 1) score = 1;
    hints.add('Bu şifre çok yaygın; tahmin edilmesi kolay');
  }

  final ok = s.length >= kMinPasswordLength;
  if (!ok && score > 1) score = 1;

  final label = score <= 1
      ? 'Zayıf'
      : score == 2
      ? 'Orta'
      : score == 3
      ? 'İyi'
      : 'Güçlü';
  final color = score <= 1
      ? 'red'
      : score == 2
      ? 'orange'
      : score == 3
      ? 'yellow'
      : 'green';

  return (score: score, label: label, color: color, ok: ok, hints: hints);
}
