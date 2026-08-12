// KAYNAK: app/src/screens/CouponEditorScreen.js (505 satır)
//
// KUPON EDİTÖRÜ — Kupon Merkezi'nin hazırlama ekranı.
// • Resmi bültendeki 15 maç, bülten SIRASI bozulmadan listelenir.
// • Her maçta 1/X/2 tekli-çifte-üçlü; kolon + maliyet ANLIK güncellenir.
// • Maliyet yalnız GERÇEK fiyat verisiyle (couponPricing: kaynak+tarih)
//   görünür; veri yoksa "birim bedel verisi yok" denir — YANLIŞ MALİYET
//   GÖSTERİLMEZ.
// • Kilitli maçta düzenleme YOK (geriye dönük başarı üretilmez).
//
// KAYNAKTAN TAŞINAN ÜÇ DÜRÜSTLÜK KURALI:
//
//  1. YENİ kuponda BAŞLAMIŞ maçların taslak seçimleri DÜŞÜRÜLÜR. Taslak
//     kayıtlı kupon değildir; kilitten önce yapıldığı KANITLANAMAZ. Bu maçlar
//     boş kalır ve ekranda "başladı — boş" olarak açıkça görünür.
//
//  2. KOLON SINIRI KAYDI ENGELLEMEZ (kullanıcı kararı, 2026-08-04): resmî
//     sınırın (2500) üstünde de kayıt yapılır; kullanıcı yalnız açıkça UYARILIR
//     ve kararı kendisi verir. Uyarı sınırı söylemeye devam eder — bilgi
//     saklanmaz.
//
//  3. BOŞ KALAN MAÇLAR: kullanıcı seçim yapmadan başlayan maçlar kuponda BOŞ
//     kalır ve İSABET SAYILMAZ. Kaydetmeden önce bu açıkça söylenir.
//
// AKTARIM: "⚙ Sistem" ve "✍️ Seçimim" düğmeleri kaynaktakiyle aynı. Aktarım
// mevcut seçimi ASLA sessizce ezmez; önce fark listesi gösterilir.
//
// AKILLI KUPON düğmesi YOK — kaynakta da yok. Kaynakta modal kodu duruyor ama
// `setSmartOpen(true)` hiçbir yerden çağrılmıyor (2026-08-04'te düğme kullanıcı
// kararıyla kaldırılmış, dosyadaki yorum bunu söylüyor). Saf mantık yine de
// core/coupon/smart.dart'a çevrildi ve testlendi.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/coupon/coupon_config.dart';
import '../../core/coupon/coupon_store.dart';
import '../../core/coupon/smart.dart';
import '../../core/network/api_client.dart';
import '../../core/prefs.dart';
import '../../core/theme/tokens.dart';
import '../../core/utils.dart';
import '../../widgets/app_ui.dart';

String _fmtTL(num n) {
  final s = n.round().toString();
  final buf = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) buf.write('.');
    buf.write(s[i]);
  }
  return '$buf TL';
}

final _editorBulletinProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>(
      (ref) async => Map<String, dynamic>.from(await api.bulletin() as Map),
    );

/// ANKET DAĞILIMI — bültenin TAMAMI için TEK istek (`/ms-summary`).
///
/// Uç zaten bunun için var: "maç başına ayrı istek atılmaz; 15 maçlık bülten
/// tek istekte gelir". Anahtar `sportotoMatchId`'lerin virgülle birleştirilmiş
/// hâlidir — family anahtarı karşılaştırılabilir olmalı, liste olamaz.
final _anketDagilimiProvider = FutureProvider.autoDispose
    .family<Map<String, Map<String, int>>, String>((ref, kimlikler) async {
      if (kimlikler.isEmpty) return const {};
      final d = await api.msSummary(kimlikler.split(','));
      final ozet = (d is Map ? d['summary'] : null) as Map?;
      return {
        for (final e in (ozet ?? const {}).entries)
          '${e.key}': {
            for (final k in const ['total', 'home', 'draw', 'away'])
              k: ((e.value as Map?)?[k] as num?)?.toInt() ?? 0,
          },
      };
    });

/// Kupon türü tercihi (`prefs.couponSysMode`).
///
/// EKRANDA İKİ TÜR VAR: "Tekli Kupon" ve "Geniş Kupon" (= otomatik karar).
/// Diskte bu ikisinin dışında bir değer kalmış olabilir — tercih önce
/// 'single'|'wide' idi, sonra dört değerli oldu. Ekranda karşılığı olmayan bir
/// kayıt GENİŞ sayılır; yoksa hiçbir çip seçili görünmez ve kullanıcı hangi
/// türde olduğunu ekrandan okuyamazdı.
AktarimGenisligi genislikTercihi() => getPref('couponSysMode') == 'single'
    ? AktarimGenisligi.tekli
    : AktarimGenisligi.otomatik;

String genislikAnahtari(AktarimGenisligi g) => switch (g) {
  AktarimGenisligi.otomatik => 'auto',
  AktarimGenisligi.tekli => 'single',
  AktarimGenisligi.cifte => 'double',
  AktarimGenisligi.kapali => 'closed',
};

class CouponEditorScreen extends ConsumerStatefulWidget {
  const CouponEditorScreen({super.key, required this.roundId, this.couponId});

  final Object roundId;
  final Object? couponId;

  @override
  ConsumerState<CouponEditorScreen> createState() => _CouponEditorScreenState();
}

class _CouponEditorScreenState extends ConsumerState<CouponEditorScreen> {
  /// Sistem/Anket aktarımının genişliği. Tercih diskte saklanır; kullanıcı
  /// her kupon açtığında yeniden seçmek zorunda kalmasın.
  late AktarimGenisligi _genislik = genislikTercihi();

  final Map<String, List<String>> _picks = {};

  /// AKTARIM DAMGALARI (2026-08-11): maç no → {secim, zaman, kaynak, …}.
  /// Sistem/radar önerisi kupona aktarıldığında yazılır; elle yapılan seçim
  /// damga BIRAKMAZ. Kupon kaydedilirken sürüme geçer ve bir daha değişmez.
  /// Neden: sistem önerisi kilide dek değişebiliyor, kullanıcının hangi
  /// değeri ne zaman aldığı sonradan kanıtlanamıyordu.
  final Map<String, Map<String, dynamic>> _aktarimlar = {};
  final _nameCtl = TextEditingController();
  bool _saving = false;
  bool _baslatildi = false;

  @override
  void initState() {
    super.initState();
    // Başlangıç seçimi: mevcut kupon → final versiyon; yeni kupon → KUPONA
    // İŞLE taslağı.
    if (widget.couponId != null) {
      final c = getCoupon(widget.couponId);
      final v = c != null ? finalVersion(c) : null;
      if (v != null) {
        for (final sc in ((v['selections'] as List?) ?? const []).cast<Map>()) {
          final o = ((sc['selectedOutcomes'] as List?) ?? const [])
              .cast<String>();
          if (o.isNotEmpty) _picks['${sc['no']}'] = o;
        }
        _nameCtl.text = '${c?['name'] ?? ''}';
        return;
      }
    }
    final d = getDraft(widget.roundId);
    final picks = (d['picks'] as Map?) ?? const {};
    for (final e in picks.entries) {
      if (e.value is List) {
        _picks['${e.key}'] = (e.value as List).cast<String>();
      }
    }
  }

  @override
  void dispose() {
    _nameCtl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_editorBulletinProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.couponId != null ? 'Kuponu Düzenle' : 'Kupon Hazırla',
        ),
      ),
      body: async.when(
        loading: () =>
            Center(child: CircularProgressIndicator(color: AppColors.primary)),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: EmptyState(
              icon: '⚠️',
              title: 'Bülten alınamadı',
              message: '$e',
            ),
          ),
        ),
        data: (data) {
          if (data['roundId'] != widget.roundId) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: EmptyState(
                  icon: '🔒',
                  title: 'Bu hafta güncel bülten değil',
                  message: 'Kupon yalnız güncel bültende hazırlanır.',
                ),
              ),
            );
          }
          return _govde(data);
        },
      ),
    );
  }

  Widget _govde(Map<String, dynamic> data) {
    final matches = (data['matches'] as List?) ?? const []; // bülten sırası
    final lockAt = lockAtOf(matches);
    final lockMap = lockMapOf(matches);
    final now = DateTime.now();

    final lockedNos = <Object>{
      for (final m in matches.cast<Map>())
        if (lockMap[m['no']] case final la?)
          if (!now.isBefore(la)) m['no'] as Object,
    };

    // YENİ kuponda başlamış maçların taslak seçimleri DÜŞÜRÜLÜR (bir kez).
    if (!_baslatildi && widget.couponId == null) {
      _baslatildi = true;
      final atilacak = _picks.keys
          .where((k) => lockedNos.any((n) => '$n' == k))
          .toList();
      if (atilacak.isNotEmpty) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          setState(() {
            for (final k in atilacak) {
              _picks.remove(k);
            }
          });
        });
      }
    }

    final allLocked = matches.isNotEmpty && lockedNos.length == matches.length;

    final pricingRaw = data['couponPricing'] as Map?;
    final pricing = validPricing(pricingRaw) ? pricingRaw : null;

    final selections = matches
        .cast<Map>()
        .map(
          (m) => CouponSelection(
            no: m['no'] as Object,
            selectedOutcomes: _picks['${m['no']}'] ?? const [],
          ),
        )
        .toList();
    final filled = selections
        .where((s) => s.selectedOutcomes.isNotEmpty)
        .toList();
    final cols = columnCount(filled.isNotEmpty ? filled : const []);
    final cost = costOf(cols, pricing);
    final overLimit = cols > kCouponMaxColumns;

    final openMatches = matches
        .cast<Map>()
        .where((m) => !lockedNos.contains(m['no']))
        .toList();
    final eksikAcik = openMatches
        .where((m) => (_picks['${m['no']}'] ?? const []).isEmpty)
        .length;
    final emptyLockedCount = matches
        .cast<Map>()
        .where(
          (m) =>
              lockedNos.contains(m['no']) &&
              (_picks['${m['no']}'] ?? const []).isEmpty,
        )
        .length;

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(Spacing.md),
            children: [
              TextField(
                controller: _nameCtl,
                maxLength: 40,
                buildCounter:
                    (
                      _, {
                      required currentLength,
                      required isFocused,
                      maxLength,
                    }) => null,
                style: TextStyle(color: AppColors.text, fontSize: 14),
                decoration: InputDecoration(
                  labelText: 'Kupon adı (isteğe bağlı)',
                  labelStyle: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 12,
                  ),
                  filled: true,
                  fillColor: AppColors.card,
                  isDense: true,
                  border: OutlineInputBorder(
                    borderRadius: AppRadius.mdR,
                    borderSide: BorderSide(color: AppColors.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: AppRadius.mdR,
                    borderSide: BorderSide(color: AppColors.border),
                  ),
                ),
              ),
              const SizedBox(height: 10),

              if (allLocked)
                _serit(
                  '🔒 Tüm maçlar başladı — bu hafta kupon kaydedilemez / '
                  'değiştirilemez.',
                  AppColors.warning,
                )
              else if (lockedNos.isNotEmpty)
                _serit(
                  '🔒 ${lockedNos.length} maç başladı; onların seçimi '
                  'değiştirilemez. Kalan ${openMatches.length} maç açık.',
                  AppColors.warning,
                ),

              for (final m in matches.cast<Map>())
                _macSatiri(m, lockedNos.contains(m['no'])),

              // AKTARIM SEÇENEKLERİ (kaynaktaki 2026-08-07 güncellemesi):
              //   • Sistem  → bülten maç kartındaki resmî tahminler
              //   • Seçimim → elle seçim: otomatik dolguları temizler
              // "Kriter" seçeneği KAYNAKTA KALDIRILDI: kullanıcının kriter
              // seçme sistemi kalktığı için o düğme "Sistem" ile aynı hesabı
              // yapardı.
              //
              // AKILLI KUPON DÜĞMESİ YOK — kaynakta da yok (2026-08-04'te
              // kaldırılmış; modal kodu duruyor ama hiçbir yerden açılmıyor).
              // Saf mantığı core/coupon/smart.dart'a çevrildi ve testlendi;
              // düğme kaynağa geri gelirse buradan bağlanır.
              if (!allLocked) ...[
                // GENİŞLİK SEÇİMİ (kullanıcı isteği, 2026-08-11): sistem ve
                // anket aktarımı tekli / çifte / kapalı yapılabilir.
                _genislikSecici(),
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Row(
                    children: [
                      Expanded(
                        child: _aktarimDugmesi(
                          '⚙ Sistem',
                          () => _aktarimBaslat(matches, lockedNos, 'system'),
                        ),
                      ),
                      const SizedBox(width: Spacing.sm),
                      Expanded(
                        child: _aktarimDugmesi(
                          // TOPLULUK KUPONU: analiz yapmadan, yalnız
                          // kullanıcıların oy dağılımına göre doldurur.
                          '🗳️ Topluluk',
                          () => _aktarimBaslat(matches, lockedNos, 'anket'),
                        ),
                      ),
                      const SizedBox(width: Spacing.sm),
                      Expanded(
                        child: _aktarimDugmesi(
                          '✍️ Seçimim',
                          () => _secimimTemizle(lockedNos),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),

        // ── ALT ÇUBUK: kolon + maliyet + kaydet ──
        Container(
          padding: const EdgeInsets.all(Spacing.md),
          decoration: BoxDecoration(
            color: AppColors.surface,
            border: Border(top: BorderSide(color: AppColors.border)),
          ),
          child: SafeArea(
            top: false,
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Kolon: $cols'
                        '${overLimit ? '  ⚠ sınır $kCouponMaxColumns' : ''}',
                        style: TextStyle(
                          color: overLimit ? AppColors.warning : AppColors.text,
                          fontSize: 13,
                          fontWeight: AppFont.black,
                        ),
                      ),
                      Text(
                        // FİYAT UYDURULMAZ.
                        cost != null ? _fmtTL(cost) : 'birim bedel verisi yok',
                        style: TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 11,
                          fontWeight: AppFont.bold,
                        ),
                      ),
                    ],
                  ),
                ),
                Opacity(
                  opacity: (_saving || allLocked) ? 0.5 : 1,
                  child: GestureDetector(
                    onTap: (_saving || allLocked)
                        ? null
                        : () => _kaydet(
                            data: data,
                            matches: matches,
                            lockMap: lockMap,
                            lockAt: lockAt,
                            cols: cols,
                            overLimit: overLimit,
                            eksikAcik: eksikAcik,
                            emptyLockedCount: emptyLockedCount,
                          ),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 22,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: AppRadius.mdR,
                      ),
                      child: Text(
                        _saving ? '…' : 'Kaydet',
                        style: TextStyle(
                          color: AppColors.onPrimary,
                          fontSize: 14,
                          fontWeight: AppFont.black,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _macSatiri(Map m, bool kilitli) {
    final secim = _picks['${m['no']}'] ?? const <String>[];
    final home = m['home'] as Map?;
    final away = m['away'] as Map?;
    final d = matchDate(m['date'] as String?);

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: AppRadius.mdR,
        border: Border.all(
          color: kilitli ? AppColors.border : AppColors.border,
        ),
      ),
      child: Opacity(
        opacity: kilitli ? 0.6 : 1,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                SizedBox(
                  width: 20,
                  child: Text(
                    '${m['no']}',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11,
                      fontWeight: AppFont.black,
                    ),
                  ),
                ),
                Logo(
                  uri: crestOf(m.cast<String, dynamic>(), 'home'),
                  name: home?['name'] as String?,
                  size: 18,
                ),
                const SizedBox(width: 5),
                Expanded(
                  child: Text(
                    '${home?['mediumName'] ?? home?['name'] ?? ''} – '
                    '${away?['mediumName'] ?? away?['name'] ?? ''}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.text,
                      fontSize: 12.5,
                      fontWeight: AppFont.heavy,
                    ),
                  ),
                ),
                const SizedBox(width: 5),
                Logo(
                  uri: crestOf(m.cast<String, dynamic>(), 'away'),
                  name: away?['name'] as String?,
                  size: 18,
                ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Text(
                  kilitli
                      ? (secim.isEmpty ? 'başladı — boş' : 'başladı — kilitli')
                      : '${d.day} ${d.time}',
                  style: TextStyle(
                    color: kilitli ? AppColors.warning : AppColors.textMuted,
                    fontSize: 10.5,
                    fontWeight: AppFont.bold,
                  ),
                ),
                const Spacer(),
                for (final o in kOutcomes) ...[
                  _kutu(o, secim.contains(o), kilitli, m['no'] as Object),
                  const SizedBox(width: 6),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _aktarimDugmesi(String metin, VoidCallback onTap) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.cardAlt,
        borderRadius: AppRadius.smR,
        border: Border.all(color: AppColors.border),
      ),
      child: Text(
        metin,
        style: TextStyle(
          color: AppColors.textSoft,
          fontSize: 12.5,
          fontWeight: AppFont.heavy,
        ),
      ),
    ),
  );

  /// AKTARIM: önce fark, sonra kullanıcı kararı. Mevcut seçim ASLA sessizce
  /// ezilmez.
  /// Aktarımın KAYNAK ANALİZ KİMLİĞİ — sunucunun o anki bülten kaydı.
  ///
  /// `updatedAt` analizin üretildiği an, `verification.signature` resmî
  /// bültenin karması, `bulletinId` arşiv kimliğidir. Üçü birlikte, aktarılan
  /// değerin HANGİ hesaba ait olduğunu sonradan kanıtlar; sunucudaki gözlem
  /// serisiyle (observations) eşleştirilebilir. Bülten okunamazsa alan
  /// yazılmaz — uydurma kimlik üretilmez.
  Map<String, dynamic> _kaynakAnalizKimligi() {
    final b = ref.read(_editorBulletinProvider).valueOrNull;
    if (b == null) return const {};
    final v = b['verification'];
    final a = b['archive'];
    return {
      if (b['updatedAt'] != null) 'analizZamani': '${b['updatedAt']}',
      if (v is Map && v['signature'] != null)
        'bultenImzasi': '${v['signature']}',
      if (a is Map && a['bulletinId'] != null)
        'bulletinId': '${a['bulletinId']}',
    };
  }

  String _genislikAdi() => switch (_genislik) {
    AktarimGenisligi.otomatik => 'Geniş Kupon',
    AktarimGenisligi.tekli => 'Tekli Kupon',
    AktarimGenisligi.cifte => 'çifte',
    AktarimGenisligi.kapali => 'kapalı',
  };

  /// Tekli / Çifte / Kapalı çipleri + ne anlama geldiğini söyleyen tek satır.
  ///
  /// Kapalı seçimin bedeli AÇIKÇA yazılır: her maç 1-X-2 olunca kolon sayısı
  /// üç katına çıkar ve kullanıcı bunu ödeme ekranında değil, seçerken bilmeli.
  Widget _genislikSecici() => Padding(
    padding: const EdgeInsets.only(top: 12),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Kupon türü',
          style: TextStyle(
            color: AppColors.textSoft,
            fontSize: 11.5,
            fontWeight: AppFont.heavy,
          ),
        ),
        const SizedBox(height: 6),
        // İKİ SEÇENEK (kullanıcı kararı, 2026-08-11): "Tekli Kupon"da her maça
        // tek sonuç; "Geniş Kupon"da karar dağılıma bırakılır (açık ara → tek,
        // iki sonuç yakın → çifte, üçü de yakın → 1-X-2 kapalı).
        //
        // Elle "hep çifte" / "hep kapalı" seçenekleri ARAYÜZDEN kaldırıldı:
        // kullanıcı iki net tür istedi. `AktarimGenisligi` içindeki o iki
        // değer kodda ve testlerde duruyor — `proposalFrom` onları desteklemeye
        // devam ediyor, yalnız bu ekranda gösterilmiyor.
        Row(
          children: [
            for (final (g, ad) in const [
              (AktarimGenisligi.tekli, 'Tekli Kupon'),
              (AktarimGenisligi.otomatik, 'Geniş Kupon'),
            ]) ...[
              Expanded(
                child: Semantics(
                  button: true,
                  selected: _genislik == g,
                  label: ad,
                  child: GestureDetector(
                    key: Key('kupon-genislik-${genislikAnahtari(g)}'),
                    behavior: HitTestBehavior.opaque,
                    onTap: () {
                      setState(() => _genislik = g);
                      setPref('couponSysMode', genislikAnahtari(g));
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 9),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: _genislik == g
                            ? AppColors.primary
                            : AppColors.bgAlt,
                        borderRadius: AppRadius.smR,
                        border: Border.all(
                          color: _genislik == g
                              ? AppColors.primary
                              : AppColors.border,
                        ),
                      ),
                      child: Text(
                        ad,
                        style: TextStyle(
                          color: _genislik == g
                              ? AppColors.white
                              : AppColors.textSoft,
                          fontSize: 12.5,
                          fontWeight: AppFont.heavy,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              if (g != AktarimGenisligi.otomatik) const SizedBox(width: 6),
            ],
          ],
        ),
        Padding(
          padding: const EdgeInsets.only(top: 5),
          child: Text(
            switch (_genislik) {
              AktarimGenisligi.otomatik =>
                'Her maç kendi dağılımına göre: bir sonuç açık ara öndeyse '
                    'tek, iki sonuç yakınsa çifte, üçü de yakınsa 1-X-2 kapalı '
                    'eklenir. Kolon sayısı maçlara göre değişir — aşağıda '
                    'anlık görünür.',
              AktarimGenisligi.tekli =>
                'Her maça en yüksek oyu/olasılığı alan TEK sonuç eklenir.',
              AktarimGenisligi.cifte =>
                'Her maça en güçlü iki işaret — kolon sayısı artar.',
              AktarimGenisligi.kapali =>
                'Her maça 1-X-2 birden: maç hangi sonuçla biterse bitsin '
                    'kolonda kapsanır. Kolon sayısı en çok bu seçimde artar.',
            },
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 10.5,
              height: 14 / 10.5,
            ),
          ),
        ),
      ],
    ),
  );

  Future<void> _aktarimBaslat(
    List matches,
    Set lockedNos,
    String source,
  ) async {
    // ANKET: dağılım tek istekte çekilir. Okunamazsa aktarım YAPILMAZ —
    // "oy yok" varsayıp boş kupon doldurmak, olmayan bir topluluk tercihini
    // varmış gibi göstermek olurdu.
    Map<String, Map<String, int>>? anket;
    if (source == 'anket') {
      final kimlikler = matches
          .cast<Map>()
          .map((m) => '${m['sportotoMatchId'] ?? m['no']}')
          .join(',');
      try {
        anket = await ref.read(_anketDagilimiProvider(kimlikler).future);
      } catch (e) {
        await _uyari(
          'Anket okunamadı',
          'Oy dağılımı alınamadı: ${e is ApiException ? e.message : e}',
        );
        return;
      }
      if (!mounted) return;
    }

    final proposed = proposalFrom(
      matches,
      source,
      genislik: _genislik,
      anketDagilimi: anket,
    );
    // Kilitli maçlara öneri UYGULANMAZ (seçim donmuştur).
    proposed.removeWhere(
      (no, _) => lockedNos.contains(no) || lockedNos.contains('$no'),
    );
    if (proposed.isEmpty) {
      await _uyari('Veri yok', switch (source) {
        'radar' =>
          'Radar tahmini kayıtlı değil — aktarım yapılamaz (uydurulmaz).',
        'anket' =>
          'Bu bültende henüz oy verilmiş açık maç yok. Topluluk kuponu '
              'yalnız gerçek oylardan doldurulur; oy yokken seçim '
              'uydurulmaz.',
        _ => 'Sistem tahmini bulunamadı.',
      });
      return;
    }
    final changes = diffSelections(_picks, {
      for (final e in proposed.entries) e.key: e.value,
    });
    if (changes.isEmpty) {
      await _uyari('Fark yok', 'Öneri, mevcut seçimlerinle zaten aynı.');
      return;
    }
    if (!mounted) return;
    final onay = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: Text(
          switch (source) {
            'radar' => 'Radar tahminlerinden aktar',
            'anket' => 'Topluluk Kuponu — ${_genislikAdi()}',
            _ => 'Sistem Master Analizi — ${_genislikAdi()}',
          },
          style: TextStyle(
            color: AppColors.text,
            fontSize: 16,
            fontWeight: AppFont.black,
          ),
        ),
        content: SizedBox(
          width: double.maxFinite,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Mevcut seçimlerin SİLİNMEZ — aşağıdaki değişiklikleri sen '
                'onaylarsan uygulanır:',
                style: TextStyle(color: AppColors.textMuted, fontSize: 12),
              ),
              const SizedBox(height: 8),
              Flexible(
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final c in changes)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 3),
                          child: Text.rich(
                            TextSpan(
                              children: [
                                TextSpan(text: '${c.no}. maç: '),
                                TextSpan(
                                  text: c.from,
                                  style: const TextStyle(
                                    fontWeight: AppFont.black,
                                  ),
                                ),
                                const TextSpan(text: ' → '),
                                TextSpan(
                                  text: c.to,
                                  style: TextStyle(
                                    color: AppColors.accent,
                                    fontWeight: AppFont.black,
                                  ),
                                ),
                                TextSpan(
                                  text: c.kind == 'fill'
                                      ? ' (boş dolduruluyor)'
                                      : ' (mevcut değişecek)',
                                ),
                              ],
                            ),
                            style: TextStyle(
                              color: AppColors.textSoft,
                              fontSize: 12,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Vazgeç'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text('Uygula (${changes.length})'),
          ),
        ],
      ),
    );
    if (onay != true || !mounted) return;
    final simdi = DateTime.now().toIso8601String();
    final kaynakAnaliz = _kaynakAnalizKimligi();
    setState(() {
      for (final e in proposed.entries) {
        _picks['${e.key}'] = e.value;
        _aktarimlar['${e.key}'] = {
          'secim': e.value.join(),
          'zaman': simdi,
          'kaynak': source, // 'sistem' | 'radar'
          ...kaynakAnaliz,
        };
      }
    });
  }

  /// SEÇİMİM: elle seçim — kilitli olmayan tüm seçimleri temizler.
  Future<void> _secimimTemizle(Set lockedNos) async {
    final doluAcik = _picks.keys
        .where((no) => !lockedNos.contains(int.tryParse(no) ?? no))
        .toList();
    if (doluAcik.isEmpty) {
      await _uyari(
        'Zaten boş',
        'Seçimler boş — maç satırlarından 1/X/2 işaretleyerek kendi kuponunu '
            'kur.',
      );
      return;
    }
    if (!mounted) return;
    final onay = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: const Text('Kendi seçimini yap'),
        content: const Text(
          'Kilitli olmayan tüm seçimler temizlenecek. Kilitli maçların seçimi '
          'korunur.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Vazgeç'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Temizle'),
          ),
        ],
      ),
    );
    if (onay != true || !mounted) return;
    setState(() {
      _picks.removeWhere(
        (no, _) => !lockedNos.contains(int.tryParse(no) ?? no),
      );
    });
  }

  Future<void> _uyari(String baslik, String metin) => showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: AppColors.card,
      title: Text(baslik),
      content: Text(metin),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(),
          child: const Text('Tamam'),
        ),
      ],
    ),
  );

  Widget _kutu(String o, bool secili, bool kilitli, Object no) =>
      GestureDetector(
        onTap: kilitli ? null : () => _degistir(no, o),
        behavior: HitTestBehavior.opaque,
        child: Container(
          width: 42,
          padding: const EdgeInsets.symmetric(vertical: 7),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: secili ? AppColors.primary : AppColors.cardAlt,
            borderRadius: AppRadius.smR,
            border: Border.all(
              color: secili ? AppColors.primary : AppColors.border,
            ),
          ),
          child: Text(
            o,
            style: TextStyle(
              color: secili ? AppColors.white : AppColors.textSoft,
              fontSize: 13,
              fontWeight: AppFont.black,
            ),
          ),
        ),
      );

  void _degistir(Object no, String o) {
    setState(() {
      // ELLE DEĞİŞTİRİLEN MAÇ AKTARIM DAMGASINI KAYBEDER: damga "bu değer
      // sistemden geldi" demektir; kullanıcı dokunduysa artık doğru değildir.
      _aktarimlar.remove('$no');
      final cur = (_picks['$no'] ?? const <String>[]).toSet();
      if (!cur.add(o)) cur.remove(o);
      final arr = kOutcomes.where(cur.contains).toList();
      if (arr.isEmpty) {
        _picks.remove('$no');
      } else {
        _picks['$no'] = arr;
      }
    });
  }

  Future<void> _kaydet({
    required Map data,
    required List matches,
    required Map<Object, DateTime> lockMap,
    required DateTime? lockAt,
    required int cols,
    required bool overLimit,
    required int eksikAcik,
    required int emptyLockedCount,
  }) async {
    if (eksikAcik > 0) {
      _uyar(
        '$eksikAcik açık maçta seçim yok — başlamamış maçların hepsi '
        'işaretlenmeli.',
      );
      return;
    }

    // KOLON SINIRI KAYDI ENGELLEMEZ — yalnız uyarır, kararı kullanıcı verir.
    if (overLimit) {
      final devam = await _onay(
        'Kolon sınırı aşılıyor',
        'Kolon sayısı $cols — resmî oyun sınırı $kCouponMaxColumns. Bu kupon '
            'kaydedilir ama bu genişlikte resmî oyunda oynanamaz. Yine de '
            'kaydedilsin mi?',
        'Yine de Kaydet',
      );
      if (devam != true) return;
    }

    if (emptyLockedCount > 0) {
      final devam = await _onay(
        'Boş kalan maçlar',
        '$emptyLockedCount maç sen seçim yapmadan başladı — bu maçlar kuponda '
            'BOŞ kalır ve isabet sayılmaz. Kaydedilsin mi?',
        'Kaydet',
      );
      if (devam != true) return;
    }

    setState(() => _saving = true);

    final selections = matches
        .cast<Map>()
        .map(
          (m) => CouponSelection(
            no: m['no'] as Object,
            selectedOutcomes: _picks['${m['no']}'] ?? const [],
          ),
        )
        .toList();

    CouponResult res;
    if (widget.couponId != null) {
      res = await addVersion(
        widget.couponId!,
        selections,
        lockMap: lockMap,
        aktarimlar: _aktarimlar.isEmpty ? null : Map.of(_aktarimlar),
      );
      if (res.ok && _nameCtl.text.trim().isNotEmpty) {
        await renameCoupon(widget.couponId!, _nameCtl.text);
      }
    } else {
      res = await createCoupon(
        season: data['season'],
        weekNumber: data['weekNumber'],
        roundId: widget.roundId,
        lockedAt: lockAt,
        lockMap: lockMap,
        selections: selections,
        name: _nameCtl.text,
        aktarimlar: _aktarimlar.isEmpty ? null : Map.of(_aktarimlar),
      );
    }

    if (!mounted) return;
    setState(() => _saving = false);

    switch (res.error) {
      case 'max':
        _uyar('Bu hafta için kupon hakkın doldu.');
      case 'locked':
      case 'locked-match':
        final list = res.matches.isNotEmpty
            ? ' (${res.matches.join(', ')}. maç)'
            : '';
        _uyar('Başlamış maçın seçimi değiştirilemez$list.');
      case null:
        await clearDraft(widget.roundId);
        if (mounted) Navigator.of(context).maybePop();
      default:
        _uyar('Kupon kaydedilemedi — yerel taslağın duruyor, tekrar dene.');
    }
  }

  Future<bool?> _onay(String baslik, String metin, String onayMetni) =>
      showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
          backgroundColor: AppColors.surface,
          title: Text(baslik),
          content: Text(metin),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Vazgeç'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: Text(onayMetni),
            ),
          ],
        ),
      );

  void _uyar(String m) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Widget _serit(String metin, Color renk) => Container(
    margin: const EdgeInsets.only(bottom: 10),
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(
      color: renk.withValues(alpha: 0.08),
      borderRadius: AppRadius.smR,
      border: Border.all(color: renk),
    ),
    child: Text(
      metin,
      style: TextStyle(
        color: renk,
        fontSize: 11.5,
        height: 1.45,
        fontWeight: AppFont.bold,
      ),
    ),
  );
}
