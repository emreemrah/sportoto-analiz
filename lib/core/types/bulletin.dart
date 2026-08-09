// KAYNAK: app/src/types/bulletin.js — BİREBİR çeviri.
//
// Bülten Geçmişi altyapısına dair durum sabitleri ve saf kurallar.
// Kaynakta JSDoc ile yazılmış tipler burada BELGE olarak kalır: veri
// backend'den `Map` olarak geldiği için Dart sınıfına dökmek, sunucu bir alan
// eklediğinde sessizce veri KAYBETME riski getirirdi.

abstract final class BulletinStatus {
  static const String draft = 'draft';
  static const String active = 'active';
  static const String locked = 'locked';
  static const String completed = 'completed';
  static const String cancelled = 'cancelled';
}

const Map<String, String> kBulletinStatusLabel = {
  BulletinStatus.draft: 'Taslak',
  BulletinStatus.active: 'Aktif',
  BulletinStatus.locked: 'Kilitli',
  BulletinStatus.completed: 'Tamamlandı',
  BulletinStatus.cancelled: 'İptal',
};

abstract final class MatchStatus {
  static const String notStarted = 'not_started';
  static const String live = 'live';
  static const String halfTime = 'half_time';
  static const String finished = 'finished';
  static const String postponed = 'postponed';
  static const String cancelled = 'cancelled';
  static const String suspended = 'suspended';
}

/// Bülten, ilk maçın başlama saatine göre "kilitlenmesi gerekiyor mu" sorusu.
/// Servis katmanında kullanılır — burada sadece saf/paylaşılan kural.
bool isPastFirstMatch(Map? bulletin, [DateTime? now]) {
  final iso = bulletin?['firstMatchStartAt'];
  if (iso == null || '$iso'.isEmpty) return false;
  final t = DateTime.tryParse('$iso');
  if (t == null) return false;
  return !t.isAfter(now ?? DateTime.now());
}

bool isBulletinLockable(Map bulletin, [DateTime? now]) {
  final s = bulletin['status'];
  return (s == BulletinStatus.active || s == BulletinStatus.draft) &&
      isPastFirstMatch(bulletin, now);
}
