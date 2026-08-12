// KAYNAK: app/src/screens/BlockedUsersScreen.js — BİREBİR çeviri.
//
// ENGELLENEN KULLANICILAR — kullanıcının kendi engel listesi (E9).
//
//   • Liste sunucudan gelir ve YALNIZ kendi engellerin görünür.
//   • "Beni kim engelledi" diye bir ekran YOKTUR ve olmayacaktır: engel karşı
//     tarafa ilan edilmez. Bunu göstermek, engelin kendisini bir tacize
//     dönüştürürdü.
//   • Engel geri alınabilir. Google Play, engelleme sunan uygulamalarda geri
//     almanın da uygulama içinden erişilebilir olmasını bekler.
//   • Hesabı silinmiş kişi listeden DÜŞMEZ, "Silinmiş kullanıcı" diye
//     etiketlenir. Satırı gizlemek, kullanıcıya engelinin kendiliğinden
//     kalktığı izlenimini verirdi.

import 'package:flutter/material.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../widgets/avatar.dart';
import '../../widgets/screen_backdrop.dart';
import 'devices_screen.dart' show trTarih;

class BlockedUsersScreen extends StatefulWidget {
  const BlockedUsersScreen({super.key});

  @override
  State<BlockedUsersScreen> createState() => _BlockedUsersScreenState();
}

class _BlockedUsersScreenState extends State<BlockedUsersScreen> {
  Map<String, dynamic>? _data;
  String? _err;
  Object? _busyId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() => _err = null);
    try {
      final d = await api.blocks();
      if (mounted) setState(() => _data = (d as Map).cast<String, dynamic>());
    } catch (e) {
      if (mounted) setState(() => _err = '$e');
    }
  }

  Future<void> _kaldir(Object userId) async {
    setState(() {
      _busyId = userId;
      _err = null;
    });
    try {
      await api.unblockUser(userId);
      await _load();
    } catch (e) {
      if (mounted) setState(() => _err = '$e');
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final list = (_data?['blocks'] as List?) ?? const [];

    return Scaffold(
      appBar: AppBar(title: const Text('Engellenen Kullanıcılar')),
      body: ScreenBackdrop(
        child: RefreshIndicator(
          color: AppColors.primary,
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.all(Spacing.lg),
            children: [
              Text(
                'Engellenen Kullanıcılar',
                style: TextStyle(
                  color: AppColors.onBackground,
                  fontSize: 22,
                  fontWeight: AppFont.heavy,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Engellediğin kişilerin yorumlarını görmezsin, onlar da seninkileri göremez. '
                'Engellediğin kişiye bildirim gitmez. İstediğin zaman engeli kaldırabilirsin.',
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 12.5,
                  height: 18 / 12.5,
                ),
              ),
              const SizedBox(height: Spacing.md),
              if (_err != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: Spacing.sm),
                  child: Text(
                    _err!,
                    style: const TextStyle(
                      color: AppColors.red,
                      fontSize: 13,
                      fontWeight: AppFont.semibold,
                    ),
                  ),
                ),
              if (_data == null && _err == null)
                Padding(
                  padding: EdgeInsets.only(top: Spacing.lg),
                  child: Center(
                    child: CircularProgressIndicator(color: AppColors.primary),
                  ),
                ),
              for (final b in list) _satir((b as Map).cast<String, dynamic>()),
              if (_data != null && list.isEmpty)
                Padding(
                  padding: EdgeInsets.only(top: Spacing.md),
                  child: Text(
                    'Engellediğin kimse yok. Bir kullanıcıyı, yorumunun altındaki “Engelle” '
                    'düğmesinden engelleyebilirsin.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 12.5,
                      height: 18 / 12.5,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _satir(Map<String, dynamic> b) {
    final id = b['userId'];
    return Container(
      margin: const EdgeInsets.only(bottom: Spacing.sm),
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          CommentAvatar(
            size: 38,
            author: {
              'username': b['username'],
              'avatarType': b['avatarType'],
              'avatarKey': b['avatarKey'],
              'avatarUrl': b['avatarUrl'],
            },
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${b['username']}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.text,
                    fontSize: 14.5,
                    fontWeight: AppFont.heavy,
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: 3),
                  child: Text(
                    'Engellendi: ${trTarih(b['createdAt'])}',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          GestureDetector(
            onTap: _busyId == id ? null : () => _kaldir(id as Object),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppRadius.sm),
                border: Border.all(color: AppColors.primary),
              ),
              child: _busyId == id
                  ? SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.primary,
                      ),
                    )
                  : Text(
                      'Engeli Kaldır',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontSize: 12,
                        fontWeight: AppFont.heavy,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
