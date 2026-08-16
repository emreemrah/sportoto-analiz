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

// ───────────────────────────────────────────────────────────────────────────
// ARMA ADRESİNDEN ÜLKE (yedek yol — 16 Ağustos 2026, kullanıcı isteği)
//
// Resmî Spor Toto bülteni bazı maçlarda lig adını genel bir metinle yazar
// ("Final", "2026/2027 Sezonu"). O metinden ülke çıkmadığı için kartlarda
// bayrak yerine nötr top kalıyordu.
//
// Kulüp armasının adresi sağlayıcının kendi düzeninde ÜLKE ÖN EKİ taşır
// (".../teams/france-olympique-de-marseille.png"). Bu ön ek uydurma değil,
// armanın kendi kimliğidir; lig adı ülke vermediğinde yedek kaynak olur.
//
// SINIRI AÇIK: bu, KULÜBÜN ülkesidir — turnuvanın ülkesi değil. İki kulüp
// FARKLI ülkedense (uluslararası karşılaşma) ülke BELİRSİZDİR ve hiçbir
// bayrak basılmaz; yanlış bayrak, bayraksızlıktan kötüdür.
// ───────────────────────────────────────────────────────────────────────────

/// Ülke ön ekleri UZUNDAN KISAYA denenir ki "Czech Republic" ile "Czechia"
/// birbirini gölgelemesin.
final List<String> _ulkeOnEkleri = kEnTr.keys.toList()
  ..sort((a, b) => b.length.compareTo(a.length));

/// Arma adresindeki ülke ön ekinden İngilizce ülke adı. Bulunamazsa null.
String? armaUlkesiEn(String? armaAdresi) {
  final adres = (armaAdresi ?? '').trim();
  if (adres.isEmpty) return null;
  final dosya = adres.split('?').first.split('/').last.toLowerCase();
  if (dosya.isEmpty) return null;
  for (final en in _ulkeOnEkleri) {
    if (dosya.startsWith('${en.toLowerCase().replaceAll(' ', '-')}-')) {
      return en;
    }
  }
  return null;
}

/// Maçın iki armasından ORTAK ülke. Biri bilinmiyorsa diğeri kullanılır;
/// ikisi de biliniyor ve farklıysa (uluslararası maç) null döner.
String? macArmaUlkesiEn(String? evArma, String? deplasmanArma) {
  final ev = armaUlkesiEn(evArma);
  final dep = armaUlkesiEn(deplasmanArma);
  if (ev != null && dep != null) return ev == dep ? ev : null;
  return ev ?? dep;
}

/// Maç kaydından (bülten ya da geçmiş hafta) ortak ülke.
String? macUlkesiEn(Map? m) => macArmaUlkesiEn(
  _armaAdresi(m, 'home'),
  _armaAdresi(m, 'away'),
);

String? _armaAdresi(Map? m, String taraf) {
  final stats = m?['stats'];
  if (stats is Map) {
    final s = stats[taraf];
    if (s is Map && s['logo'] is String && (s['logo'] as String).isNotEmpty) {
      return s['logo'] as String;
    }
  }
  final t = m?[taraf];
  if (t is Map && t['logo'] is String) return t['logo'] as String;
  return null;
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
    var u = ulkeAyikla(m?['league'] as String?);
    // Lig adı ülke vermediyse armadan türet — böylece "Final" / "2026/2027
    // Sezonu" gibi maçlar şeritte ülkesiz bir çip olarak kalmaz, ait oldukları
    // ülkenin altında sayılır.
    if (u?.en == null) {
      final yedek = macUlkesiEn(m);
      if (yedek != null) u = UlkeBilgi(name: kEnTr[yedek]!, en: yedek);
    }
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
