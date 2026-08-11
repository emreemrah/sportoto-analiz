// KAYNAK: app/src/moderationView.js — BİREBİR çeviri.
//
// İNCELEME EKRANININ SAF MANTIĞI (E9 — üçüncü şart)
//
// Karar veren küçük parçalar burada, saf işlevler hâlinde durur ve testle
// ÖLÇÜLÜR.
//
// ═══ BU DOSYANIN DEĞİŞMEZ KURALI ═══
// Buradaki hiçbir işlev BİLDİREN kişiyi tanımlayan bir şey üretmez. Sunucu
// zaten bildiren kimliğini döndürmüyor; ekranın da böyle bir alanı okumaya
// çalışmaması gerekir ki uç bir gün fazladan alan döndürürse o alan sessizce
// arayüze düşmesin.
//
// ═══ DÜRÜSTLÜK ═══
// Özet satırları sunucudan gelen sayıları OLDUĞU GİBİ anlatır. "5 bildirim
// vardı, 4 gördüm" durumu gizlenmez: silinmiş yoruma ait bildirimler ayrıca
// yazılır, listenin kesildiği durum ayrıca yazılır. Eksik veri, tam veri gibi
// gösterilmez.

import 'moderation_reasons.dart';

/// Sebeplerin bilinen sırası — özet metninde de aynı sıra kullanılır.
final List<String> _sebepSirasi = [
  for (final s in kBildirimSebepleri) s.key,
];

int _sayi(Object? v) => v is num ? v.toInt() : (int.tryParse('$v') ?? 0);

/// Liste başlığındaki dürüst özet satırları.
List<String> ozetSatirlari(Map? sonuc) {
  final items = (sonuc?['items'] as List?) ?? const [];
  final total = _sayi(sonuc?['total']);
  final oksuz = _sayi(sonuc?['orphanCount']);

  if (total == 0 && oksuz == 0 && items.isEmpty) {
    return const ['İncelenmeyi bekleyen bildirim yok.'];
  }

  final satirlar = <String>['$total yorum için bekleyen bildirim var.'];

  // Gösterilen sayı toplamdan azsa SEBEBİ söylenmez (bilmiyoruz: liste sınırı
  // da olabilir, silinmiş yorum da). Yalnız fark açıkça yazılır.
  if (items.length != total) {
    satirlar.add('Bu listede ${items.length} tanesi gösteriliyor.');
  }
  if (oksuz > 0) {
    satirlar.add(
      '$oksuz bildirim silinmiş bir yoruma ait; içeriği gösterilemiyor.',
    );
  }
  return satirlar;
}

/// `{spam: 2, hakaret: 1}` → `'Spam / reklam ×2 · Hakaret'`
///
/// Çok bildirilen sebep önce yazılır; eşitlikte sebep listesinin kendi sırası
/// korunur, böylece aynı veri her açılışta aynı sırayla görünür.
String sebepOzeti(Map? reasons) {
  final girdiler = <MapEntry<String, int>>[
    for (final e in (reasons ?? const {}).entries)
      if (_sayi(e.value) > 0) MapEntry('${e.key}', _sayi(e.value)),
  ]..sort((a, b) {
      final fark = b.value - a.value;
      if (fark != 0) return fark;
      final ia = _sebepSirasi.indexOf(a.key);
      final ib = _sebepSirasi.indexOf(b.key);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  if (girdiler.isEmpty) return '';
  return girdiler
      .map((e) =>
          e.value > 1 ? '${sebepEtiketi(e.key)} ×${e.value}' : sebepEtiketi(e.key))
      .join(' · ');
}

typedef GizlemeDurumu = ({
  bool gizli,
  bool otomatik,
  String etiket,
  String renk,
});

/// Yorumun görünürlük durumu — rozet metni ve rengi.
///
/// Gizlemenin ELLE mi OTOMATİK mi olduğu operatörün en çok ihtiyaç duyduğu
/// bilgidir: otomatik gizleme bildirim hareketleriyle KENDİLİĞİNDEN kalkabilir,
/// elle gizleme kalkmaz. İkisini tek bir "Gizli" rozetinde birleştirmek,
/// operatöre kalıcı sandığı bir kararın geçici olduğunu gizlerdi.
GizlemeDurumu gizlemeDurumu(Map? item) {
  if (item?['hidden'] != true) {
    return (
      gizli: false,
      otomatik: false,
      etiket: 'Görünür',
      renk: 'yesil',
    );
  }
  final otomatik = item!['hiddenBy'] != 'elle';
  return (
    gizli: true,
    otomatik: otomatik,
    etiket: otomatik ? 'Gizli — otomatik (bildirim eşiği)' : 'Gizli — elle',
    renk: otomatik ? 'turuncu' : 'kirmizi',
  );
}

typedef ModEylem = ({
  String key,
  String label,
  String aciklama,
  bool tehlike,
});

/// Bir yorum için anlamlı düğmeler.
///
/// "Gizle" her durumda anlamlıdır: gizli olmayan yorumu gizler, OTOMATİK gizli
/// yorumu ise operatör kararına çevirir (sebep 'elle' olur) — böylece bildirim
/// hareketleri o kararı artık geri alamaz. Bu yüzden gizli yorumda düğmenin adı
/// "Gizli Kalsın"dır: yaptığı şey gizlemek değil, gizlemeyi MÜHÜRLEMEKTİR.
///
/// "Geri Al" yalnız gizli yorumda gösterilir; görünür yorumda hiçbir işi yoktur.
List<ModEylem> eylemler(Map? item) {
  final gizli = item?['hidden'] == true;
  return [
    (
      key: 'hide',
      label: gizli ? 'Gizli Kalsın (onayla)' : 'Yorumu Gizle',
      aciklama: gizli
          ? 'Gizleme operatör kararı olarak mühürlenir; bekleyen bildirimler kapanır.'
          : 'Yorum herkesten gizlenir; bekleyen bildirimleri kapatır.',
      tehlike: !gizli,
    ),
    if (gizli)
      (
        key: 'unhide',
        label: 'Gizlemeyi Geri Al',
        aciklama:
            'Yorum yeniden görünür olur; bildirimleri yerinde bulunmadı sayar.',
        tehlike: false,
      ),
  ];
}

/// ISO tarihi kısa yerel biçime çevirir; okunamıyorsa UYDURMAZ, '—' der.
///
/// Kaynakta `toLocaleString('tr-TR', {2 haneli gün/ay/yıl, saat:dakika})`.
String tarihKisa(Object? iso) {
  if (iso == null || '$iso'.isEmpty) return '—';
  final d = DateTime.tryParse('$iso')?.toLocal();
  if (d == null) return '—';
  String p(int n) => n.toString().padLeft(2, '0');
  return '${p(d.day)}.${p(d.month)}.${d.year} ${p(d.hour)}:${p(d.minute)}';
}

/// "3 kişi · 4 bekleyen bildirim" — sayıların ne olduğu AÇIKÇA yazılır.
///
/// `reporterCount` farklı kişi sayısı, `reportCount` satır sayısıdır ve bunlar
/// eşit olmak zorunda değildir. Etikette "kişi" ve "bildirim" ayrımı korunur;
/// tek bir sayı göstermek, otomatik gizleme eşiğinin (3 FARKLI kişi) neye göre
/// çalıştığını operatöre yanlış anlatırdı.
String bildirimOzeti(Map? item) {
  final kisi = _sayi(item?['reporterCount']);
  final adet = _sayi(item?['reportCount']);
  return '$kisi kişi · $adet bekleyen bildirim';
}
