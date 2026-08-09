// KAYNAK: app/src/security/passwordStrength.js
//
// Koruduğu kural: kullanıcıya DÜRÜST geri bildirim. "Güçlü" etiketi bir
// garanti değildir; yaygın kalıplar puanı DÜŞÜRÜR ve sebebi yazılır.
// Şifre hiçbir yere gitmez — hesap yalnız cihazda, anlık yapılır.

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/security/password_strength.dart';

void main() {
  test('boş şifre: puan 0, "Şifre gir", asgari uzunluk ipucu', () {
    final r = passwordStrength('');
    expect(r.score, 0);
    expect(r.label, 'Şifre gir');
    expect(r.color, 'red');
    expect(r.ok, isFalse);
    expect(r.hints.first, 'En az $kMinPasswordLength karakter');
  });

  test('kısa şifre geçerli değil ve puanı 1 ile sınırlanır', () {
    final r = passwordStrength('Ab1');
    expect(r.ok, isFalse);
    expect(r.score, lessThanOrEqualTo(1));
    expect(r.label, 'Zayıf');
    expect(
      r.hints.any((h) => h.contains('En az $kMinPasswordLength karakter')),
      isTrue,
    );
  });

  test('8 karakter + harf/rakam → geçerli', () {
    final r = passwordStrength('abcd1234');
    expect(r.ok, isTrue);
    // uzunluk(1) + çeşitlilik≥2(1) = 2 → "Orta"
    expect(r.score, 2);
    expect(r.label, 'Orta');
    expect(r.color, 'orange');
  });

  test('uzun + çok çeşitli → Güçlü', () {
    final r = passwordStrength('Uzun-Sifre-2026!');
    expect(r.ok, isTrue);
    expect(r.score, 4);
    expect(r.label, 'Güçlü');
    expect(r.color, 'green');
  });

  test('YAYGIN KALIP puanı düşürür ve sebebi yazılır', () {
    // Uzun ve çeşitli olsa bile "password" ile başlıyor.
    final r = passwordStrength('password1234!A');
    expect(r.score, lessThanOrEqualTo(1));
    expect(
      r.hints.any((h) => h.contains('çok yaygın')),
      isTrue,
      reason: 'kullanıcıya NEDEN zayıf olduğu söylenmeli',
    );
  });

  test('tek karakterin tekrarı yaygın sayılır', () {
    final r = passwordStrength('aaaaaaaaaaaa');
    expect(r.score, lessThanOrEqualTo(1));
    expect(r.hints.any((h) => h.contains('çok yaygın')), isTrue);
  });

  test('Türkçe harfler çeşitlilik sayımında doğru sınıflanır', () {
    // ç/ğ/ı/ö/ş/ü küçük harf sayılır, ÇĞİÖŞÜ büyük harf sayılır;
    // ikisi de "özel karakter" sayılmamalı.
    final r = passwordStrength('çğışöüÇĞİ');
    expect(r.ok, isTrue);
    // uzunluk(1) + çeşitlilik 2 (küçük+büyük) → 1 + 1 = 2
    expect(r.score, 2);
  });
}
