// KAYNAK: app/src/screens/AvatarPickerScreen.js — BİREBİR çeviri.
//
// Hazır avatarlar kategori kategori ızgarada listelenir; birine dokununca
// profil sunucuda güncellenir, kullanıcı tazelenir ve ekran kapanır.

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../widgets/avatar.dart';

class AvatarPickerScreen extends StatelessWidget {
  const AvatarPickerScreen({super.key});

  Future<void> _sec(BuildContext context, String key) async {
    try {
      await api.updateProfile({'avatarType': 'preset', 'avatarKey': key});
      await refreshUser();
    } catch (e) {
      // Kaynakta `alert(e.message)`. Flutter'da karşılığı SnackBar.
      // `ApiException.toString()` zaten yalın mesajı döndürür — kullanıcıya
      // "Exception: ..." ön eki GÖSTERİLMEZ.
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
    // Kaynakta goBack() hata durumunda da çağrılıyor — aynen korunur.
    if (context.mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.bg,
    appBar: AppBar(title: const Text('Avatar Seç')),
    body: ValueListenableBuilder<AuthState>(
      valueListenable: authState,
      builder: (context, s, _) {
        // Yalnız 'preset' tipinde seçili anahtar vardır; yüklenmiş fotoğraf
        // kullanan kullanıcıda hiçbir kutu seçili görünmez (kaynak aynen).
        // Parantez ŞART: `as String?` içindeki `?` parantezsiz yazılınca
        // Dart onu üçlü işlecin `:` dalı sanır ve dosya derlenmez.
        final secili = s.user?['avatar_type'] == 'preset'
            ? (s.user?['avatar_key'] as String?)
            : null;
        return ListView(
          padding: const EdgeInsets.fromLTRB(
            Spacing.lg,
            Spacing.lg,
            Spacing.lg,
            Spacing.xl,
          ),
          children: [
            const Text(
              'Futbol temalı hazır avatarlar. Birine dokun, profilin güncellensin.',
              style: TextStyle(color: AppColors.textMuted, fontSize: 13),
            ),
            const SizedBox(height: Spacing.md),
            for (final c in kAvatarCategories)
              _Izgara(
                kategori: c,
                seciliKey: secili,
                onSelect: (k) => _sec(context, k),
              ),
          ],
        );
      },
    ),
  );
}

class _Izgara extends StatelessWidget {
  const _Izgara({
    required this.kategori,
    required this.seciliKey,
    required this.onSelect,
  });

  final AvatarKategori kategori;
  final String? seciliKey;
  final void Function(String) onSelect;

  @override
  Widget build(BuildContext context) {
    final items = presetsByCategory(kategori.key);
    if (items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: Spacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            kategori.label,
            style: const TextStyle(
              color: AppColors.text,
              fontSize: 15,
              fontWeight: AppFont.bold,
            ),
          ),
          const SizedBox(height: Spacing.sm),
          Wrap(
            spacing: Spacing.md,
            runSpacing: Spacing.md,
            children: [
              for (final p in items)
                _Kutu(
                  preset: p,
                  selected: seciliKey == p.key,
                  onTap: () => onSelect(p.key),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Kutu extends StatelessWidget {
  const _Kutu({
    required this.preset,
    required this.selected,
    required this.onTap,
  });

  final AvatarPreset preset;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: SizedBox(
      width: 76,
      child: Column(
        children: [
          Container(
            width: 58,
            height: 58,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: preset.bg,
              shape: BoxShape.circle,
              border: Border.all(
                width: 2,
                // Seçili değilken kaynakta 'transparent' — kenarlık payı
                // korunur ki seçince kutu ZIPLAMASIN.
                color: selected ? AppColors.primary : Colors.transparent,
              ),
            ),
            child: Text(
              preset.emoji,
              style: const TextStyle(fontSize: 30, height: 1.27),
            ),
          ),
          const SizedBox(height: 5),
          Text(
            preset.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.textMuted,
              fontSize: 10.5,
              fontWeight: AppFont.semibold,
            ),
          ),
        ],
      ),
    ),
  );
}
