// KAYNAK: app/src/ulkeSeridi.js — BİREBİR çeviri.
//
// ÜLKE ŞERİDİ MANTIĞI — saf modül (Flutter bağımlılığı YOK, ayrıca test edilir).
//
// Kaynaktaki lig adları İngilizce ülkeyle başlar ("Denmark Superliga");
// buradan ülke çıkarılır ve Türkçe adı yazılır. Tanınmayan lig adı OLDUĞU GİBİ
// gösterilir — ülke uydurulmaz. "Kulüp Maçları" bizim kendi etiketimiz,
// ülkesi yoktur, "Kulüp" olarak nötr simgeyle görünür.

import 'utils.dart';

const String kKulupEtiketi = 'Kulüp Maçları';

/// İngilizce ülke adı → Türkçe görünen ad. Yalnız gerçekten karşılaşılabilecek
/// adlar; eşleşmeyen lig adı aynen kalır (dürüstlük: çeviri uydurulmaz).
const Map<String, String> kEnTr = {
  'Denmark': 'Danimarka',
  'Finland': 'Finlandiya',
  'Sweden': 'İsveç',
  'Norway': 'Norveç',
  'Poland': 'Polonya',
  'England': 'İngiltere',
  'Scotland': 'İskoçya',
  'Germany': 'Almanya',
  'Spain': 'İspanya',
  'Italy': 'İtalya',
  'France': 'Fransa',
  'Netherlands': 'Hollanda',
  'Portugal': 'Portekiz',
  'Belgium': 'Belçika',
  'Turkey': 'Türkiye',
  'Austria': 'Avusturya',
  'Switzerland': 'İsviçre',
  'Iceland': 'İzlanda',
  'Ireland': 'İrlanda',
  'Czech Republic': 'Çekya',
  'Czechia': 'Çekya',
  'Croatia': 'Hırvatistan',
  'Greece': 'Yunanistan',
  'Hungary': 'Macaristan',
  'Romania': 'Romanya',
  'Bulgaria': 'Bulgaristan',
  'Serbia': 'Sırbistan',
  'Slovakia': 'Slovakya',
  'Slovenia': 'Slovenya',
  'Ukraine': 'Ukrayna',
  'Russia': 'Rusya',
  'Brazil': 'Brezilya',
  'Argentina': 'Arjantin',
  'United States': 'ABD',
  'USA': 'ABD',
  'Japan': 'Japonya',
  'South Korea': 'Güney Kore',
};

class UlkeBilgi {
  const UlkeBilgi({required this.name, this.en});

  /// Görünen ad (Türkçe ya da tanınmadıysa lig adının kendisi).
  final String name;

  /// İngilizce ülke adı; tanınmadıysa null.
  final String? en;
}

/// Lig adından ülke bilgisi çıkarır.
UlkeBilgi? ulkeAyikla(String? league) {
  final ad = (league ?? '').trim();
  if (ad.isEmpty) return null;
  if (ad == kKulupEtiketi) return const UlkeBilgi(name: 'Kulüp');

  final kelimeler = ad.split(RegExp(r'\s+'));
  // Önce iki kelimelik ülke adları ("Czech Republic Fortuna Liga"), sonra tek.
  for (final n in const [2, 1]) {
    if (kelimeler.length < n) continue;
    final aday = kelimeler.take(n).join(' ');
    final tr = kEnTr[aday];
    if (tr != null) return UlkeBilgi(name: tr, en: aday);
  }
  return UlkeBilgi(name: ad); // tanınmadı → lig adı aynen (uydurma yok)
}

class UlkeSatiri {
  const UlkeSatiri({
    required this.name,
    required this.code,
    required this.count,
  });
  final String name;

  /// flagcdn için ISO2; '' → bayrak yok, ⚽ çizilir.
  final String code;
  final int count;
}

/// Bültenden TEKİL ülke listesi (bültendeki ilk görülme sırasıyla).
List<UlkeSatiri> ulkeListesi(List? matches) {
  final gorulen = <String, ({String name, String code, int count})>{};
  for (final raw in matches ?? const []) {
    final m = raw as Map?;
    final u = ulkeAyikla(m?['league'] as String?);
    if (u == null) continue;
    final mevcut = gorulen[u.name];
    if (mevcut != null) {
      gorulen[u.name] = (
        name: mevcut.name,
        code: mevcut.code,
        count: mevcut.count + 1,
      );
    } else {
      gorulen[u.name] = (
        name: u.name,
        code: u.en != null ? countryCode(u.en) : '',
        count: 1,
      );
    }
  }
  return gorulen.values
      .map((e) => UlkeSatiri(name: e.name, code: e.code, count: e.count))
      .toList();
}
