// KAYNAK: app/test/push-planner.test.mjs — BİREBİR çeviri.
//
// TELEFON HATIRLATMASI PLANLAYICI TESTLERİ.
//
// Asıl amaç: telefona düşen bildirimin UYDURMA olmadığını, geçmişe
// kurulmadığını, yalnız kullanıcının KENDİ kuponunu kapsadığını ve metninde
// iddialı dil / kişisel veri bulunmadığını kanıtlamak.

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/push_planner.dart';

final int _now = DateTime.parse(
  '2026-07-25T12:00:00.000Z',
).millisecondsSinceEpoch;

String _sonra(int dk) => DateTime.fromMillisecondsSinceEpoch(
  _now + dk * 60000,
  isUtc: true,
).toIso8601String();

List<Map<String, Object?>> _kupon(int roundId, List<int> nolar) => [
  {
    'id': 'k1',
    'roundId': roundId,
    'couponNo': 1,
    'finalVersionId': 'v1',
    'versions': [
      {
        'id': 'v1',
        'versionNo': 1,
        'selections': [
          for (final no in nolar)
            {
              'no': no,
              'selectedOutcomes': ['1'],
            },
        ],
      },
    ],
  },
];

Map<String, Object?> _mac(
  int no,
  int dk, [
  Map<String, Object?> ek = const {},
]) => {
  'no': no,
  'date': _sonra(dk),
  'home': {'name': 'Ev $no'},
  'away': {'name': 'Dep $no'},
  ...ek,
};

void main() {
  test('kupon yoksa hiç hatırlatma kurulmaz (bildirim yağmuru yok)', () {
    final b = {
      'roundId': 10,
      'matches': [_mac(1, 180), _mac(2, 240)],
    };
    final r = planMatchReminders(now: _now, bulletin: b, coupons: const []);
    expect(r.items, isEmpty);
  });

  test('bülten yoksa hiç hatırlatma kurulmaz', () {
    final r = planMatchReminders(
      now: _now,
      bulletin: null,
      coupons: _kupon(10, [1]),
    );
    expect(r.items, isEmpty);
  });

  test('YALNIZ kullanıcının kuponundaki maçlar hatırlatılır', () {
    final b = {
      'roundId': 10,
      'matches': [_mac(1, 180), _mac(2, 200), _mac(3, 220)],
    };
    final r = planMatchReminders(
      now: _now,
      bulletin: b,
      coupons: _kupon(10, [2]),
    );
    expect(r.items.length, 1);
    expect((r.items[0].data['params'] as Map)['no'], 2);
  });

  test('başlama saati YOKSA hatırlatma UYDURULMAZ', () {
    final b = {
      'roundId': 10,
      'matches': [
        {
          'no': 1,
          'date': null,
          'home': {'name': 'Ev'},
          'away': {'name': 'Dep'},
        },
      ],
    };
    final r = planMatchReminders(
      now: _now,
      bulletin: b,
      coupons: _kupon(10, [1]),
    );
    expect(
      r.items,
      isEmpty,
      reason: 'saati bilinmeyen maça bildirim kurulmamalı',
    );
    expect(r.atlanan.saatYok, 1);
  });

  test('takım adı eksikse hatırlatma kurulmaz (yarım metin yazılmaz)', () {
    final b = {
      'roundId': 10,
      'matches': [
        {
          'no': 1,
          'date': _sonra(180),
          'home': {'name': 'Ev'},
          'away': null,
        },
      ],
    };
    final r = planMatchReminders(
      now: _now,
      bulletin: b,
      coupons: _kupon(10, [1]),
    );
    expect(r.items, isEmpty);
    expect(r.atlanan.saatYok, 1);
  });

  test('GEÇMİŞE bildirim kurulmaz (telefon anında çalmaz)', () {
    final b = {
      'roundId': 10,
      'matches': [
        _mac(1, -30), // maç çoktan başladı
        _mac(2, 30), // 30 dk sonra başlıyor → 60 dk öncesi geçmişte kaldı
        _mac(3, 180), // güvenli
      ],
    };
    final r = planMatchReminders(
      now: _now,
      bulletin: b,
      coupons: _kupon(10, [1, 2, 3]),
    );
    expect(r.items.length, 1);
    expect((r.items[0].data['params'] as Map)['no'], 3);
    expect(r.atlanan.gecmis, 2);
    for (final it in r.items) {
      expect(it.fireAt > _now, isTrue, reason: 'her fireAt gelecekte olmalı');
    }
  });

  test('başlamış / canlı / resmî sonuçlu maça hatırlatma kurulmaz', () {
    final b = {
      'roundId': 10,
      'matches': [
        _mac(1, 180, {'status': 'live'}),
        _mac(2, 180, {'status': 'finished'}),
        // resmî
        _mac(3, 180, {
          'result': '1',
          'score': {'home': 1, 'away': 0},
        }),
        _mac(4, 180),
      ],
    };
    final r = planMatchReminders(
      now: _now,
      bulletin: b,
      coupons: _kupon(10, [1, 2, 3, 4]),
    );
    expect(r.items.length, 1);
    expect((r.items[0].data['params'] as Map)['no'], 4);
    expect(r.atlanan.basladi, 3);
  });

  test('hatırlatma tam olarak istenen dakika kadar önce kurulur', () {
    final b = {
      'roundId': 10,
      'matches': [_mac(5, 300)],
    };
    final r = planMatchReminders(
      now: _now,
      bulletin: b,
      coupons: _kupon(10, [5]),
      onceDk: 90,
    );
    expect(r.items[0].fireAt, _now + (300 - 90) * 60000);

    final v = planMatchReminders(
      now: _now,
      bulletin: b,
      coupons: _kupon(10, [5]),
    );
    expect(v.items[0].fireAt, _now + (300 - kVarsayilanOnceDk) * 60000);
  });

  test('metinde İDDİALI DİL yoktur ve tahmin/sonuç bildirilmez', () {
    final yasak = RegExp(
      'kesin|garanti|banko|yanılmaz|net favori|kazan|oyna|bahis|iddaa|tahminimiz',
      caseSensitive: false,
    );
    final b = {
      'roundId': 10,
      'matches': [_mac(1, 180), _mac(2, 240), _mac(3, 300)],
    };
    final r = planMatchReminders(
      now: _now,
      bulletin: b,
      coupons: _kupon(10, [1, 2, 3]),
    );
    expect(r.items.length, 3);
    for (final it in r.items) {
      expect(
        yasak.hasMatch(it.title),
        isFalse,
        reason: 'başlıkta yasak dil: ${it.title}',
      );
      expect(
        yasak.hasMatch(it.body),
        isFalse,
        reason: 'metinde yasak dil: ${it.body}',
      );
      // Metin BİÇİMİ sabittir: "<no>. <ev> – <deplasman> · <saat>". Bu kalıp,
      // gelecekte oluşacak bir sonucun (skor / 1-X-2 seçimi) metne sızmasını
      // yapısal olarak imkânsız kılar.
      expect(
        RegExp(r'^\d+\. [^·]+ – [^·]+ · \d{2}:\d{2}$').hasMatch(it.body),
        isTrue,
        reason: 'beklenmedik metin biçimi: ${it.body}',
      );
    }
  });

  test(
    'metinde KİŞİSEL VERİ sızmaz (e-posta, belirteç, kullanıcı adı, puan)',
    () {
      final kirli = _kupon(10, [1]);
      kirli[0]['userEmail'] = 'gizli@ornek.com';
      kirli[0]['token'] = 'BELIRTEC-123';
      kirli[0]['username'] = 'emrah41';
      kirli[0]['points'] = 4820;

      final b = {
        'roundId': 10,
        'matches': [_mac(1, 180)],
      };
      final r = planMatchReminders(now: _now, bulletin: b, coupons: kirli);
      final metin = jsonEncode([
        for (final i in r.items)
          {'id': i.id, 'title': i.title, 'body': i.body, 'data': i.data},
      ]);
      for (final s in ['gizli@ornek.com', 'BELIRTEC-123', 'emrah41', '4820']) {
        expect(metin.contains(s), isFalse, reason: 'kişisel veri sızdı: $s');
      }
      expect(
        r.items[0].body.startsWith('1. Ev 1 – Dep 1 · '),
        isTrue,
        reason: 'yalnız maç no / takım / saat yazılmalı',
      );
    },
  );

  test(
    'kimlik kararlıdır: aynı girdi aynı kimliği üretir, tekrar kurulmaz',
    () {
      // yinelenen kayıt
      final b = {
        'roundId': 10,
        'matches': [_mac(1, 180), _mac(1, 180)],
      };
      final a1 = planMatchReminders(
        now: _now,
        bulletin: b,
        coupons: _kupon(10, [1]),
      );
      final a2 = planMatchReminders(
        now: _now,
        bulletin: b,
        coupons: _kupon(10, [1]),
      );
      expect(
        a1.items.length,
        1,
        reason: 'yinelenen maç iki bildirim üretmemeli',
      );
      expect(a1.items[0].id, 'mac:10:1');
      expect(
        [for (final i in a1.items) i.id],
        [for (final i in a2.items) i.id],
      );
    },
  );

  test('bildirimler saate göre sıralanır ve üst sınır dürüstçe raporlanır', () {
    final matches = <Map<String, Object?>>[];
    final nolar = <int>[];
    for (var i = 1; i <= kEnFazlaBildirim + 3; i++) {
      matches.add(_mac(i, 1000 - i)); // bilerek ters sırada
      nolar.add(i);
    }
    final r = planMatchReminders(
      now: _now,
      bulletin: {'roundId': 10, 'matches': matches},
      coupons: _kupon(10, nolar),
    );
    expect(r.items.length, kEnFazlaBildirim);
    expect(
      r.atlanan.sinir,
      3,
      reason: 'atılan bildirim sayısı sessizce yutulmamalı',
    );
    for (var i = 1; i < r.items.length; i++) {
      expect(
        r.items[i - 1].fireAt <= r.items[i].fireAt,
        isTrue,
        reason: 'saate göre sıralı olmalı',
      );
    }
  });

  test('hedef gerçek bir ekrandır (dokununca boşluğa gitmez)', () {
    final b = {
      'roundId': 10,
      'matches': [_mac(7, 180)],
    };
    final r = planMatchReminders(
      now: _now,
      bulletin: b,
      coupons: _kupon(10, [7]),
    );
    expect(r.items[0].data, {
      'tab': 'BulletinTab',
      'screen': 'LiveMatchDetail',
      'params': {'no': 7},
      'kind': 'match-starting',
    });
  });

  group('diffSchedule', () {
    PlanItem p(String id, int fireAt) =>
        (id: id, fireAt: fireAt, title: '', body: '', data: const {});

    test('değişmeyen kayda DOKUNULMAZ', () {
      final plan = [p('mac:10:1', 111), p('mac:10:2', 222)];
      final r = diffSchedule(plan, [
        for (final x in plan) (id: x.id, fireAt: x.fireAt),
      ]);
      expect(r.kurulacak, isEmpty);
      expect(r.iptal, isEmpty);
    });

    test('yeni maç kurulur, kupondan çıkan iptal edilir', () {
      final r = diffSchedule(
        [p('mac:10:2', 222)],
        [(id: 'mac:10:1', fireAt: 111)],
      );
      expect([for (final k in r.kurulacak) k.id], ['mac:10:2']);
      expect(r.iptal, ['mac:10:1']);
    });

    test('maç saati değişirse eski iptal edilip yenisi kurulur', () {
      final r = diffSchedule(
        [p('mac:10:1', 999)],
        [(id: 'mac:10:1', fireAt: 111)],
      );
      expect([for (final k in r.kurulacak) k.fireAt], [999]);
      expect(r.iptal, [
        'mac:10:1',
      ], reason: 'eski kayıt kalırsa telefon yanlış saatte çalar');
    });

    // KAYNAKTAKİ "bozuk kayıtlar çökmeye yol açmaz" TESTİNİN KARŞILIĞI YOK:
    // JS'te kurulu listeye `null` / `{}` / kimliksiz nesne girebiliyordu ve
    // işlev bunlara karşı korunuyordu. Dart'ta `List<({String id, int fireAt})>`
    // tipi bu girdileri DERLEME ZAMANINDA imkânsız kılar — koruma tipe taşındı,
    // kaybolmadı.

    test('plan boşsa kurulu olanların hepsi iptal listesine girer', () {
      final r = diffSchedule(const [], [
        (id: 'mac:10:1', fireAt: 1),
        (id: 'mac:10:2', fireAt: 2),
      ]);
      expect(r.kurulacak, isEmpty);
      expect(r.iptal, ['mac:10:1', 'mac:10:2']);
    });
  });
}
