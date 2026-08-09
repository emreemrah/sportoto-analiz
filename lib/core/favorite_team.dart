// KAYNAK: app/src/favoriteTeam.js — BİREBİR çeviri.
//
// FAVORİ TAKIM EŞLEŞTİRME — saf modül.
// Profildeki serbest metinli "favori takım" alanı, bültendeki resmî takım
// adlarıyla esnek ama TEMKİNLİ eşleştirilir: kısacık girdilerle yanlış eşleşme
// olmasın diye en az 3 karakter aranır.

/// Kaynaktaki `norm`. Türkçe küçük harf dönüşümü Dart'ta yerleşik değildir:
/// 'I'.toLowerCase() Dart'ta 'i' verir, oysa Türkçe'de 'ı' olmalıdır. Kaynak
/// `toLocaleLowerCase('tr-TR')` kullandığı için burada elle karşılanır —
/// yoksa "Istanbul" ile "ıstanbul" eşleşmez ve favori takım sessizce tutmazdı.
String _norm(String? s) {
  final tr = (s ?? '').replaceAll('I', 'ı').replaceAll('İ', 'i').toLowerCase();
  return tr
      .replaceAll(RegExp(r'[^a-zçğıöşü0-9 ]'), ' ')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
}

/// Takım adı, kullanıcının favori takımıyla eşleşiyor mu?
bool isFavoriteTeam(String? teamName, String? favorite) {
  final t = _norm(teamName);
  final f = _norm(favorite);
  if (t.length < 3 || f.length < 3) return false;
  return t.contains(f) || f.contains(t);
}

/// Maçta favori takım oynuyor mu? → 'home' | 'away' | null
String? favoriteSide(Map? match, String? favorite) {
  if (favorite == null || favorite.isEmpty) return null;

  List<String> names(Object? t) {
    if (t is! Map) return const [];
    return [
      t['name'],
      t['mediumName'],
      t['shortName'],
    ].whereType<String>().where((s) => s.isNotEmpty).toList();
  }

  if (names(match?['home']).any((n) => isFavoriteTeam(n, favorite))) {
    return 'home';
  }
  if (names(match?['away']).any((n) => isFavoriteTeam(n, favorite))) {
    return 'away';
  }
  return null;
}
