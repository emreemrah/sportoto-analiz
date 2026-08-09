// KAYNAK: app/test/coupon-smart.test.mjs — BİREBİR çeviri.
//
// AKILLI KUPON + AKTARIM testleri — dürüstlük ve sınır garantileri.

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/coupon/smart.dart';

Map<String, Object?> _m(
  int no, {
  Map<String, Object?>? probs,
  String? sys,
  String? radar,
  num? surprise,
  num? dq,
}) => {
  'no': no,
  'probabilities': probs,
  'prediction': sys != null ? {'symbol': sys, 'label': 'TEST'} : null,
  'analysis': surprise != null ? {'surpriseScore': surprise} : null,
  'radarCenter': (radar != null || dq != null)
      ? {
          'master': {
            'favorite': radar != null ? {'symbol': radar, 'percent': 50} : null,
            'dataQuality': dq,
          },
        }
      : null,
};

void main() {
  test('buildSmartCoupon: bütçe ve 2500 kolon sınırı ASLA aşılmaz', () {
    // 15 çok belirsiz maç → sınırsız bütçede bile 2500 aşılmamalı
    final matches = [
      for (var i = 0; i < 15; i++)
        _m(i + 1, probs: {'1': 34, 'X': 33, '2': 33}, surprise: 80),
    ];
    final res = buildSmartCoupon(
      matches: matches,
      budgetColumns: 999999,
      target: 15,
    );
    expect(
      res.columns <= 2500,
      isTrue,
      reason: 'kolon ${res.columns} ≤ 2500 olmalı',
    );
    final res2 = buildSmartCoupon(
      matches: matches,
      budgetColumns: 8,
      target: 15,
    );
    expect(
      res2.columns <= 8,
      isTrue,
      reason: 'bütçe 8 kolon → ${res2.columns} ≤ 8 olmalı',
    );
  });

  test(
    'buildSmartCoupon: kesin maç tekli kalır, belirsiz maç genişler; '
    'açıklama insanca',
    () {
      final matches = [
        // net favori
        _m(
          1,
          probs: {'1': 70, 'X': 20, '2': 10},
          sys: '1',
          radar: '1',
          surprise: 10,
        ),
        // tam belirsiz + çatışma
        _m(
          2,
          probs: {'1': 36, 'X': 34, '2': 30},
          sys: '1',
          radar: '2',
          surprise: 70,
        ),
      ];
      final res = buildSmartCoupon(
        matches: matches,
        budgetColumns: 6,
        target: 14,
      );
      final s1 = res.selections.firstWhere((s) => s.no == 1);
      final s2 = res.selections.firstWhere((s) => s.no == 2);
      expect(
        s1.selectedOutcomes.length,
        1,
        reason: 'net favori tekli kalmalı',
      );
      expect(
        s2.selectedOutcomes.length >= 2,
        isTrue,
        reason: 'belirsiz + Master/Radar çatışmalı maç genişlemeli',
      );
      final e2 = res.explanations.firstWhere((e) => e.no == 2);
      expect(
        RegExp('farklı yönde|yakın|sürpriz').hasMatch(e2.text),
        isTrue,
        reason: 'açıklama insanca gerekçe içermeli',
      );
      expect(
        RegExp(
          r'formül|sigma|Σ|logaritma',
          caseSensitive: false,
        ).hasMatch([for (final e in res.explanations) e.text].join(' ')),
        isFalse,
        reason: 'teknik formül ana metne sızmaz',
      );
      expect(
        res.coverageNote,
        contains('DEĞİLDİR'),
        reason: 'kapsama kesin kazanma ihtimali gibi sunulmaz',
      );
    },
  );

  test('buildSmartCoupon: verisiz maç UYDURULMAZ — boş bırakılır ve bildirilir', () {
    // 2. maçta hiç sinyal yok
    final matches = [
      _m(1, probs: {'1': 50, 'X': 30, '2': 20}),
      _m(2),
    ];
    final res = buildSmartCoupon(
      matches: matches,
      budgetColumns: 100,
      target: 13,
    );
    expect(
      res.insufficient,
      [2],
      reason: 'sinyalsiz maç "veri yetersiz" listesinde',
    );
    expect(
      res.selections.where((s) => s.no == 2),
      isEmpty,
      reason: 'sinyalsiz maça seçim üretilmez',
    );
  });

  test('buildSmartCoupon: hedef düştükçe kupon daralır (12 ≤ 15)', () {
    final matches = [
      for (var i = 0; i < 15; i++)
        _m(i + 1, probs: {'1': 40, 'X': 32, '2': 28}, surprise: 50),
    ];
    final c15 = buildSmartCoupon(
      matches: matches,
      budgetColumns: 512,
      target: 15,
    ).columns;
    final c12 = buildSmartCoupon(
      matches: matches,
      budgetColumns: 512,
      target: 12,
    ).columns;
    expect(
      c12 <= c15,
      isTrue,
      reason: "hedef 12 ($c12) hedef 15'ten ($c15) pahalı olmamalı",
    );
  });

  test('diffSelections: mevcut seçim SESSİZCE ezilmez — her fark raporlanır', () {
    final cur = {
      1: ['1'],
      2: ['X'],
    };
    final prop = {
      1: ['1'],
      2: ['1', 'X'],
      3: ['2'],
    };
    final d = diffSelections(cur, prop);
    expect(d.length, 2, reason: 'aynı kalan 1. maç fark listesine girmez');
    expect(d.firstWhere((x) => x.no == 2), (
      no: 2,
      from: 'X',
      to: '1-X',
      kind: 'change',
    ));
    expect(d.firstWhere((x) => x.no == 3), (
      no: 3,
      from: '(boş)',
      to: '2',
      kind: 'fill',
    ));
  });

  test('proposalFrom: kayıt yoksa öneri üretilmez (uydurma aktarım yok)', () {
    final matches = [
      _m(1, sys: '10'),
      _m(2),
      _m(3, radar: '2', probs: {'1': 30, 'X': 33, '2': 37}),
    ];
    final sys = proposalFrom(matches, 'system');
    expect(sys[1], ['1', 'X'], reason: "resmi '10' → 1-X");
    expect(sys[2], isNull, reason: 'sistem kaydı olmayan maça öneri yok');
    expect(sys[3], isNull);
    final radar = proposalFrom(matches, 'radar');
    expect(radar[1], isNull, reason: 'radar kaydı olmayan maça öneri yok');
    expect(radar[2], isNull);
    expect(
      radar[3],
      contains('2'),
      reason: 'radar favorisi önerinin içinde',
    );
  });
}
