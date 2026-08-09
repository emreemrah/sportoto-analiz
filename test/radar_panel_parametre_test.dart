// KAYNAK: app/test/radar-panel-parametre.test.mjs — BİREBİR çeviri.
//
// ---------------------------------------------------------------------------
// BEKÇİ: radarDailyPlayed/radarDailyOdds'a matchId olarak SIRA geçilmesin
// ---------------------------------------------------------------------------
// GERÇEK HATA (2026-08-07, kaynak projede): maç detayındaki Radar panelinde
// bu iki uç `(roundId, no)` ile çağrılmıştı. İkinci parametre `matchId` ve
// backend onunla gözlemleri süzüyor:
//     store.listObservations(rid, req.query.matchId ?? null)
// `matchId` bülten sırası DEĞİL, Spor Toto maç kimliğidir. Sıra numarası
// hiçbir gözlemle eşleşmedi → hücreler boş döndü → ekran "bu gün için kayıt
// yok" yazdı. Veri vardı, sorgu yanlıştı.
//
// NEDEN TEST: uç 200 döndü, konsola hata basılmadı, ekran dürüst bir "veri
// yok" cümlesi gösterdi. Yani hata KENDİNİ DOĞRU DAVRANIŞ GİBİ GÖSTERDİ.
// Bu sınıf ancak böyle bir bekçiyle yakalanır.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

const uclar = ['radarDailyPlayed', 'radarDailyOdds'];

List<File> dartDosyalari(String dizin) => Directory(dizin)
    .listSync(recursive: true)
    .whereType<File>()
    .where((f) => f.path.endsWith('.dart'))
    .toList();

String yorumsuz(String kod) => kod
    .replaceAll(RegExp(r'/\*[\s\S]*?\*/'), '')
    .replaceAll(RegExp(r'^\s*//.*$', multiLine: true), '');

void main() {
  test(
    'radarDailyPlayed/radarDailyOdds ikinci parametre olarak SIRA almaz',
    () {
      final hatalar = <String>[];
      for (final dosya in dartDosyalari('lib')) {
        final kod = yorumsuz(dosya.readAsStringSync());
        for (final uc in uclar) {
          for (final m in RegExp('$uc\\(([^)]*)\\)').allMatches(kod)) {
            final args = m
                .group(1)!
                .split(',')
                .map((x) => x.trim())
                .where((x) => x.isNotEmpty)
                .toList();
            if (args.length < 2) continue; // tek parametre: doğru
            // İkinci parametre sıra/no benzeri bir şeyse HATADIR.
            if (RegExp(
              r'\bno\b|position|sira|sıra',
              caseSensitive: false,
            ).hasMatch(args[1])) {
              hatalar.add('${dosya.path}: $uc(${m.group(1)})');
            }
          }
        }
      }
      expect(
        hatalar,
        isEmpty,
        reason:
            'Bu çağrılarda matchId yerine sıra geçilmiş — hücreler sessizce '
            'boş döner:\n${hatalar.join('\n')}',
      );
    },
  );

  test('bekçi gerçekten tarıyor — dosyaları okuyabiliyor', () {
    final dosyalar = dartDosyalari('lib');
    expect(
      dosyalar.length,
      greaterThan(20),
      reason: 'lib taranamadı (${dosyalar.length} dosya)',
    );
    final kullanan = dosyalar.where((f) {
      final k = f.readAsStringSync();
      return uclar.any(k.contains);
    }).toList();
    expect(
      kullanan.length,
      greaterThanOrEqualTo(1),
      reason: 'bu uçları kullanan dosya bulunamadı — isim değişmiş olabilir',
    );
  });
}
