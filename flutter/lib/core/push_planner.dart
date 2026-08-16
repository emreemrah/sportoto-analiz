// KAYNAK: app/src/pushPlanner.js — BİREBİR çeviri.
//
// TELEFON / KİLİT EKRANI BİLDİRİMİ — PLANLAYICI (SAF MODÜL)
//
// Cihaz bağımlılığı YOKTUR — böylece düz Dart testinde doğrudan çalıştırılabilir.
// Bildirim eklentisi burada İMPORT EDİLMEZ; bu dosya yalnız "hangi bildirim, ne
// zaman, hangi metinle" sorusunu yanıtlar. Cihazla konuşan taraf
// `services/push_service.dart`.
//
// NEDEN AYRI BİR PLANLAYICI: uygulama içi bildirim merkezi (`notifications.dart`)
// kullanıcı uygulamayı AÇTIĞINDA olup biteni gösterir. Telefon bildirimi ise
// uygulama KAPALIYKEN çalmak zorundadır; bu yüzden önceden zamanlanır. Önceden
// zamanlanabilecek TEK dürüst olay, başlama saati zaten bilinen maçtır.
//
// KESİN KURALLAR:
//  1) Uydurma yok. Gerçek başlama saati olmayan maç için bildirim KURULMAZ.
//  2) Yalnız kullanıcının KENDİ kuponunda işaretlediği maçlar hatırlatılır.
//  3) Geçmiş zamana bildirim kurulmaz (kurulursa telefon anında çalar — yanlış).
//  4) Başlamış / resmî sonucu gelmiş maça hatırlatma kurulmaz.
//  5) İddialı dil yok, kupon oynamaya teşvik yok: yalnız "şu maç birazdan
//     başlıyor" denir. "kesin/garanti/banko/net favori" gibi kelimeler geçmez.
//  6) Metinde kişisel veri yok: e-posta, telefon, belirteç, kullanıcı adı, puan
//     yazılmaz. Yalnız bültende zaten herkese açık olan maç no / takım / saat.
//  7) Sonucu ÖNCEDEN bildiren bildirim kurulmaz — sonuç gelecekte oluşur,
//     zamanlanmış metin onu bilemez (bilirmiş gibi yazmak sahtelik olurdu).

import 'utils.dart';

import 'notifications.dart';

/// Varsayılan: maç başlamadan 60 dk önce (bildirim merkeziyle aynı pencere).
const int kVarsayilanOnceDk = 60;

// iOS bekleyen yerel bildirimde 64 sınırına takılır ve fazlasını SESSİZCE atar.
// 15 maçlık bültende bu sınıra yaklaşmayız; yine de üst sınır koyuyoruz ki
// beklenmedik veride sessiz kayıp yaşanmasın (atılanlar raporlanır).
const int kEnFazlaBildirim = 32;

/// Maç saatini GERÇEK ana çevirir (bkz. utils.macAni).
///
/// Bülten saati Türkiye duvar saatidir; cihaz saatinde yorumlanırsa planlanan
/// bildirim yanlış anda çalar.
int? _toTime(Object? v) => macAni(v)?.millisecondsSinceEpoch;

String _saatMetni(int ms) {
  final d = DateTime.fromMillisecondsSinceEpoch(ms).toLocal();
  String p(int n) => n.toString().padLeft(2, '0');
  return '${p(d.hour)}:${p(d.minute)}';
}

String _takimAdi(Object? x) {
  if (x == null) return '';
  if (x is String) return x.trim();
  if (x is Map) return '${x['name'] ?? ''}'.trim();
  return '';
}

Object? _haftaKimlik(Map? bulletin) {
  if (bulletin?['roundId'] != null) return bulletin!['roundId'];
  final r = bulletin?['round'];
  if (r is Map && r['id'] != null) return r['id'];
  return null;
}

/// Maç hatırlatmasının varsayılan başlığı (üretim).
const String kMacBaslik = 'Kuponundaki maç birazdan başlıyor';

typedef MacBilgisi = ({int no, String ev, String dep, int baslama});

/// Bülten kaydını bildirime uygun hâle getirir.
///
/// null → numara, başlama saati ya da takım adı eksik. Bu durumda bildirim
/// UYDURULMAZ; kayıt atlanır.
MacBilgisi? macBilgisi(Map? m) {
  final no = int.tryParse('${m?['no']}');
  if (no == null || no <= 0) return null;
  final baslama = _toTime(m?['date']);
  if (baslama == null) return null; // saat yoksa UYDURMA
  final ev = _takimAdi(m?['home']);
  final dep = _takimAdi(m?['away']);
  if (ev.isEmpty || dep.isEmpty) return null;
  return (no: no, ev: ev, dep: dep, baslama: baslama);
}

typedef BildirimIcerik = ({
  String title,
  String body,
  Map<String, dynamic> data,
});

/// `match-starting` bildiriminin BAŞLIK / GÖVDE / VERİ'si — TEK KAYNAK.
///
/// Hem üretimdeki 60 dakikalık hatırlatma hem de geliştirme testi bu işlevi
/// kullanır; böylece testte telefona düşen bildirim, üretimdekinden BAŞKA bir
/// yoldan üretilmiş olmaz. Gövdede yalnız maç numarası, takım adları ve saat
/// bulunur — tahmin, kupon seçimi, kullanıcı, e-posta ya da oturum bilgisi
/// geçmez.
BildirimIcerik macBildirimIcerigi(MacBilgisi g, {String baslik = kMacBaslik}) =>
    (
      // Not: "başlıyor" haber cümlesidir; tahmin ya da tavsiye içermez.
      title: baslik,
      body: '${g.no}. ${g.ev} – ${g.dep} · ${_saatMetni(g.baslama)}',
      data: {
        'tab': 'BulletinTab',
        'screen': 'LiveMatchDetail',
        'params': {'no': g.no},
        'kind': 'match-starting',
      },
    );

typedef PlanItem = ({
  String id,
  int fireAt,
  String title,
  String body,
  Map<String, dynamic> data,
});
typedef Atlanan = ({int saatYok, int gecmis, int basladi, int sinir});

/// Kurulacak YEREL bildirimlerin planı.
///
/// Dönen her kayıt:
///  - id     : kararlı kimlik (`mac:<hafta>:<macNo>`) — tekrar kurulmayı önler
///  - fireAt : telefonun çalacağı an (ms, gelecekte)
({List<PlanItem> items, Atlanan atlanan}) planMatchReminders({
  int now = 0,
  Map? bulletin,
  List? coupons,
  int onceDk = kVarsayilanOnceDk,
  int enFazla = kEnFazlaBildirim,
}) {
  var saatYok = 0, gecmis = 0, basladi = 0, sinir = 0;
  final maclar = (bulletin?['matches'] as List?) ?? const [];
  final secili = seciliMacNolari(coupons);

  // Kupon yoksa hatırlatma da yoktur — "her maçı bildir" davranışı kullanıcının
  // istemediği bir bildirim yağmuru olurdu.
  if (secili.isEmpty || maclar.isEmpty) {
    return (
      items: const <PlanItem>[],
      atlanan: (saatYok: 0, gecmis: 0, basladi: 0, sinir: 0),
    );
  }

  final hafta = _haftaKimlik(bulletin);
  final oncesiMs = (onceDk < 0 ? 0 : onceDk) * 60 * 1000;
  final gorulen = <String>{};
  final items = <PlanItem>[];

  for (final raw in maclar) {
    final m = raw as Map?;
    final no = int.tryParse('${m?['no']}');
    if (no == null || !secili.contains(no)) continue;

    // Başlamış ya da resmîleşmiş maça hatırlatma kurulmaz.
    if (m?['status'] == 'finished' || m?['status'] == 'live' || isOfficial(m)) {
      basladi += 1;
      continue;
    }

    // Numara / saat / takım adı eksikse bildirim UYDURULMAZ.
    final bilgi = macBilgisi(m);
    if (bilgi == null) {
      saatYok += 1;
      continue;
    }

    final fireAt = bilgi.baslama - oncesiMs;
    // Geçmişe kurulan bildirim telefonu ANINDA çaldırır — kurmuyoruz.
    // Maçın kendisi de geçmişte kalmışsa zaten hatırlatılacak bir şey yok.
    if (fireAt <= now || bilgi.baslama <= now) {
      gecmis += 1;
      continue;
    }

    final id = 'mac:${hafta ?? '?'}:${bilgi.no}';
    if (gorulen.contains(id)) continue;
    gorulen.add(id);

    final icerik = macBildirimIcerigi(bilgi);
    items.add((
      id: id,
      fireAt: fireAt,
      title: icerik.title,
      body: icerik.body,
      data: icerik.data,
    ));
  }

  items.sort((a, b) => a.fireAt.compareTo(b.fireAt));
  if (items.length > enFazla) {
    sinir = items.length - enFazla;
    items.removeRange(enFazla, items.length);
  }
  return (
    items: items,
    atlanan: (saatYok: saatYok, gecmis: gecmis, basladi: basladi, sinir: sinir),
  );
}

/// Planla cihazda HÂLİHAZIRDA kurulu olanları karşılaştırır.
///
/// Neden gerekli: her açılışta hepsini silip yeniden kurmak, aynı bildirimin
/// kısa süre için kaybolmasına ve (saat değiştiyse) yanlış anda çalmasına yol
/// açar. Burada yalnız GERÇEKTEN değişen kayıtlar dokunulur.
({List<PlanItem> kurulacak, List<String> iptal}) diffSchedule(
  List<PlanItem> planlanan,
  List<({String id, int fireAt})> kurulu,
) {
  final planMap = {for (final p in planlanan) p.id: p};
  final kuruluMap = {for (final k in kurulu) k.id: k};

  final kurulacak = <PlanItem>[];
  for (final e in planMap.entries) {
    final mevcut = kuruluMap[e.key];
    // Saat değiştiyse (maç ertelendi/öne alındı) eski kayıt iptal edilip
    // yenisi kurulur.
    if (mevcut == null || mevcut.fireAt != e.value.fireAt) {
      kurulacak.add(e.value);
    }
  }

  final iptal = <String>[];
  for (final e in kuruluMap.entries) {
    final p = planMap[e.key];
    if (p == null || p.fireAt != e.value.fireAt) iptal.add(e.key);
  }

  return (kurulacak: kurulacak, iptal: iptal);
}
