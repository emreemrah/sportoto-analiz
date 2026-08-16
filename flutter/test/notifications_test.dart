// KAYNAK: app/src/notifications.js + pushPlanner.js + pushSync.js + pushDevTest.js
//
// BU TESTLERİN KORUDUĞU ÜÇ KURAL:
//
//   1. Bildirim UYDURULMAZ. Başlama saati olmayan maça hatırlatma kurulmaz,
//      kupon yoksa hiç kurulmaz.
//   2. GEÇMİŞE bildirim kurulmaz — kurulursa telefon ANINDA çalar.
//   3. "Kuruldu" demeden önce cihazdan geri okunur; işletim sistemi kabul
//      etmediyse kullanıcıya "kuruldu" DENMEZ.
//
// Üçüncüsü sessizce bozulursa kullanıcı hatırlatma beklerken hiçbir şey
// gelmez ve uygulama "açıldı" demiş olur.

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/notifications.dart';
import 'package:masteranaliz/core/push_dev_test.dart';
import 'package:masteranaliz/core/push_planner.dart';
import 'package:masteranaliz/core/push_sync.dart';

const int _now = 1000000000000; // sabit "şimdi"
const int _dk = 60 * 1000;

Map _mac({
  required int no,
  int? dakikaSonra,
  String home = 'Ev',
  String away = 'Dep',
  String? status,
  String? result,
  Map? score,
}) => {
  'no': no,
  // BÜLTEN SAATİ = TÜRKİYE DUVAR SAATİ (saat dilimi eki YOK).
  //
  // Eskiden tarih, makinenin YEREL saatinden üretiliyordu
  // (fromMillisecondsSinceEpoch(...).toIso8601String()). Bu, testi makinenin
  // TARİHSEL ofsetine bağlıyordu: 2001 tarihli sabit _now için makine
  // +04:00 veriyor, oysa üretimde gelen saat her zaman Türkiye duvar saatidir
  // (kalıcı UTC+3). Kurgu üretimle uyuşmadığı için gerçek davranış test
  // edilemiyordu — ölçüldü, 1 saat sapma.
  'date': dakikaSonra == null
      ? null
      : DateTime.fromMillisecondsSinceEpoch(
              _now + dakikaSonra * _dk,
              isUtc: true,
            )
            .add(const Duration(hours: 3))
            .toIso8601String()
            .replaceFirst('Z', ''),
  'home': {'name': home},
  'away': {'name': away},
  'status': ?status,
  'result': ?result,
  'score': ?score,
};

Map _kupon(List<int> nolar) => {
  'finalVersionId': 'v1',
  'versions': [
    {
      'id': 'v1',
      'selections': [
        for (final n in nolar)
          {
            'no': n,
            'selectedOutcomes': ['1'],
          },
      ],
    },
  ],
};

/// Sahte cihaz katmanı — gerçek telefon olmadan tüm kararlar sınanır.
class _SahteNat implements PushNative {
  _SahteNat({
    // Testte hep destekli cihaz varsayılır; desteksiz dal `nat: null` ile
    // ayrıca sınanır.
    this.destek = true,
    this.izin = 'granted',
    this.zamanlamaKabulEtsin = true,
  });

  @override
  final bool destek;
  String izin;

  /// false → işletim sistemi zamanlamayı reddediyor (kayıt cihaza yazılmaz).
  bool zamanlamaKabulEtsin;

  final List<({String id, int fireAt, String kind})> kayitlar = [];
  int izinIsteSayisi = 0;

  @override
  String get durum => 'hazir';
  @override
  String get platform => 'android';
  @override
  String get teknik => '';
  @override
  String get uyari => '';
  @override
  String get kaynak => 'paket';

  @override
  Future<String> izinOku() async => izin;

  @override
  Future<String> izinIste() async {
    izinIsteSayisi += 1;
    return izin;
  }

  @override
  Future<List<({String id, int fireAt, String kind})>> kurulular() async =>
      List.of(kayitlar);

  @override
  Future<void> zamanla(PlanItem p) async {
    if (!zamanlamaKabulEtsin) return;
    kayitlar.removeWhere((k) => k.id == p.id);
    kayitlar.add((id: p.id, fireAt: p.fireAt, kind: '${p.data['kind']}'));
  }

  @override
  Future<void> iptal(String id) async =>
      kayitlar.removeWhere((k) => k.id == id);

  @override
  Future<void> kanalHazirla() async {}
}

class _SahteStore implements PushStore {
  PushTercih t = kVarsayilanTercih;
  @override
  Future<PushTercih> oku() async => t;
  @override
  Future<void> yaz(PushTercih next) async => t = next;
}

void main() {
  group('Bildirim merkezi', () {
    test(
      'bilinen hafta yoksa "yeni bülten" ÜRETİLMEZ (ilk açılış yağmuru)',
      () {
        final r = buildNotifications(
          now: _now,
          bulletin: {'roundId': 1528, 'round': '1. Hafta', 'matches': []},
          state: const {},
        );
        expect(r.items, isEmpty);
      },
    );

    test('yeni hafta kimliği gelince tek bildirim üretilir', () {
      final r = buildNotifications(
        now: _now,
        bulletin: {
          'roundId': 1528,
          'round': '1. Hafta',
          'matches': [_mac(no: 1)],
        },
        state: const {
          'knownRoundIds': ['1527'],
        },
      );
      expect(r.items.single.kind, 'new-round');
      expect(r.items.single.body, contains('1. Hafta'));
    });

    test('daha önce görülmüş bildirim TEKRAR gösterilmez', () {
      final r = buildNotifications(
        now: _now,
        bulletin: {'roundId': 1528, 'matches': []},
        state: const {
          'knownRoundIds': ['1527'],
          'dismissed': ['round:1528'],
        },
      );
      expect(r.items, isEmpty);
    });

    test('kupon dışı maç için "başlıyor" bildirimi ÇIKMAZ', () {
      final r = buildNotifications(
        now: _now,
        bulletin: {
          'roundId': 1528,
          'matches': [
            _mac(no: 1, dakikaSonra: 30),
            _mac(no: 2, dakikaSonra: 30),
          ],
        },
        coupons: [
          _kupon([1]),
        ],
        state: const {
          'knownRoundIds': ['1528'],
        },
      );
      expect(r.items.length, 1);
      expect(r.items.single.id, 'start:1528:1');
    });

    test('1 saatlik pencere dışındaki maç bildirilmez', () {
      final r = buildNotifications(
        now: _now,
        bulletin: {
          'roundId': 1528,
          'matches': [_mac(no: 1, dakikaSonra: 90)],
        },
        coupons: [
          _kupon([1]),
        ],
        state: const {
          'knownRoundIds': ['1528'],
        },
      );
      expect(r.items, isEmpty);
    });

    test('saati bilinmeyen maç için bildirim UYDURULMAZ', () {
      final r = buildNotifications(
        now: _now,
        bulletin: {
          'roundId': 1528,
          'matches': [_mac(no: 1)],
        },
        coupons: [
          _kupon([1]),
        ],
        state: const {
          'knownRoundIds': ['1528'],
        },
      );
      expect(r.items, isEmpty);
    });

    test('resmî sonuç: kısmî de olsa GERÇEK sayı yazılır', () {
      final r = buildNotifications(
        now: _now,
        history: {
          'roundId': 1527,
          'roundName': '53. Hafta',
          'matches': [
            _mac(no: 1, result: '1', score: {'home': 1, 'away': 0}),
            _mac(no: 2),
          ],
        },
        state: const {
          'knownRoundIds': ['1528'],
        },
      );
      final it = r.items.single;
      expect(it.kind, 'result-official');
      expect(it.title, 'Resmî sonuçlar açıklanıyor'); // "hepsi bitti" DEMEZ
      expect(it.body, contains('1/2 maçın resmî sonucu geldi'));
    });

    test('hepsi resmîleştiyse "Hafta kapandı" der', () {
      final r = buildNotifications(
        now: _now,
        history: {
          'roundId': 1527,
          'matches': [
            _mac(no: 1, result: '1', score: {'home': 1, 'away': 0}),
          ],
        },
        state: const {
          'knownRoundIds': ['1528'],
        },
      );
      expect(r.items.single.title, 'Hafta kapandı');
    });

    test('okunmuş kimlikler 200 ile sınırlanır', () {
      final s = nextState(
        now: _now,
        state: {
          'dismissed': [for (var i = 0; i < 250; i++) 'x$i'],
        },
      );
      expect((s['dismissed'] as List).length, 200);
      // En YENİLER korunur; en eskiler düşer.
      expect((s['dismissed'] as List).last, 'x249');
    });
  });

  group('Hatırlatma planı', () {
    test('kupon yoksa HİÇ hatırlatma kurulmaz', () {
      final p = planMatchReminders(
        now: _now,
        bulletin: {
          'roundId': 1528,
          'matches': [_mac(no: 1, dakikaSonra: 120)],
        },
      );
      expect(p.items, isEmpty);
    });

    test('60 dk öncesine kurulur ve id kararlıdır', () {
      final p = planMatchReminders(
        now: _now,
        bulletin: {
          'roundId': 1528,
          'matches': [_mac(no: 3, dakikaSonra: 120)],
        },
        coupons: [
          _kupon([3]),
        ],
      );
      expect(p.items.single.id, 'mac:1528:3');
      expect(p.items.single.fireAt, _now + 60 * _dk);
      expect(p.items.single.body, contains('3. Ev – Dep'));
    });

    test('GEÇMİŞE kurulmaz (telefon anında çalardı)', () {
      final p = planMatchReminders(
        now: _now,
        bulletin: {
          'roundId': 1528,
          // 30 dk sonra başlıyor → 60 dk öncesi GEÇMİŞTE kalıyor
          'matches': [_mac(no: 1, dakikaSonra: 30)],
        },
        coupons: [
          _kupon([1]),
        ],
      );
      expect(p.items, isEmpty);
      expect(p.atlanan.gecmis, 1);
    });

    test('başlamış/canlı/resmî maç atlanır ve SAYILIR', () {
      final p = planMatchReminders(
        now: _now,
        bulletin: {
          'roundId': 1528,
          'matches': [
            _mac(no: 1, dakikaSonra: 120, status: 'live'),
            _mac(no: 2, dakikaSonra: 120, status: 'finished'),
            _mac(
              no: 3,
              dakikaSonra: 120,
              result: '1',
              score: {'home': 1, 'away': 0},
            ),
          ],
        },
        coupons: [
          _kupon([1, 2, 3]),
        ],
      );
      expect(p.items, isEmpty);
      expect(p.atlanan.basladi, 3);
    });

    test('saati olmayan maç atlanır ve SAYILIR', () {
      final p = planMatchReminders(
        now: _now,
        bulletin: {
          'roundId': 1528,
          'matches': [_mac(no: 1)],
        },
        coupons: [
          _kupon([1]),
        ],
      );
      expect(p.atlanan.saatYok, 1);
    });

    test('aynı maç iki kupondaysa TEK bildirim kurulur', () {
      final p = planMatchReminders(
        now: _now,
        bulletin: {
          'roundId': 1528,
          'matches': [_mac(no: 5, dakikaSonra: 120)],
        },
        coupons: [
          _kupon([5]),
          _kupon([5]),
        ],
      );
      expect(p.items.length, 1);
    });

    test('üst sınır aşılırsa atılanlar RAPORLANIR (sessiz kayıp yok)', () {
      final maclar = [
        for (var i = 1; i <= 5; i++) _mac(no: i, dakikaSonra: 120 + i),
      ];
      final p = planMatchReminders(
        now: _now,
        bulletin: {'roundId': 1528, 'matches': maclar},
        coupons: [
          _kupon([1, 2, 3, 4, 5]),
        ],
        enFazla: 3,
      );
      expect(p.items.length, 3);
      expect(p.atlanan.sinir, 2);
    });

    test('diff: saat değişirse eski iptal, yeni kurulur', () {
      final p = planMatchReminders(
        now: _now,
        bulletin: {
          'roundId': 1528,
          'matches': [_mac(no: 1, dakikaSonra: 120)],
        },
        coupons: [
          _kupon([1]),
        ],
      );
      final d = diffSchedule(p.items, [(id: 'mac:1528:1', fireAt: 12345)]);
      expect(d.kurulacak.length, 1);
      expect(d.iptal, ['mac:1528:1']);
    });

    test('diff: değişmeyen kayda DOKUNULMAZ', () {
      final p = planMatchReminders(
        now: _now,
        bulletin: {
          'roundId': 1528,
          'matches': [_mac(no: 1, dakikaSonra: 120)],
        },
        coupons: [
          _kupon([1]),
        ],
      );
      final d = diffSchedule(p.items, [
        (id: 'mac:1528:1', fireAt: p.items.single.fireAt),
      ]);
      expect(d.kurulacak, isEmpty);
      expect(d.iptal, isEmpty);
    });
  });

  group('İzin ve eşitleme', () {
    test('izin yoksa tercih "açık" YAZILMAZ', () async {
      final nat = _SahteNat(izin: 'denied');
      final store = _SahteStore();
      final r = await ayariDegistir(nat: nat, store: store, ac: true);
      expect(r.enabled, isFalse);
      expect(store.t.enabled, isFalse);
    });

    test('izin verilirse tercih açılır ve hatırlatmalar kurulur', () async {
      final nat = _SahteNat();
      final store = _SahteStore();
      final r = await ayariDegistir(
        nat: nat,
        store: store,
        ac: true,
        now: _now,
        bulletin: {
          'roundId': 1528,
          'matches': [_mac(no: 1, dakikaSonra: 120)],
        },
        coupons: [
          _kupon([1]),
        ],
      );
      expect(r.enabled, isTrue);
      expect(store.t.enabled, isTrue);
      expect(r.senkron!.durum, 'ok');
      expect(r.senkron!.dogrulanan, 1);
      expect(nat.kayitlar.single.id, 'mac:1528:1');
    });

    test('işletim sistemi kabul etmezse "kuruldu" DENMEZ', () async {
      final nat = _SahteNat(zamanlamaKabulEtsin: false);
      final store = _SahteStore()..t = (enabled: true, onceDk: 60);
      final s = await macSenkron(
        nat: nat,
        store: store,
        now: _now,
        bulletin: {
          'roundId': 1528,
          'matches': [_mac(no: 1, dakikaSonra: 120)],
        },
        coupons: [
          _kupon([1]),
        ],
      );
      expect(s.durum, 'eksik');
      expect(s.plan, 1);
      expect(s.dogrulanan, 0);
    });

    test('izin geri alınmışsa durum okuma tercihi DÜRÜSTÇE kapatır', () async {
      final nat = _SahteNat(izin: 'denied');
      final store = _SahteStore()..t = (enabled: true, onceDk: 60);
      final d = await durumOku(nat: nat, store: store);
      expect(d.acik, isFalse);
      expect(d.tercihDuzeltildi, isTrue);
      expect(store.t.enabled, isFalse);
    });

    test('kapatınca bizim kurduğumuz HER kayıt silinir', () async {
      final nat = _SahteNat();
      nat.kayitlar.addAll([
        (id: 'mac:1528:1', fireAt: 1, kind: kMacKind),
        (id: kTestId, fireAt: 2, kind: kTestKind),
        (id: kTestMacId, fireAt: 3, kind: kMacKind),
        // Başkasının kaydı — DOKUNULMAZ.
        (id: 'baska:1', fireAt: 4, kind: 'other'),
      ]);
      final store = _SahteStore()..t = (enabled: true, onceDk: 60);
      await ayariDegistir(nat: nat, store: store, ac: false);
      expect(nat.kayitlar.map((k) => k.id), ['baska:1']);
    });

    test('test bildirimi tekrar basılınca ÇOĞALMAZ', () async {
      final nat = _SahteNat();
      final store = _SahteStore();
      await testKur(nat: nat, store: store, now: _now);
      await testKur(nat: nat, store: store, now: _now + 1000);
      expect(nat.kayitlar.where((k) => k.id == kTestId).length, 1);
    });

    test(
      'cihaz desteklemiyorsa hiçbir şey kurulmaz ve dürüstçe söylenir',
      () async {
        final nat = _SahteNat(destek: false);
        final store = _SahteStore();
        final d = await durumOku(nat: nat, store: store);
        expect(d.destek, isFalse);
        expect(d.izin, 'unsupported');
        expect(d.acik, isFalse);

        final t = await testKur(nat: nat, store: store);
        expect(t.ok, isFalse);
        expect(t.neden, 'destek-yok');
        expect(nat.kayitlar, isEmpty);
      },
    );

    test('test bildirimi kişisel veri TAŞIMAZ', () {
      final t = testIcerigi(now: _now);
      expect(t.body, 'Test bildirimi başarıyla çalıştı.');
      expect(t.data['kind'], kTestKind);
    });
  });

  group('Geliştirme testi maç seçimi', () {
    test('bülten yoksa MAÇ UYDURULMAZ', () {
      final r = testMacSec(now: _now, bulletin: null);
      expect(r.ok, isFalse);
      expect(r.neden, 'bulten-yok');
    });

    test('uygun maç kalmadıysa dürüstçe söylenir', () {
      final r = testMacSec(
        now: _now,
        bulletin: {
          'matches': [_mac(no: 1, dakikaSonra: -10)],
        },
      );
      expect(r.ok, isFalse);
      expect(r.neden, 'mac-yok');
    });

    test('EN YAKIN başlamamış maç seçilir', () {
      final r = testMacSec(
        now: _now,
        bulletin: {
          'matches': [
            _mac(no: 1, dakikaSonra: 300),
            _mac(no: 2, dakikaSonra: 90),
            _mac(no: 3, dakikaSonra: 200),
          ],
        },
      );
      expect(r.mac!.no, 2);
    });

    test('kayıt ayrı kimlik taşır — üretim ailesine GİRMEZ', () {
      final r = testMacIcerigi(
        now: _now,
        bulletin: {
          'matches': [_mac(no: 7, dakikaSonra: 120)],
        },
      );
      expect(r.kayit!.id, kTestMacId);
      expect(r.kayit!.id.startsWith('mac:'), isFalse);
      expect(r.kayit!.title, kTestMacBaslik);
      // Gövde üretimdekiyle AYNI yoldan üretilir.
      expect(r.kayit!.body, contains('7. Ev – Dep'));
    });
  });
}
