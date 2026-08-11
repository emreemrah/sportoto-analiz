// KAYNAK: app/src/studioFonts.js — çeviri.
//
// YAYIN STÜDYOSU — yazı tipi (Barlow Semi Condensed, uygulamaya GÖMÜLÜ).
//
// NEDEN AYRI BİR AİLE: Stüdyo, resmî bülten tablosu gibi SIKIŞIK okunmalı —
// tek ekranda 15 satır. Sistem fontları geniş yazar; aynı satıra takım adı +
// skor + sonuç sığmaz ve her ekran birbirinin aynısı görünür. Barlow Semi
// Condensed dar yazar, rakamları eşit genişliktedir (tablo sütunları kaymaz)
// ve Türkçe harflerin tamamını (ğ ş ı İ ç ö ü) içerir.
//
// ────────────────────────────────────────────────────────────────────────────
// KAYNAKTAKİ "FONT HAZIR MI" KANCASI ÇEVRİLMEDİ — NEDENİ
//
// Kaynakta font ÇALIŞMA ZAMANINDA yükleniyordu (`useFonts`) ve yüklenene kadar
// `fontOf()` fontFamily VERMİYORDU; ekranlar sistem fontuyla çizilip font
// gelince yeniden çiziliyordu. Kural açıktı: "font, çalışmanın ÖNKOŞULU
// değildir."
//
// Flutter'da `pubspec.yaml`de bildirilen font DERLEME ZAMANINDA pakete girer
// ve ilk kareden itibaren hazırdır — beklenecek bir yükleme yoktur. Bu yüzden
// `useStudioFontReady` / `f` parametresi gereksizdi ve taşınmadı; yerine
// doğrudan aile adı yazılır.
//
// KORUNAN: kaynaktaki `TABULAR` (eşit genişlikli rakam) ayarı — tablo
// sütunlarının kaymaması buna bağlı.

import 'package:flutter/widgets.dart';

/// pubspec.yaml'de bildirilen aile adı.
const String kStudioFontFamily = 'BarlowSemiCondensed';

/// Kaynaktaki `fontOf(agirlik)` — stüdyo yazı tipiyle ağırlık seçer.
///
/// Yalnız 400/500/600/700 gömülüdür; başka bir ağırlık istenirse Flutter en
/// yakınına düşer (kaynakta da aynı dört kesim vardı).
TextStyle studioFont(int agirlik) => TextStyle(
      fontFamily: kStudioFontFamily,
      fontWeight: switch (agirlik) {
        400 => FontWeight.w400,
        500 => FontWeight.w500,
        600 => FontWeight.w600,
        _ => FontWeight.w700,
      },
    );

/// Kaynaktaki `TABULAR` — eşit genişlikli rakamlar.
///
/// Tablo sütunlarının satırdan satıra KAYMAMASI buna bağlıdır: orantılı
/// rakamlarda "1" ile "8" farklı genişlikte olur ve skor sütunu titrer.
const List<FontFeature> kTabular = [FontFeature.tabularFigures()];
