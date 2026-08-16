// KAYNAK: app/src/yaklasanMaclar.js — BİREBİR çeviri.
//
// YAKLAŞAN MAÇ LİSTESİ — güncel bülten + ÖNCEKİ HAFTADAN devam edenler.
//
// NEDEN ÖNCEKİ HAFTA DA VAR: Spor Toto haftaları üst üste biner. Yeni bülten
// açıldığında bir önceki haftanın maçlarının bir kısmı HENÜZ OYNANMAMIŞTIR.
// Gerçek örnek (2 Ağustos 2026): 53. Hafta yayındaydı ve maçları 8-9 Ağustos'ta
// oynanacaktı; ama 52. Hafta'nın 11 maçı O GÜN ve ertesi gün oynanıyordu.
// Yalnız güncel bülteni gösteren bir liste, kullanıcıya EN YAKIN maçları hiç
// göstermiyordu — bir hafta sonrasını "yaklaşan" diye sunuyordu.
//
// HAFTA ETİKETİ ŞART: iki haftanın maçları aynı listede karışır. Hangi maçın
// hangi haftaya ait olduğu yazılmazsa kullanıcı kupon yaparken yanlış haftaya
// bakar. Bu yüzden her kayıt roundId + hafta adı taşır.
//
// TIKLAMA HEDEFİ AYRIDIR: güncel haftanın maçı maç detayına gider; önceki
// haftanınki GİDEMEZ, çünkü maç detayı sıra numarasını GÜNCEL bültende arar ve
// aynı numaradaki BAŞKA bir maçı açardı. Önceki hafta kartları o haftanın
// bülten detayına gider.

import 'utils.dart';

/// Sonucu belli olmayan durumlar. 'void_no_result' resmî sonucu hiç
/// yayımlanmayacak maçtır (ertelenmiş/iptal) — "yaklaşan" değildir, listeye
/// girmez; yoksa hiç oynanmayacak bir maç haftalarca listede kalırdı.

const Set<String> _bitmemisDurumlar = {
  'upcoming',
  'scheduled',
  'live',
  'postponed',
};

/// rounds yanıtından bir önceki haftanın id'si. Yoksa null.
Object? oncekiRoundId(Map? roundsYaniti) {
  final hepsi = (roundsYaniti?['rounds'] as List?) ?? const [];
  final i = hepsi.indexWhere(
    (r) => (r as Map)['id'] == roundsYaniti?['currentRoundId'],
  );
  // Güncel hafta ilk sırada ya da bulunamadı.
  if (i < 1) return null;
  return (hepsi[i - 1] as Map)['id'];
}

// Bülten saati TÜRKİYE duvar saatidir; karşılaştırma GERÇEK ana göre yapılır
// (bkz. utils.macAni). Cihaz TSİ değilse eski hâl ofset kadar kayıyordu.
DateTime? _tarih(Object? iso) => macAni(iso);

bool _tarihGecerli(Map? m) => _tarih(m?['date']) != null;

bool _bitmemis(Map? m) {
  // Durum alanı hiç yoksa maçı düşürmeyiz (eski kayıtlar); yalnız BİLİNEN
  // bitmiş/geçersiz durumlar elenir.
  final s = m?['status'];
  if (s == null) return true;
  return _bitmemisDurumlar.contains('$s');
}

// BAŞLAMIŞ MAÇ "YAKLAŞAN" DEĞİLDİR (kullanıcı kararı, 16 Ağustos 2026).
//
// Eskiden 150 dakikalık bir pay vardı: başlama saati geçmiş ama bitmemiş maç,
// "oynuyor olabilir" gerekçesiyle 2,5 saat daha listede kalıyordu. Kullanıcı
// bunu istemedi — şeridin adı "Yaklaşan Maçlar" ve başlamış bir maç yaklaşan
// değildir; başlamış maçın yeri canlı/bülten akışıdır.
//
// Pay KALDIRILDI (sabit olarak sıfır): listeye yalnız başlama saati HENÜZ
// GELMEMİŞ maçlar girer.
const Duration _canliPay = Duration.zero;

/// Güncel ve önceki haftanın HENÜZ OYNANMAMIŞ maçlarını tek listede birleştirir,
/// tarihe göre en yakından uzağa sıralar.
///
/// GÜNCEL HAFTAYA YER AYRILIR: yalnız tarihe göre kesmek, önceki haftanın
/// maçları daha yakın olduğu için GÜNCEL bülteni ekrandan tamamen siliyordu.
/// Ana sayfanın bu haftanın bülteninden hiç maç göstermemesi kabul edilemez.
///
/// [guncel] / [onceki]: `{ roundId, round, matches }`
/// [enCok]: listedeki üst sınır
/// [enAzGuncel]: güncel haftaya ayrılan asgari yer
/// [simdi]: "şu an" (test için sabitlenebilir)
List<Map<String, dynamic>> yaklasanMaclar(
  Map? guncel, [
  Map? onceki,
  int enCok = 10,
  int enAzGuncel = 3,
  DateTime? simdi,
]) {
  final an = simdi ?? DateTime.now();
  final esik = an.subtract(_canliPay);

  Map<String, dynamic> kayit(Map m, Map? kaynak, bool oncekiHafta) => {
    ...Map<String, dynamic>.from(m),
    'roundId': kaynak?['roundId'],
    'haftaAdi': kaynak?['round'],
    'oncekiHafta': oncekiHafta,
  };

  bool uygun(Map m) {
    if (!_bitmemis(m) || !_tarihGecerli(m)) return false;
    final t = _tarih(m['date'])!;
    // Başlama saati GELMİŞ maç listeye girmez (bkz. `_canliPay`).
    return t.isAfter(esik);
  }

  int sirala(Map a, Map b) => _tarih(a['date'])!.compareTo(_tarih(b['date'])!);

  List<Map<String, dynamic>> topla(Map? kaynak, bool oncekiHafta) {
    final liste =
        ((kaynak?['matches'] as List?) ?? const [])
            .cast<Map>()
            .where(uygun)
            .map((m) => kayit(m, kaynak, oncekiHafta))
            .toList()
          ..sort(sirala);
    return liste;
  }

  final guncelListe = topla(guncel, false);
  final oncekiListe = topla(onceki, true);

  // Önce güncel haftaya yerini ayır, kalanı önceki haftaya ver, artanı yine
  // güncel haftadan tamamla.
  final ayrilan = guncelListe.length < enAzGuncel
      ? guncelListe.length
      : enAzGuncel;
  final oncekiPay = (enCok - ayrilan) < 0 ? 0 : (enCok - ayrilan);
  final secilenOnceki = oncekiListe.take(oncekiPay).toList();
  final secilenGuncel = guncelListe.take(enCok - secilenOnceki.length).toList();

  return [...secilenOnceki, ...secilenGuncel]..sort(sirala);
}
