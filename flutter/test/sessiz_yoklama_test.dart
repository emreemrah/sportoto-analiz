// ARKA PLAN YOKLAMASI KENDİNİ DUYURMAZ.
//
// BİLDİRİLEN SORUN (16 Ağustos 2026): geçmiş haftada (1. Hafta) "Resmi
// sonuçlar kontrol ediliyor 🔄" yazısı ve dönen çark 15 saniyede bir parlayıp
// duruyordu.
//
// SEBEP: `bulletin_screen.dart` geçmiş hafta için 15 sn'lik bir yoklama
// kuruyor ve bu yoklama, kullanıcının BAŞLATTIĞI kontrolle AYNI `checking`
// bayrağını yakıyordu. Döngü yalnız "15/15 resmî sonuç + ikramiye" gelince
// duruyor; maçları henüz oynanmamış bir haftada (o gün 6/15) saatlerce sürer.
//
// Yoklamanın kendisi doğru — susturulan yalnız GÖSTERGE. Gerçek değişiklik
// (yeni sonuç / düzeltme) yine bildirilir.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/network/api_client.dart';
import 'package:masteranaliz/features/bulletin/history_controller.dart';

/// Yalnız `history` çağrısını karşılayan sahte istemci; kalan üyeler
/// kullanılmıyor (kullanılırsa test gürültüsüz değil, GÜRÜLTÜLÜ düşsün).
class _SahteApi implements ApiClient {
  _SahteApi(this.yanit);
  Map<String, dynamic> yanit;
  int cagri = 0;

  @override
  Future<dynamic> history(Object roundId, {bool fresh = false}) async {
    cagri++;
    return {...yanit, 'roundId': roundId};
  }

  @override
  dynamic noSuchMethod(Invocation i) =>
      throw UnimplementedError('sahte istemcide yok: ${i.memberName}');
}

Map<String, dynamic> _hafta({int cozulen = 6, bool ikramiye = false}) => {
  'matches': [
    for (var i = 1; i <= 15; i++)
      {
        'no': i,
        'home': {'name': 'Ev $i'},
        'away': {'name': 'Dep $i'},
        if (i <= cozulen) ...{'result': '1', 'score': {'home': 1, 'away': 0}},
      },
  ],
  if (ikramiye) 'prize': {'tiers': []},
};

void main() {
  test('SESSİZ yoklama "kontrol ediliyor" göstergesini YAKMAZ', () async {
    final api = _SahteApi(_hafta());
    final c = HistoryController(api);
    await c.yukle(1528);

    final gorulen = <bool>[];
    c.addListener((s) => gorulen.add(s.checking));

    await c.checkOfficial(1528, sessiz: true);

    expect(
      gorulen.any((v) => v),
      isFalse,
      reason: 'arka plan yoklaması göstergeyi yakmış',
    );
    expect(c.state.checking, isFalse);
  });

  test('ELLE kontrol göstergeyi YAKAR (davranış korunmalı)', () async {
    final api = _SahteApi(_hafta());
    final c = HistoryController(api);
    await c.yukle(1528);

    final gorulen = <bool>[];
    c.addListener((s) => gorulen.add(s.checking));

    await c.checkOfficial(1528);

    expect(
      gorulen.any((v) => v),
      isTrue,
      reason: 'kullanıcı başlattığında gösterge çıkmalı',
    );
  });

  test('sessiz yoklama VERİYİ yine de günceller', () async {
    final api = _SahteApi(_hafta(cozulen: 6));
    final c = HistoryController(api);
    await c.yukle(1528);

    api.yanit = _hafta(cozulen: 9);
    final oncekiCagri = api.cagri;
    await c.checkOfficial(1528, sessiz: true);

    expect(api.cagri, greaterThan(oncekiCagri), reason: 'sunucuya sorulmamış');
    final ms = (c.state.hist?['matches'] as List?) ?? const [];
    expect(ms.where((m) => (m as Map)['result'] != null).length, 9);
  });

  test('yoklama SESSİZ çağrılıyor — ekran kodu taraması', () {
    final src = File(
      'lib/features/bulletin/bulletin_screen.dart',
    ).readAsStringSync();
    expect(
      RegExp(r'checkOfficial\(\s*secili\s*,\s*sessiz:\s*true').hasMatch(src),
      isTrue,
      reason: '15 sn yoklaması yine göstergeyi yakıyor',
    );
  });
}
