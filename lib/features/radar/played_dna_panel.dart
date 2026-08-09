// KAYNAK: app/src/components/PlayedDnaPanel.js — BİREBİR çeviri.
//
// OYNANMA DNA PANELİ (Radar 3) — "bu dağılıma benzer geçmiş maçlar nasıl bitti?"
//
// Panelin verisi yalnız paneli ilgilendiriyor; kendi durumunu kendisi taşır.
// Ekran sadece "hangi satır açık" bilgisini tutar.
//
// DÜRÜSTLÜK KURALLARI (tasarım gereği, sadeleştirilmemeli):
//  * Panelde GÜVEN SEVİYESİ, örneklem uyarısı veya olasılık iddiası YOKTUR.
//    "Kaç kayıtta" ifadesi örneklemi zaten şeffaf biçimde bildirir.
//  * Yakınlık kullanıcı seçer — otomatik genişleme yok. Sistem örneklemi
//    kendiliğinden büyütüp sayıyı güçlü göstermez.
//  * Toplam önce gelir; altındaki iki kırılım AYNI kayıtların iki farklı
//    görünümüdür, TOPLANMAZ.
//  * Yakınlık ve kapsam bilinçli olarak en sonda ve soluktur: ana sonucun
//    önüne geçmemeli.

import 'package:flutter/material.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/tokens.dart';

const List<String> _kGunAdlari = [
  'Pazar',
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
];

/// Filtre birimi MAÇ (hafta değil): en yeni N sonuçlanmış maç.
const List<({int? v, String l})> _kMacSecenekleri = [
  (v: null, l: 'Tüm Maçlar'),
  (v: 5, l: 'Son 5 Maç'),
  (v: 10, l: 'Son 10 Maç'),
  (v: 15, l: 'Son 15 Maç'),
];

/// Yakınlık: kullanıcı seçer, otomatik genişleme yok.
const List<({int v, String l})> _kYakinlikSecenekleri = [
  (v: 0, l: 'Birebir aynı'),
  (v: 1, l: '±1'),
  (v: 2, l: '±2'),
  (v: 3, l: '±3'),
];

class PlayedDnaPanel extends StatefulWidget {
  const PlayedDnaPanel({
    super.key,
    this.roundId,
    required this.no,
    required this.source,
    this.day,
    this.tick = 0,
  });

  /// Gösterilen hafta.
  final Object? roundId;

  /// Maç sırası (1-15).
  final Object no;

  /// Sağlayıcı İÇ kimliği (ekranda gösterilmez; renk noktasıyla anılır).
  final Object source;

  /// Seçili gün — DNA seçili güne bağlıdır.
  final String? day;

  /// Dışarıdan tetiklenen sessiz tazeleme sayacı (Radar 3'ün 60 sn'lik
  /// otomatik yenilemesiyle panel de tazelensin diye).
  final int tick;

  @override
  State<PlayedDnaPanel> createState() => _PlayedDnaPanelState();
}

class _PlayedDnaPanelState extends State<PlayedDnaPanel> {
  int? _dnaWeeks; // null | 5 | 10 | 15 (MAÇ)
  int _dnaTol = 2; // 0 birebir · 1 · 2 · 3
  Map? _dnaData;
  bool _dnaBusy = false;
  String? _sorgu;

  @override
  void initState() {
    super.initState();
    _getir();
  }

  @override
  void didUpdateWidget(PlayedDnaPanel old) {
    super.didUpdateWidget(old);
    if (old.roundId != widget.roundId ||
        old.no != widget.no ||
        old.source != widget.source ||
        old.day != widget.day ||
        old.tick != widget.tick) {
      _getir();
    }
  }

  Future<void> _getir() async {
    if (widget.roundId == null || '${widget.source}'.isEmpty) return;
    // AYNI sorgunun periyodik tazelemesi SESSİZ olur: "taranıyor…" yazısı her
    // dakika yanıp sönmez ve ağ hatasında panel boşalmaz (son değer kalır).
    final sorgu =
        '${widget.roundId}|${widget.no}|${widget.source}|${widget.day}'
        '|$_dnaWeeks|$_dnaTol';
    final sessiz = _sorgu == sorgu;
    _sorgu = sorgu;
    if (!sessiz) setState(() => _dnaBusy = true);
    try {
      final d = await api.radarPlayedDna(
        roundId: widget.roundId,
        no: int.tryParse('${widget.no}') ?? widget.no,
        source: widget.source,
        day: widget.day,
        limit: _dnaWeeks,
        tol: _dnaTol,
      );
      if (!mounted) return;
      setState(() {
        _dnaData = d as Map?;
        _dnaBusy = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        if (!sessiz) _dnaData = null;
        _dnaBusy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = _dnaData;
    final gunAdi = d?['weekday'] is num
        ? _kGunAdlari[(d!['weekday'] as num).toInt()]
        : null;
    final dag = d?['distribution'] as Map?;
    final hrk = d?['movement'] as Map?;
    final hasData = d?['hasData'] == true;

    return Container(
      // Panelin dürüstlük kurallarını EKRANIN geri kalanından ayrı sınamak
      // için kimlik (kaynaktaki testID karşılığı).
      key: Key('oynanma-dna-${widget.no}-${widget.source}'),
      margin: const EdgeInsets.only(top: 6, left: 34),
      padding: const EdgeInsets.all(9),
      decoration: BoxDecoration(
        color: AppColors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _cipSatiri([
            for (final o in _kMacSecenekleri)
              (
                secili: _dnaWeeks == o.v,
                etiket: o.l,
                bas: () {
                  setState(() => _dnaWeeks = o.v);
                  _getir();
                },
              ),
          ]),
          // YAKINLIK — kullanıcı seçer; otomatik genişleme yok.
          _cipSatiri([
            for (final o in _kYakinlikSecenekleri)
              (
                secili: _dnaTol == o.v,
                etiket: o.l,
                bas: () {
                  setState(() => _dnaTol = o.v);
                  _getir();
                },
              ),
          ]),

          if (_dnaBusy) _soluk('Geçmiş kayıtlar taranıyor…'),
          if (!_dnaBusy && !hasData)
            _soluk('${d?['note'] ?? 'Bu dağılıma yakın geçmiş sonuç yok'}'),

          if (!_dnaBusy && hasData) ...[
            _baslik('Mevcut oynanma'),
            _simdi(_mevcutMetni(d!['current'] as Map?)),

            _baslik('Benzer oynanma yüzdeleri'),
            if (dag?['hasData'] == true) ...[
              // TOPLAM önce gelir. Altındaki iki kırılım AYNI kayıtların iki
              // farklı görünümüdür — toplanmaz.
              _simdi('${(dag!['overall'] as Map?)?['text'] ?? ''}'),
              _altBaslik('Güne göre'),
              _DnaSatir(
                etiket: gunAdi != null ? '$gunAdi kayıtları' : 'Seçili gün',
                ozet: (dag['byDay'] as Map?)?['selected'] as Map?,
              ),
              _DnaSatir(
                etiket: 'Diğer günler',
                ozet: (dag['byDay'] as Map?)?['others'] as Map?,
              ),
              _altBaslik('Sıraya göre'),
              _DnaSatir(
                etiket: '${d['position']}. sıradaki maçlar',
                ozet: (dag['byPosition'] as Map?)?['own'] as Map?,
              ),
              _DnaSatir(
                etiket: 'Diğer sıralar',
                ozet: (dag['byPosition'] as Map?)?['rest'] as Map?,
              ),
              // HANGİ kayıtlar eşleşti — sayı soyut kalmasın.
              ..._ornekler(dag['samples'] as List?, 'Eşleşen kayıtlar'),
            ] else
              _soluk('Bu dağılıma yakın geçmiş sonuç yok'),

            _baslik('Oynanma değişimi'),
            if (hrk?['words'] != null && '${hrk!['words']}'.isNotEmpty) ...[
              // Değişim yüzdeyle gösterilir: hangi tablodan hangi tabloya.
              if (_dolu(hrk['openText']) && _dolu(hrk['closeText']))
                _simdi('${hrk['openText']} → ${hrk['closeText']}'),
              _etiket('${hrk['words']}'),
              if (hrk['hasData'] == true) ...[
                _deger(
                  'Benzer hareket: ${(hrk['overall'] as Map?)?['text'] ?? ''}',
                ),
                ..._ornekler(hrk['samples'] as List?, 'Eşleşen hareketler'),
              ] else ...[
                _soluk('Bu harekete yakın geçmiş sonuç yok'),
                // GEVŞEK EŞLEŞME (yön kovası): birebir dağılım eşleşmesi
                // boşken aynı yön kovasındaki maçlar gösterilir. "Gevşek"
                // olduğu AÇIKÇA yazılır — birebir eşleşme gibi sunulmaz.
                // Küçük arşivde birebir eşleşme pratikte hiç tutmuyordu;
                // kullanıcı yine de gerçek kayıtları görebilmeli.
                if (hrk['fallback'] is Map) ...[
                  _deger(
                    'Gevşek eşleşme · ${(hrk['fallback'] as Map)['label']}: '
                    '${((hrk['fallback'] as Map)['overall'] as Map?)?['text'] ?? ''}',
                  ),
                  ..._ornekler(
                    (hrk['fallback'] as Map)['samples'] as List?,
                    'Kovadaki kayıtlar',
                  ),
                ],
              ],
            ] else
              _soluk(
                '${hrk?['note'] ?? 'Değişim için en az iki günün kaydı gerekir.'}',
              ),

            // Yakınlık ve kapsam bilinçli olarak EN SONDA ve soluk: ana
            // sonucun önüne geçmemeli.
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Opacity(
                opacity: 0.8,
                child: Text(
                  '${_dnaTol == 0 ? 'Birebir aynı' : 'Yakınlık ±$_dnaTol'}'
                  '${d['settledMatches'] != null ? ' · arşivde ${d['settledMatches']} sonuçlanmış maç' : ''}',
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 9.5,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  static bool _dolu(Object? x) => x != null && '$x'.isNotEmpty;

  /// `1 %.. · X %.. · 2 %..` — kaynakta `Math.round(Number(...))`.
  static String _mevcutMetni(Map? c) {
    String y(Object? v) {
      final n = v is num ? v.toDouble() : double.tryParse('$v');
      // JS `Math.round(NaN)` → NaN; ekranda "NaN" görünürdü. Burada da
      // sayıya çevrilemeyen değeri gizlemiyoruz ki sessiz sıfır olmasın.
      return n == null || n.isNaN ? 'NaN' : '${n.round()}';
    }

    return '1 %${y(c?['1'])} · X %${y(c?['X'])} · 2 %${y(c?['2'])}';
  }

  List<Widget> _ornekler(List? samples, String baslik) {
    if (samples == null || samples.isEmpty) return const [];
    return [
      _altBaslik(baslik),
      for (final s in samples)
        Padding(
          padding: const EdgeInsets.only(bottom: 1),
          child: Text(
            '• ${(s as Map)['text'] ?? ''}',
            style: const TextStyle(
              color: AppColors.textSoft,
              fontSize: 10.5,
              height: 15 / 10.5,
            ),
          ),
        ),
    ];
  }

  Widget _cipSatiri(
    List<({bool secili, String etiket, VoidCallback bas})> ogeler,
  ) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        for (final o in ogeler)
          GestureDetector(
            onTap: o.bas,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
              decoration: BoxDecoration(
                color: o.secili ? AppColors.primary : AppColors.card,
                borderRadius: BorderRadius.circular(AppRadius.pill),
                border: Border.all(
                  color: o.secili ? AppColors.primary : AppColors.border,
                ),
              ),
              child: Text(
                o.etiket,
                style: TextStyle(
                  color: o.secili ? AppColors.white : AppColors.textSoft,
                  fontSize: 10.5,
                  fontWeight: AppFont.heavy,
                ),
              ),
            ),
          ),
      ],
    ),
  );

  static Widget _baslik(String t) => Padding(
    padding: const EdgeInsets.only(top: 8, bottom: 3),
    child: Text(
      t,
      style: const TextStyle(
        color: AppColors.textMuted,
        fontSize: 10,
        fontWeight: AppFont.black,
      ),
    ),
  );

  static Widget _altBaslik(String t) => Padding(
    padding: const EdgeInsets.only(top: 6, bottom: 2),
    child: Text(
      t,
      style: const TextStyle(
        color: AppColors.textMuted,
        fontSize: 9.5,
        fontWeight: AppFont.black,
      ),
    ),
  );

  static Widget _simdi(String t) => Padding(
    padding: const EdgeInsets.only(bottom: 2),
    child: Text(
      t,
      style: const TextStyle(
        color: AppColors.text,
        fontSize: 13,
        fontWeight: AppFont.black,
      ),
    ),
  );

  static Widget _etiket(String t) => Text(
    t,
    style: const TextStyle(
      color: AppColors.textMuted,
      fontSize: 10.5,
      fontWeight: AppFont.heavy,
    ),
  );

  static Widget _deger(String t) => Text(
    t,
    style: const TextStyle(
      color: AppColors.text,
      fontSize: 12,
      fontWeight: AppFont.bold,
      height: 17 / 12,
    ),
  );

  static Widget _soluk(String t) => Text(
    t,
    style: const TextStyle(
      color: AppColors.textMuted,
      fontSize: 11.5,
      fontStyle: FontStyle.italic,
      height: 16 / 11.5,
    ),
  );
}

class _DnaSatir extends StatelessWidget {
  const _DnaSatir({required this.etiket, required this.ozet});

  final String etiket;
  final Map? ozet;

  @override
  Widget build(BuildContext context) {
    final metin = ozet?['text'];
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _PlayedDnaPanelState._etiket('$etiket:'),
          // Veri yoksa sessiz sıfır değil, açık ifade.
          _PlayedDnaPanelState._deger(
            (metin == null || '$metin'.isEmpty) ? 'Geçmiş sonuç yok' : '$metin',
          ),
        ],
      ),
    );
  }
}
