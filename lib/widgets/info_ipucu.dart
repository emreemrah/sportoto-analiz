// KAYNAK: app/src/components/InfoIpucu.js — BİREBİR çeviri.
//
// ⓘ BİLGİ İPUCU — mobilde yarım ekran kaplayan açıklama kutularının ilacı
// (kullanıcı isteği, 2026-08-06: "infolar görünmesin, i işareti olsun, basınca
// küçük şekilde gösterilsin").
//
// Tek satırlık ÖZET her zaman görünür; uzun açıklama ⓘ'ye basınca altında
// açılır, tekrar basınca kapanır. Açıklamalar SİLİNMEZ — sadece istenince
// görünür (dürüstlük metinleri kaybolmaz, yer de kaplamaz).

import 'package:flutter/material.dart';

import '../core/theme/tokens.dart';

class InfoIpucu extends StatefulWidget {
  // `const` DEĞİL — BİLEREK (2026-08-12): bu widget rengini `AppColors`
  // küresellerinden okuyor ve tema çalışma zamanında değişiyor. `const`
  // yapıcı widget örneğini sabitler; Flutter aynı örneği görünce alt ağacı
  // YENİDEN KURMAZ ve widget eski renkte donar (emülatörde ölçüldü:
  // Dortmund temasında kupon boş-durum kartı Galatasaray bordosunda kaldı).
  // ignore: prefer_const_constructors_in_immutables
  InfoIpucu({
    super.key,
    required this.ozet,
    required this.detay,
    this.renk,
    this.ikon,
  });

  final String ozet;
  final String detay;
  final Color? renk;

  /// Özetin başındaki ikon — VEKTÖR, metne gömülü emoji DEĞİL (kullanıcı
  /// isteği, 2026-08-12): emoji `TextStyle.color`ı dinlemediği için özet
  /// yazısı temaya uyarken baştaki simge sabit renkte kalıyordu.
  final IconData? ikon;

  @override
  State<InfoIpucu> createState() => _InfoIpucuState();
}

class _InfoIpucuState extends State<InfoIpucu> {
  bool _acik = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: AppRadius.smR,
        border: Border.all(color: widget.renk ?? AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            button: true,
            label: _acik ? 'Açıklamayı kapat' : 'Açıklamayı göster',
            child: GestureDetector(
              onTap: () => setState(() => _acik = !_acik),
              behavior: HitTestBehavior.opaque,
              child: Row(
                children: [
                  if (widget.ikon != null) ...[
                    Icon(
                      widget.ikon,
                      size: 14,
                      color: widget.renk ?? AppColors.textSoft,
                    ),
                    const SizedBox(width: 6),
                  ],
                  Expanded(
                    child: Text(
                      widget.ozet,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.text,
                        fontSize: 11,
                        fontWeight: AppFont.heavy,
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Container(
                    width: 16,
                    height: 16,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: _acik ? AppColors.info : Colors.transparent,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.info),
                    ),
                    child: Text(
                      _acik ? '✕' : 'i',
                      style: TextStyle(
                        color: _acik ? const Color(0xFFFFFFFF) : AppColors.info,
                        fontSize: 9.5,
                        fontWeight: AppFont.black,
                        fontStyle: _acik ? FontStyle.normal : FontStyle.italic,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_acik)
            Container(
              margin: const EdgeInsets.only(top: 5),
              padding: const EdgeInsets.only(top: 5),
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: Text(
                widget.detay,
                style: TextStyle(
                  color: AppColors.textSoft,
                  fontSize: 11,
                  height: 15 / 11,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
