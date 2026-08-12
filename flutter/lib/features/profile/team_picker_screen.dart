// KAYNAK: app/src/screens/TeamPickerScreen.js — BİREBİR çeviri.
//
// Profildeki "Takımım" için lig → takım seçimi.
// (Kullanıcı isteği, 2026-08-04: serbest yazı kaldırıldı; kullanıcı listeden
// kendi takımını seçer. Ligler backend kataloğundan gelir.)
//
// DÜRÜSTLÜK: liste yalnız backend'in GERÇEK kataloğundan gelir; yüklenemeyen
// lig "yüklenemedi" der, takım uydurulmaz. Takım adı kaynaktaki gibi kaydedilir.

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/utils.dart';
import '../../widgets/app_ui.dart';
import '../../widgets/states.dart';

class TeamPickerScreen extends StatefulWidget {
  const TeamPickerScreen({super.key});

  @override
  State<TeamPickerScreen> createState() => _TeamPickerScreenState();
}

class _TeamPickerScreenState extends State<TeamPickerScreen> {
  Map<String, dynamic>? _data;
  String? _error;
  String? _acikLig; // tek seferde bir lig açık
  String _arama = '';
  String? _kaydedilen; // kaydedilmekte olan takım adı

  @override
  void initState() {
    super.initState();
    _yukle();
  }

  Future<void> _yukle() async {
    try {
      final d = await api.favoriteTeams();
      if (mounted) setState(() => _data = (d as Map).cast<String, dynamic>());
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    }
  }

  Future<void> _sec(String name) async {
    if (_kaydedilen != null) return; // çifte tıklama koruması
    setState(() => _kaydedilen = name);
    try {
      await api.updateProfile({'favoriteTeam': name});
      await refreshUser();
      if (mounted) context.pop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      setState(() => _kaydedilen = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    Widget govde;
    if (_error != null) {
      govde = ErrorState(message: _error);
    } else if (_data == null) {
      govde = LoadingState(message: 'Takım listesi yükleniyor…');
    } else {
      govde = _liste();
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Takım Seç')),
      body: govde,
    );
  }

  Widget _liste() {
    // Arama: tüm liglerde takım adına göre süzer (Türkçe küçük/büyük duyarsız).
    // `kucukTr` kullanılır — Dart'ın toLowerCase()'i Türkçede yanlıştır (I→i).
    final aranan = kucukTr(_arama.trim());
    final ham = (_data?['leagues'] as List?) ?? const [];

    final ligler = <Map<String, dynamic>>[];
    for (final l in ham) {
      final lig = (l as Map).cast<String, dynamic>();
      final takimlar = ((lig['teams'] as List?) ?? const [])
          .cast<dynamic>()
          .toList();
      if (aranan.isEmpty) {
        ligler.add({...lig, 'teams': takimlar});
        continue;
      }
      final suzulmus = takimlar
          .where((t) => kucukTr('${(t as Map)['name'] ?? ''}').contains(aranan))
          .toList();
      if (suzulmus.isNotEmpty) ligler.add({...lig, 'teams': suzulmus});
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        Spacing.md,
        Spacing.md,
        Spacing.md,
        Spacing.xl,
      ),
      children: [
        Text(
          'Takımını Seç',
          style: TextStyle(
            color: AppColors.text,
            fontSize: 20,
            fontWeight: AppFont.black,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Ligini aç, takımına dokun — profilinde görünür.',
          style: TextStyle(color: AppColors.textMuted, fontSize: 12.5),
        ),
        const SizedBox(height: 12),
        TextField(
          onChanged: (v) => setState(() => _arama = v),
          style: TextStyle(color: AppColors.text, fontSize: 13.5),
          decoration: InputDecoration(
            hintText: 'Takım ara (tüm liglerde)',
            prefixIcon: Icon(Icons.search, size: 18, color: AppColors.muted),
            hintStyle: TextStyle(color: AppColors.textMuted),
            filled: true,
            fillColor: AppColors.card,
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 12,
              vertical: 9,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
              borderSide: BorderSide(color: AppColors.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
              borderSide: BorderSide(color: AppColors.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
              borderSide: BorderSide(color: AppColors.border),
            ),
          ),
        ),
        const SizedBox(height: 12),
        for (final lig in ligler) _ligKarti(lig, aranan.isNotEmpty),
        if (aranan.isNotEmpty && ligler.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Text(
              '"$_arama" için sonuç yok. Takımın listedeki liglerde olmayabilir.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textMuted, fontSize: 12.5),
            ),
          ),
      ],
    );
  }

  Widget _ligKarti(Map<String, dynamic> lig, bool aramaVar) {
    final key = '${lig['key']}';
    // Aramada HEPSİ açık — kullanıcı süzdüğü takımı görmek için ayrıca
    // ligi açmak zorunda kalmasın (kaynak aynen).
    final acik = aramaVar || _acikLig == key;
    final hatali = lig['error'] != null && lig['error'] != false;
    final takimlar = (lig['teams'] as List?) ?? const [];

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadow.soft,
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _acikLig = acik ? null : key),
            child: Padding(
              padding: const EdgeInsets.all(13),
              child: Row(
                children: [
                  Logo(
                    uri: lig['image'] as String?,
                    name: '${lig['label']}',
                    size: 24,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      '${lig['label']}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.text,
                        fontSize: 13.5,
                        fontWeight: AppFont.black,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    hatali ? '—' : '${takimlar.length}',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 12,
                      fontWeight: AppFont.bold,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    acik ? '▾' : '▸',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 13,
                      fontWeight: AppFont.black,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (acik)
            hatali
                ? const Padding(
                    padding: EdgeInsets.fromLTRB(13, 0, 13, 12),
                    child: SizedBox(
                      width: double.infinity,
                      child: Text(
                        'Bu ligin takım listesi yüklenemedi.',
                        style: TextStyle(
                          color: AppColors.warning,
                          fontSize: 12,
                          fontWeight: AppFont.semibold,
                        ),
                      ),
                    ),
                  )
                : Container(
                    decoration: BoxDecoration(
                      border: Border(top: BorderSide(color: AppColors.border)),
                    ),
                    child: Column(
                      children: [
                        for (final t in takimlar)
                          _takimSatiri((t as Map).cast<String, dynamic>()),
                      ],
                    ),
                  ),
        ],
      ),
    );
  }

  Widget _takimSatiri(Map<String, dynamic> t) {
    final ad = '${t['name']}';
    return InkWell(
      onTap: _kaydedilen != null ? null : () => _sec(ad),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.border)),
        ),
        child: Row(
          children: [
            Logo(uri: t['image'] as String?, name: ad, size: 26),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                ad,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: AppColors.text,
                  fontSize: 13,
                  fontWeight: AppFont.semibold,
                ),
              ),
            ),
            const SizedBox(width: 10),
            if (_kaydedilen == ad)
              SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AppColors.primary,
                ),
              )
            else
              Text(
                'Seç ›',
                style: TextStyle(
                  color: AppColors.accent,
                  fontSize: 12,
                  fontWeight: AppFont.black,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
