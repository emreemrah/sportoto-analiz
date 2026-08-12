// MAÇ TAKİBİ VE MAÇ BAZINDA BİLDİRİM TERCİHLERİ (kullanıcı isteği, 2026-08-11)
//
// Kullanıcı bültendeki her maçı ayrı ayrı takibe alabilsin ve o maça özel
// bildirim türlerini tek tek açıp kapatabilsin istedi: "Galatasaray–Çorum
// maçını takip ediyorsa, yalnızca bu maç için seçtiği bildirimleri alsın;
// diğer maçların ayarları bundan etkilenmesin."
//
// KİMLİK: maçlar `sportotoMatchId` ile anılır — anket oyları ve kupon
// aktarımı da aynı kimliği kullanıyor, böylece bir maç her yerde aynı maçtır.
// Kimlik yoksa bülten sırasına düşülür (eski kayıtlar için).
//
// ═══════════ DÜRÜST SINIR: HANGİ BİLDİRİM GERÇEKTEN DÜŞER? ════════════════
// Bu uygulamanın bildirim katmanı YEREL'dir (`push_service.dart`: "SUNUCUDAN
// GÖNDERİLEN (uzak/push, FCM) bildirim BU DOSYADA YOKTUR"). Telefon kendi
// saatiyle çalar; internet ya da sunucu gerekmez.
//
// Bunun doğrudan sonucu: ÖNCEDEN saati bilinen bir olay hatırlatılabilir
// (maçın başlama saati), ama maç sırasında OLUŞAN olaylar (gol, kart, ilk
// yarı, sonuç…) önceden zamanlanamaz — onları göndermek için sunucu push
// altyapısı gerekir ve o altyapı henüz bağlı değil.
//
// Bu yüzden her türün `yerelCalisir` bayrağı var ve ekran bunu AÇIKÇA ayırır.
// Çalışmayan bir bildirimi "açık" diye göstermek, kullanıcıya gelmeyecek bir
// uyarıyı bekletmek olurdu. Tercih yine de kaydedilir: sunucu tarafı
// bağlandığında kullanıcının seçimi hazır olur.

import 'dart:convert';

import 'prefs.dart';

/// Bir bildirim türü.
class MacBildirimTuru {
  const MacBildirimTuru(
    this.anahtar,
    this.etiket, {
    required this.yerelCalisir,
  });

  /// Diske yazılan sabit anahtar (etiket değişse de kayıt bozulmaz).
  final String anahtar;

  final String etiket;

  /// ŞU AN telefona düşebiliyor mu? (bkz. dosya başındaki dürüst sınır)
  final bool yerelCalisir;
}

/// Kullanıcının saydığı türler, saydığı sırayla.
const List<MacBildirimTuru> kMacBildirimTurleri = [
  MacBildirimTuru('hatirlatma', 'Maç Hatırlatması', yerelCalisir: true),
  MacBildirimTuru('kadro', 'Kadrolar Açıklandı', yerelCalisir: false),
  MacBildirimTuru('baslama', 'Maç Başladı', yerelCalisir: false),
  MacBildirimTuru('ilkYari', 'İlk Yarı', yerelCalisir: false),
  MacBildirimTuru('sonuc', 'Maç Sonucu', yerelCalisir: false),
  MacBildirimTuru('gol', 'Gol', yerelCalisir: false),
  MacBildirimTuru('penalti', 'Penaltı', yerelCalisir: false),
  MacBildirimTuru('kirmizi', 'Kırmızı Kart', yerelCalisir: false),
];

const String _kTakipAnahtari = 'takipEdilenMaclar';
const String _kTercihAnahtari = 'macBildirimTercihleri';

final Set<String> _gecerliTurler = {
  for (final t in kMacBildirimTurleri) t.anahtar,
};

/// Maçın kimliği. Anket ve kupon aktarımıyla AYNI kural.
String macKimligi(Map? m) => '${m?['sportotoMatchId'] ?? m?['no'] ?? ''}';

/// Takip edilen maç kimlikleri.
Set<String> takipEdilenMaclar() {
  final v = getPref(_kTakipAnahtari);
  if (v is! List) return const {};
  return v.map((e) => '$e').where((s) => s.isNotEmpty).toSet();
}

bool macTakipte(String kimlik) =>
    kimlik.isNotEmpty && takipEdilenMaclar().contains(kimlik);

/// Takibi açar/kapatır. Kapatmak TERCİHLERİ SİLMEZ — kullanıcı maçı yeniden
/// takibe aldığında daha önce seçtiği türler geri gelsin.
void macTakipAyarla(String kimlik, bool takip) {
  if (kimlik.isEmpty) return;
  final liste = takipEdilenMaclar().toSet();
  if (takip) {
    liste.add(kimlik);
  } else {
    liste.remove(kimlik);
  }
  // Sıralı yazılır: aynı küme her seferinde aynı kaydı üretsin.
  setPref(_kTakipAnahtari, liste.toList()..sort());
}

/// Tüm maçların tercih haritası: kimlik → açık tür anahtarları.
///
/// Bozuk/eski kayıtlar ELENİR: tanınmayan tür anahtarı yok sayılır, çünkü
/// kaldırılmış bir tür yüzünden ekranda karşılığı olmayan bir tercih tutmak
/// kullanıcıya görünmeyen bir ayar bırakırdı.
Map<String, Set<String>> _tumTercihler() {
  final ham = getPref(_kTercihAnahtari);
  Map? m;
  if (ham is Map) {
    m = ham;
  } else if (ham is String && ham.isNotEmpty) {
    // Eski sürümlerde JSON metni olarak yazılmış olabilir.
    final c = jsonDecode(ham);
    if (c is Map) m = c;
  }
  if (m == null) return {};
  return {
    for (final e in m.entries)
      '${e.key}': (e.value is List)
          ? (e.value as List)
                .map((x) => '$x')
                .where(_gecerliTurler.contains)
                .toSet()
          : <String>{},
  };
}

/// Takibe ALINAN maçta varsayılan: TÜM türler açık (referans ekranındaki gibi);
/// kullanıcı istemediğini tek tek kapatır.
Set<String> _varsayilan() => {for (final t in kMacBildirimTurleri) t.anahtar};

/// Bu maç için AÇIK bildirim türleri.
///
/// Takip edilmeyen maçın açık türü YOKTUR: yıldız kapalıyken bildirim
/// gönderilmesi, kullanıcının kapattığı bir şeyi çalıştırmak olurdu.
Set<String> macBildirimTercihleri(String kimlik) {
  if (!macTakipte(kimlik)) return const {};
  final kayit = _tumTercihler()[kimlik];
  return kayit ?? _varsayilan();
}

/// Tek bir türü açar/kapatır. YALNIZ bu maçın kaydına dokunur.
void macBildirimAyarla(String kimlik, String tur, bool acik) {
  if (kimlik.isEmpty || !_gecerliTurler.contains(tur)) return;
  final hepsi = _tumTercihler();
  final mevcut = hepsi[kimlik] ?? _varsayilan();
  final yeni = mevcut.toSet();
  if (acik) {
    yeni.add(tur);
  } else {
    yeni.remove(tur);
  }
  hepsi[kimlik] = yeni;
  setPref(_kTercihAnahtari, {
    for (final e in hepsi.entries) e.key: e.value.toList()..sort(),
  });
}

/// Maçın tercihlerini varsayılana döndürür (tüm türler açık).
void macBildirimleriSifirla(String kimlik) {
  if (kimlik.isEmpty) return;
  final hepsi = _tumTercihler()..remove(kimlik);
  setPref(_kTercihAnahtari, {
    for (final e in hepsi.entries) e.key: e.value.toList()..sort(),
  });
}
