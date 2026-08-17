// MAÇ DETAYINDA DA YAKINLIK FİLTRESİ VAR — VE GERÇEKTEN ÇALIŞIYOR.
//
// KULLANICI İSTEĞİ (16 Ağustos 2026): "2. hafta maçının içine girdim, bülten
// sırasına geldim, oynanma yüzdesi ve oran yok."
//
// SONRA GELEN HATA (17 Ağustos 2026): "şimdi onu getirdin, FİLTRE ÇALIŞMIYOR."
// Çipler ekrandaydı ama süzgecin alt katmanı ekrana bağlı değildi: pencere
// çipi (`_macPenceresi`) hiçbir yerde okunmuyordu, satır açılımı süzgeçsiz
// isteniyordu, oran modunda şerit hâlâ oynanma yüzdesi basıyordu.
//
// BU DOSYANIN İLK SÜRÜMÜ HATAYI KAÇIRDI ve ders buradadır: testler yalnız
// KAYNAK METNİNDE dizge arıyordu ("_macPenceresi = 'allTime' var mı?"). Bir
// alanın ATANDIĞINI doğrulamak, OKUNDUĞUNU doğrulamaz — ölü durum da testi
// yeşil bırakır. Aşağıdaki testler paneli GERÇEKTEN çizer, çipe DOKUNUR ve
// ekrandaki sayının/isteğin değiştiğini ölçer.

import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/network/api_client.dart';
import 'package:masteranaliz/features/match_detail/mac_bulten_sirasi_paneli.dart';

// ───────────────────────────── Sahte taşıyıcı ─────────────────────────────
// radar_ekrani_test.dart ile aynı dikiş (`api.tasiyici`): uca göre yanıt
// verilir, tanımsız uç 404 döner.

class _SahteTasiyici implements HttpClientAdapter {
  final List<String> istekler = [];
  Map<String, Object?> uclar = const {};

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final u = options.uri.toString();
    istekler.add(u);
    final eslesen = uclar.keys.where(u.contains).firstOrNull;
    return ResponseBody.fromString(
      eslesen == null ? '{"error":"yok"}' : jsonEncode(uclar[eslesen]),
      eslesen == null ? 404 : 200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}

  Iterable<String> eslesenler(String parca) =>
      istekler.where((u) => u.contains(parca));
}

final _tasiyici = _SahteTasiyici();

// ─────────────────────────────── Fikstürler ───────────────────────────────
// PENCERELER KASITLI OLARAK FARKLI: "Tümü" ile "Son 5 maç" aynı yüzdeyi
// verseydi çipin bağlı olup olmadığı ölçülemezdi — hatanın gizlendiği yer tam
// olarak buydu (iki katman aynı anahtarları taşıyor: allTime/last5/...).
Map<String, Object?> _dna({bool last5 = true}) => {
  'hasData': true,
  'dna': {
    'positions': [
      {
        'position': 1,
        'windows': {
          'allTime': {
            'sample': 30,
            'pct': {'1': 50, 'X': 30, '2': 20},
          },
          if (last5)
            'last5': {
              'sample': 5,
              'pct': {'1': 10, 'X': 20, '2': 70},
            },
        },
      },
    ],
  },
  'filtre': {
    'uygulanmadi': false,
    'positions': {
      '1': {'guncel': 12, 'aday': 30, 'verili': 28, 'uyan': 5},
    },
  },
};

Map<String, Object?> _uclar({bool last5 = true}) => {
  '/api/radar/1600/match/1': {
    'sealed': false,
    'match': {'no': 1, 'radars': <String, dynamic>{}},
  },
  '/api/radar/position-dna': _dna(last5: last5),
  '/api/radar/position-matches': {
    'matches': [
      for (var i = 0; i < 8; i++)
        {
          'week': '${50 - i}. Hafta',
          'home': 'Ev $i',
          'away': 'Dep $i',
          'result': '1',
        },
    ],
  },
  '/api/radar/daily-played': {'days': <Object?>[], 'matches': <Object?>[]},
  '/api/radar/daily-odds': {
    'days': [
      {'date': '2026-08-01', 'weekday': 'Cuma', 'label': 'Cuma 01.08'},
    ],
    'matches': [
      {
        'no': 1,
        'cells': {
          // Anahtarlar home/draw/away — MemoryRow._oranDegerleri bunları okur.
          // ('1'/'X'/'2' yazan bir fikstür sessizce tire basar.)
          '2026-08-01': {
            'odds': {'home': 1.85, 'draw': 3.40, 'away': 4.10},
          },
        },
      },
    ],
  },
};

Future<void> _tur(WidgetTester t, [int n = 25]) async {
  for (var i = 0; i < n; i++) {
    await t.pump(const Duration(milliseconds: 1));
  }
}

Future<void> _paneliAc(WidgetTester t) async {
  t.view.physicalSize = const Size(800, 1400);
  t.view.devicePixelRatio = 1.0;
  addTearDown(t.view.reset);
  await t.pumpWidget(
    const ProviderScope(
      child: MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: MacBultenSirasiPaneli(
              m: {
                'roundId': 1600,
                'no': 1,
                'home': {'name': 'Ev Takımı'},
                'away': {'name': 'Dep Takımı'},
              },
            ),
          ),
        ),
      ),
    ),
  );
  await _tur(t);
}

Finder _metin(String s) => find.text(s, findRichText: true);
Finder _metinIceren(String s) => find.textContaining(s, findRichText: true);

Future<void> _dokun(WidgetTester t, String etiket) async {
  await t.tap(_metin(etiket).first, warnIfMissed: false);
  await _tur(t);
}

void main() {
  setUp(() {
    api.tasiyici = _tasiyici;
    _tasiyici.istekler.clear();
    _tasiyici.uclar = _uclar();
  });

  // ── ASIL HATA: pencere çipi ölü durumdu ─────────────────────────────────
  testWidgets('MAÇ PENCERESİ çipi yüzdeyi DEĞİŞTİRİR (ölü durum değil)', (
    t,
  ) async {
    await _paneliAc(t);
    // Süzgeçsiz başlangıç: allTime penceresi.
    expect(_metin('%50.0'), findsOneWidget);

    await _dokun(t, 'Oynanma Yüzdesi');
    // Mod açıldı, süzgeç Birebir + Tümü'ye döndü → yine allTime.
    expect(_metin('%50.0'), findsOneWidget);

    await _dokun(t, 'Son 5 maç');
    // HATANIN OLDUĞU YER: burada sayı DEĞİŞMİYORDU. Pencere `_macPenceresi`
    // yerine `_donem`den okunuyordu ve iki katman aynı anahtarları taşıdığı
    // için hiçbir hata çıkmıyordu.
    expect(_metin('%10.0'), findsOneWidget);
    expect(_metin('%70.0'), findsOneWidget);
    expect(_metin('%50.0'), findsNothing);
  });

  testWidgets('süzgeç açıkken SATIR AÇILIMI da süzülür', (t) async {
    await _paneliAc(t);
    await _dokun(t, 'Oynanma Yüzdesi');
    await _dokun(t, '±3');
    // Satırı aç — geçmiş maç listesi istenir.
    await t.tap(find.byKey(const Key('radar5-satir-1')), warnIfMissed: false);
    await _tur(t);

    final istek = _tasiyici.eslesenler('/api/radar/position-matches');
    expect(istek, isNotEmpty, reason: 'satır açılımı hiç istenmedi');
    expect(
      istek.last.contains('oynanmaTol=3'),
      isTrue,
      reason:
          'liste süzgeçsiz istendi — üstteki yüzde süzülü, alttaki liste '
          'süzülmemiş olurdu ve kullanıcı sayıyı doğrulayamazdı',
    );
  });

  testWidgets('ORAN modunda günün GERÇEK oranı istenir ve yazılır', (t) async {
    await _paneliAc(t);
    expect(
      _tasiyici.eslesenler('/api/radar/daily-odds'),
      isEmpty,
      reason: 'oran modu kapalıyken oran verisi istenmemeli',
    );

    await _dokun(t, 'Oran');
    expect(
      _tasiyici.eslesenler('/api/radar/daily-odds'),
      isNotEmpty,
      reason: 'oran modunda şerit hâlâ oynanma yüzdesi basıyordu',
    );
    // Oynanma yüzdesi ile oran YAN YANA basılmaz — birimler farklıdır.
    expect(_metinIceren('1.85'), findsWidgets);
  });

  testWidgets('süzgeç boş dönerse SEBEP doğru yazılır', (t) async {
    // last5 penceresi YOK → o pencerede yüzde yok. Süzgeç modu satıra
    // geçirilmezse ekran "Bu dönemde geçmiş sonuç yok" der; oysa dönem değil
    // YAKINLIK süzgeci boş kalmıştır. Yanlış sebep, yanlış bilgidir.
    _tasiyici.uclar = _uclar(last5: false);
    await _paneliAc(t);
    await _dokun(t, 'Oynanma Yüzdesi');
    await _dokun(t, 'Son 5 maç');

    expect(_metin('Bu yakınlıkta geçmiş maç yok.'), findsOneWidget);
    expect(_metin('Bu dönemde geçmiş sonuç yok.'), findsNothing);
  });

  testWidgets('süzgecin kaç maçı geçtiği YAZILIR', (t) async {
    await _paneliAc(t);
    await _dokun(t, 'Oynanma Yüzdesi');
    expect(_metinIceren('süzgeci geçen: 5'), findsWidgets);
    expect(_metinIceren('28/30'), findsWidgets);
  });

  // ── Kaynak bekçileri: iki ekran aynı süzgeci aynı biçimde uygulamalı ─────
  group('kaynak bekçileri', () {
    final src = File(
      'lib/features/match_detail/mac_bulten_sirasi_paneli.dart',
    ).readAsStringSync();

    test('sağlayıcı ANAHTARLARI süzgeci içerir (bayat sonuç kalmasın)', () {
      // Yalnız roundId anahtar olsaydı süzgeç değişince istek yeniden atılmaz,
      // eski sonuç ekranda kalırdı.
      expect(src.contains('({Object rid, String? mod, num? tol})'), isTrue);
      expect(
        src.contains('({Object rid, Object no, String? mod, num? tol})'),
        isTrue,
        reason: 'satır açılımı anahtarı süzgeci taşımıyor',
      );
    });

    test('Radar ekranının KENDİ bileşeni kullanılır — kopya arayüz yok', () {
      expect(src.contains('DnaDonemFiltresi('), isTrue);
      expect(
        src.contains('for (final p in kDnaPeriods)'),
        isFalse,
        reason: 'panel kendi dönem çiplerini çiziyor — ikinci arayüz',
      );
    });

    test('pencere SÜZGEÇTEN türetilir — `_donem` doğrudan okunmaz', () {
      // Radar ekranındaki `etkinPencere` ayrımının aynısı: süzgeç açıkken
      // pencere maç birimindedir, kapalıyken hafta.
      expect(src.contains('filtreAktif ? _macPenceresi : _donem'), isTrue);
      expect(src.contains('kDonemMacSayisi[etkinPencere]'), isTrue);
    });

    test('mühürlü haftada YALNIZ karşılığı olan adımlar çip olur', () {
      expect(src.contains('muhurluFiltreler'), isTrue);
      expect(src.contains('turevFiltreler'), isTrue);
      expect(src.contains("positionDna?['turev']"), isTrue);
    });

    test('mod değişince süzgeç Birebir + Tümü\'ye döner', () {
      final i = src.indexOf('onFiltreModSec:');
      expect(i, greaterThan(-1));
      final govde = src.substring(i, i + 500);
      expect(govde.contains('_oynanmaTol = 0'), isTrue);
      expect(govde.contains('_oranTol = 0'), isTrue);
      expect(govde.contains("_macPenceresi = 'allTime'"), isTrue);
    });
  });
}
