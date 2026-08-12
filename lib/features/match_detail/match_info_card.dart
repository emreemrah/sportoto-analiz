// KAYNAK: app/src/components/MatchInfoCard.js — BİREBİR çeviri.
//
// Maç bilgi kartı (detay/Özet): bayrak + lig + lig haftası, tarih·gün·saat,
// hava, stadyum. Yalnız GERÇEK veri gösterilir; olmayan satır hiç çizilmez
// (uydurma yok). Veri kaynağı: backend m.info (+ m.league, m.date).

import 'package:flutter/material.dart';

import '../../core/theme/tokens.dart';
import '../../core/utils.dart';

const List<String> _weekday = [
  'Pazar',
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
];
const List<String> _ay = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

class MatchInfoCard extends StatelessWidget {
  const MatchInfoCard({super.key, required this.m});

  final Map<String, dynamic>? m;

  @override
  Widget build(BuildContext context) {
    final info = (m?['info'] as Map?) ?? const {};
    final league = '${m?['league'] ?? ''}';
    final country = info['country'] as String?;
    final flag = countryFlag(country);
    final leagueShort = (country != null && league.startsWith(country))
        ? league.substring(country.length).trim()
        : league;
    final leagueText = [
      if (leagueShort.isNotEmpty) leagueShort,
      if (info['leagueWeek'] != null) '${info['leagueWeek']}. Hafta',
    ].join(' · ');

    final d = m?['date'] is String
        ? DateTime.tryParse(m!['date'] as String)?.toLocal()
        : null;
    String p(int n) => n.toString().padLeft(2, '0');
    final dateText = d == null
        ? ''
        : '${d.day} ${_ay[d.month - 1]} ${d.year}, '
              '${_weekday[d.weekday % 7]} · ${p(d.hour)}:${p(d.minute)}';

    final weather = info['weather'] as Map?;
    final stadium = info['stadium'] as String?;
    final city = info['city'] as String?;

    final rows = <({String icon, String text, bool strong})>[
      if (leagueText.isNotEmpty)
        (icon: flag.isNotEmpty ? flag : '🏆', text: leagueText, strong: true),
      if (dateText.isNotEmpty) (icon: '🕐', text: dateText, strong: false),
      if (weather != null)
        (
          icon: '${weather['emoji'] ?? '🌡️'}',
          text: '${weather['label']} · ${weather['tempC']}°C',
          strong: false,
        ),
      if (stadium != null && stadium.isNotEmpty)
        (
          icon: '🏟️',
          text: (city != null && city.isNotEmpty) ? '$stadium, $city' : stadium,
          strong: false,
        ),
    ];

    if (rows.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(bottom: Spacing.md),
      padding: const EdgeInsets.symmetric(horizontal: Spacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: AppRadius.mdR,
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadow.soft,
      ),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: i > 0
                  ? BoxDecoration(
                      border: Border(top: BorderSide(color: AppColors.border)),
                    )
                  : null,
              child: Row(
                children: [
                  SizedBox(
                    width: 22,
                    child: Text(
                      rows[i].icon,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 15),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      rows[i].text,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: rows[i].strong
                            ? AppColors.text
                            : AppColors.textSoft,
                        fontSize: rows[i].strong ? 13 : 12.5,
                        fontWeight: rows[i].strong
                            ? AppFont.heavy
                            : AppFont.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
