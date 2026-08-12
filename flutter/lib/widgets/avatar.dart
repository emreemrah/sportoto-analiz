// KAYNAK: app/src/avatars.js + app/src/components.js → AvatarView /
// ProfileAvatar / CommentAvatar. BİREBİR çeviri.
//
// Hazır futbol temalı avatarlar.
// Binary asset / telifli logo YOK: her avatar = emoji + renkli yuvarlak zemin.
// Bu sayede her platformda net görünür, lisans/asset derdi olmaz.

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../core/auth.dart';
import '../core/theme/tokens.dart';

class AvatarKategori {
  const AvatarKategori(this.key, this.label);
  final String key;
  final String label;
}

const List<AvatarKategori> kAvatarCategories = [
  AvatarKategori('balls', 'Toplar'),
  AvatarKategori('pitch', 'Saha'),
  AvatarKategori('goal', 'Kale'),
  AvatarKategori('tactics', 'Taktik'),
  AvatarKategori('jersey', 'Forma'),
  AvatarKategori('score', 'Tahmin / Skor'),
];

class AvatarPreset {
  const AvatarPreset({
    required this.key,
    required this.cat,
    required this.emoji,
    required this.bg,
    required this.label,
  });

  final String key;
  final String cat;
  final String emoji;
  final Color bg;
  final String label;
}

const List<AvatarPreset> kAvatarPresets = [
  // Toplar
  AvatarPreset(
    key: 'ball_01',
    cat: 'balls',
    emoji: '⚽',
    bg: Color(0xFF16A34A),
    label: 'Futbol Topu',
  ),
  AvatarPreset(
    key: 'ball_02',
    cat: 'balls',
    emoji: '⚽',
    bg: Color(0xFF0F766E),
    label: 'Maç Topu',
  ),
  // Saha
  AvatarPreset(
    key: 'pitch_top_01',
    cat: 'pitch',
    emoji: '🏟️',
    bg: Color(0xFF15803D),
    label: 'Saha (üstten)',
  ),
  AvatarPreset(
    key: 'pitch_01',
    cat: 'pitch',
    emoji: '🌱',
    bg: Color(0xFF22C55E),
    label: 'Yeşil Saha',
  ),
  AvatarPreset(
    key: 'midfield_01',
    cat: 'pitch',
    emoji: '🟢',
    bg: Color(0xFF166534),
    label: 'Orta Saha',
  ),
  AvatarPreset(
    key: 'lights_01',
    cat: 'pitch',
    emoji: '🌃',
    bg: Color(0xFF0F766E),
    label: 'Gece Işıkları',
  ),
  // Kale
  AvatarPreset(
    key: 'goal_01',
    cat: 'goal',
    emoji: '🥅',
    bg: Color(0xFF0EA5E9),
    label: 'Kale',
  ),
  AvatarPreset(
    key: 'gloves_01',
    cat: 'goal',
    emoji: '🧤',
    bg: Color(0xFF2563EB),
    label: 'Kaleci Eldiveni',
  ),
  // Taktik
  AvatarPreset(
    key: 'tactics_01',
    cat: 'tactics',
    emoji: '📋',
    bg: Color(0xFF7C3AED),
    label: 'Taktik Tahtası',
  ),
  AvatarPreset(
    key: 'boot_01',
    cat: 'tactics',
    emoji: '👟',
    bg: Color(0xFFB45309),
    label: 'Krampon',
  ),
  AvatarPreset(
    key: 'card_01',
    cat: 'tactics',
    emoji: '🟨',
    bg: Color(0xFFCA8A04),
    label: 'Kart',
  ),
  // Forma
  AvatarPreset(
    key: 'jersey_01',
    cat: 'jersey',
    emoji: '👕',
    bg: Color(0xFFDC2626),
    label: 'Forma (kırmızı)',
  ),
  AvatarPreset(
    key: 'jersey_02',
    cat: 'jersey',
    emoji: '👕',
    bg: Color(0xFF1D4ED8),
    label: 'Forma (mavi)',
  ),
  // Tahmin / Skor
  AvatarPreset(
    key: 'scoreboard_01',
    cat: 'score',
    emoji: '🔢',
    bg: Color(0xFF334155),
    label: 'Skor Tabelası',
  ),
  AvatarPreset(
    key: 'trophy_01',
    cat: 'score',
    emoji: '🏆',
    bg: Color(0xFFCA8A04),
    label: 'Kupa',
  ),
  AvatarPreset(
    key: 'pick_1',
    cat: 'score',
    emoji: '1️⃣',
    bg: Color(0xFF2DD4BF),
    label: 'Tahmin 1',
  ),
  AvatarPreset(
    key: 'pick_x',
    cat: 'score',
    emoji: '✖️',
    bg: Color(0xFF64748B),
    label: 'Tahmin X',
  ),
  AvatarPreset(
    key: 'pick_2',
    cat: 'score',
    emoji: '2️⃣',
    bg: Color(0xFFFBBF24),
    label: 'Tahmin 2',
  ),
];

/// Varsayılan avatar (avatar seçilmemiş / kaldırılmış kullanıcı)
const AvatarPreset kDefaultAvatar = AvatarPreset(
  key: 'default',
  cat: '',
  emoji: '⚽',
  bg: Color(0xFF16A34A),
  label: 'Varsayılan',
);

AvatarPreset getPreset(Object? key) {
  for (final p in kAvatarPresets) {
    if (p.key == key) return p;
  }
  return kDefaultAvatar;
}

List<AvatarPreset> presetsByCategory(String catKey) =>
    kAvatarPresets.where((p) => p.cat == catKey).toList();

/// `components.js` → `AvatarView`
class AvatarView extends StatelessWidget {
  // `const` DEĞİL — BİLEREK (2026-08-12): bu widget rengini `AppColors`
  // küresellerinden okuyor ve tema çalışma zamanında değişiyor. `const`
  // yapıcı widget örneğini sabitler; Flutter aynı örneği görünce alt ağacı
  // YENİDEN KURMAZ ve widget eski renkte donar (emülatörde ölçüldü:
  // Dortmund temasında kupon boş-durum kartı Galatasaray bordosunda kaldı).
  // ignore: prefer_const_constructors_in_immutables
  AvatarView({
    super.key,
    required this.size,
    this.type,
    this.avatarKey,
    this.avatarUrl,
  });

  final double size;
  final String? type;
  final String? avatarKey;
  final String? avatarUrl;

  @override
  Widget build(BuildContext context) {
    if (type == 'uploaded' && avatarUrl != null && avatarUrl!.isNotEmpty) {
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: avatarUrl!,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorWidget: (_, _, _) => _preset(kDefaultAvatar),
          placeholder: (_, _) =>
              Container(width: size, height: size, color: AppColors.cardAlt),
        ),
      );
    }
    return _preset(type == 'preset' ? getPreset(avatarKey) : kDefaultAvatar);
  }

  Widget _preset(AvatarPreset pre) => Container(
    width: size,
    height: size,
    alignment: Alignment.center,
    decoration: BoxDecoration(color: pre.bg, shape: BoxShape.circle),
    child: Text(
      pre.emoji,
      style: TextStyle(fontSize: size * 0.55, height: 1.27),
    ),
  );
}

/// Profil ekranı — büyük avatar (mevcut giriş yapan kullanıcı).
/// Giriş yoksa varsayılan top.
class ProfileAvatar extends StatelessWidget {
  const ProfileAvatar({super.key, this.size = 96});

  final double size;

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<AuthState>(
    valueListenable: authState,
    builder: (_, s, _) => AvatarView(
      size: size,
      type: s.user?['avatar_type'] as String?,
      avatarKey: s.user?['avatar_key'] as String?,
      avatarUrl: s.user?['avatar_url'] as String?,
    ),
  );
}

/// Yorum kartı — küçük yuvarlak avatar. Yorumun YAZARINDAN okunur
/// (profilden, sabit URL değil).
class CommentAvatar extends StatelessWidget {
  const CommentAvatar({super.key, this.size = 28, this.author});

  final double size;
  final Map? author;

  @override
  Widget build(BuildContext context) => AvatarView(
    size: size,
    type: author?['avatarType'] as String?,
    avatarKey: author?['avatarKey'] as String?,
    avatarUrl: author?['avatarUrl'] as String?,
  );
}
