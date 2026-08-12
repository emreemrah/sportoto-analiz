// KAYNAK: app/src/screens/DevicesScreen.js — BİREBİR çeviri.
//
// BAĞLI CİHAZLAR — kullanıcının etkin oturumları; istediği cihazı UZAKTAN kapatır.
//
//   • Liste sunucudan gelir; yalnız KENDİ oturumların görünür.
//   • "Oturumu Kapat" sunucudaki kaydı iptal eder: o cihazın yenilemesi ve
//     korumalı istekleri anında reddedilir.
//   • Bu cihazın oturumu "Bu cihaz" olarak işaretlenir ve buradan kapatılmaz
//     (çıkış için Profil → Çıkış Yap).

import 'package:flutter/material.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../widgets/screen_backdrop.dart';

/// Platform simgeleri VEKTÖR (kullanıcı isteği, 2026-08-12): emoji rengi
/// tema ile değişmiyordu; cihaz kartı koyu temada dönerken simge sabit
/// kalıyordu.
const Map<String, IconData> _platformIcon = {
  'android': Icons.android,
  'ios': Icons.phone_iphone,
  'web': Icons.language,
};

/// Kaynaktaki `timeAgo`.
String timeAgo(Object? iso) {
  if (iso == null || '$iso'.isEmpty) return '—';
  final d = DateTime.tryParse('$iso');
  if (d == null) return '—';
  final diff = DateTime.now().difference(d).inMilliseconds;
  final m = diff ~/ 60000;
  if (m < 1) return 'şimdi';
  if (m < 60) return '$m dk önce';
  final h = m ~/ 60;
  if (h < 24) return '$h saat önce';
  return '${h ~/ 24} gün önce';
}

/// Kaynakta `new Date(iso).toLocaleDateString('tr-TR')` → "9.08.2026".
String trTarih(Object? iso) {
  if (iso == null) return '—';
  final d = DateTime.tryParse('$iso')?.toLocal();
  if (d == null) return '—';
  return '${d.day}.${d.month.toString().padLeft(2, '0')}.${d.year}';
}

class DevicesScreen extends StatefulWidget {
  const DevicesScreen({super.key});

  @override
  State<DevicesScreen> createState() => _DevicesScreenState();
}

class _DevicesScreenState extends State<DevicesScreen> {
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
      final d = await api.sessions();
      if (mounted) setState(() => _data = (d as Map).cast<String, dynamic>());
    } catch (e) {
      if (mounted) setState(() => _err = '$e');
    }
  }

  Future<void> _revoke(Object id) async {
    setState(() {
      _busyId = id;
      _err = null;
    });
    try {
      await api.revokeSession(id);
      await _load();
    } catch (e) {
      if (mounted) setState(() => _err = '$e');
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final oturumlar = (_data?['sessions'] as List?) ?? const [];
    final not = _data?['note'];

    return Scaffold(
      appBar: AppBar(title: const Text('Bağlı Cihazlar')),
      body: ScreenBackdrop(
        child: RefreshIndicator(
          color: AppColors.primary,
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.all(Spacing.lg),
            children: [
              Text(
                'Bağlı Cihazlar',
                style: TextStyle(
                  color: AppColors.onBackground,
                  fontSize: 22,
                  fontWeight: AppFont.heavy,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Hesabına açık oturumlar aşağıda. Tanımadığın bir cihaz görürsen oturumunu '
                'kapat ve şifreni değiştir.',
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
              if (_data == null)
                Padding(
                  padding: EdgeInsets.only(top: Spacing.lg),
                  child: Center(
                    child: CircularProgressIndicator(color: AppColors.primary),
                  ),
                ),
              if (not != null) _Not('$not'),
              for (final s in oturumlar)
                _satir((s as Map).cast<String, dynamic>()),
              // Not zaten "premium/oturum sistemi yok" gibi bir açıklama
              // taşıyorsa ikinci bir "etkin oturum yok" satırı EKLENMEZ —
              // kaynaktaki `!data.note` koşulu aynen korunur.
              if (_data != null && not == null && oturumlar.isEmpty)
                const _Not('Etkin oturum görünmüyor.'),
            ],
          ),
        ),
      ),
    );
  }

  Widget _satir(Map<String, dynamic> s) {
    final current = s['current'] == true;
    final id = s['id'];
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
          Icon(
            _platformIcon['${s['platform']}'] ?? Icons.desktop_windows_outlined,
            size: 26,
            color: AppColors.textSoft,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RichText(
                  text: TextSpan(
                    style: TextStyle(
                      color: AppColors.text,
                      fontSize: 14.5,
                      fontWeight: AppFont.heavy,
                    ),
                    children: [
                      TextSpan(text: '${s['deviceName']}'),
                      if (current) ...[
                        const TextSpan(text: '  '),
                        const TextSpan(
                          text: 'Bu cihaz',
                          style: TextStyle(
                            color: AppColors.green,
                            fontSize: 11.5,
                            fontWeight: AppFont.heavy,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: 3),
                  child: Text(
                    'Son görülme: ${timeAgo(s['lastSeenAt'])} · Giriş: ${trTarih(s['createdAt'])}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: AppColors.textMuted, fontSize: 11),
                  ),
                ),
              ],
            ),
          ),
          if (!current) ...[
            const SizedBox(width: 12),
            GestureDetector(
              onTap: _busyId == id ? null : () => _revoke(id as Object),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                  border: Border.all(color: AppColors.red),
                ),
                child: _busyId == id
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.red,
                        ),
                      )
                    : const Text(
                        'Oturumu Kapat',
                        maxLines: 1,
                        style: TextStyle(
                          color: AppColors.red,
                          fontSize: 12,
                          fontWeight: AppFont.heavy,
                        ),
                      ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Not extends StatelessWidget {
  const _Not(this.metin);

  final String metin;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: Spacing.md),
    child: Text(
      metin,
      textAlign: TextAlign.center,
      style: TextStyle(
        color: AppColors.textMuted,
        fontSize: 12.5,
        height: 18 / 12.5,
      ),
    ),
  );
}
