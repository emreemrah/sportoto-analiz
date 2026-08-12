// TAKIM RENK TABLOSU — 150 TAKIM, ELLE TANIMLI (kullanıcı isteği, 2026-08-11)
//
// Kullanıcının kuralı: "Takım renkleri armadan çalışma anında çıkarılmasın.
// Her takım için elle tanımlanmış, sabit ve test edilebilir bir renk tablosu
// kullanılsın."
//
// ANAHTARLAR KATALOGDAN: aşağıdaki adlar `/api/favorite-teams` ucundan
// alınmıştır (8 lig · 150 takım, 2026-08-11'de çekildi). Eşleşme
// `utils.kucukTr` ile yapılır — profil ekranı ve arma filigranı da aynı
// normalizasyonu kullanıyor, böylece bir takım her yerde aynı takımdır.
//
// ═══════════ RENKLERİN KAYNAĞI VE SINIRI — AÇIKÇA ═════════════════════════
// Değerler kulüplerin BİLİNEN forma/marka renklerinden yazıldı; resmî marka
// kılavuzlarından okunmadı ve bu oturumda hiçbir kulüp kaynağıyla
// karşılaştırılmadı. Yani "yaklaşık doğru": bir kulübün tonu resmî değerinden
// birkaç basamak sapabilir. Renk bir VERİ değil TASARIM kararı olduğu için
// bu kabul edilebilir; ama yanlış görünen takım rapor edilip buradan tek
// satırda düzeltilmelidir.
//
// LİSTEDE OLMAYAN TAKIM: tabloya girmemiş, adı eşleşmeyen ya da katalogda
// bulunmayan takımda VARSAYILAN TEMA korunur (bkz. `takimPaletiBul` → null).
// Uydurma renk üretilmez.

import 'dart:ui';

import '../utils.dart';
import 'takim_paleti.dart';

/// (ana renk, ikincil renk) — türetme `paletUret` içinde.
typedef TakimRenkCifti = (int ana, int ikincil);

/// Katalog adı → renk çifti. Anahtarlar `kucukTr` ile normalize edilerek
/// aranır; buradaki yazım katalogdaki `name` alanıyla birebir aynıdır.
const Map<String, TakimRenkCifti> kTakimRenkleri = {
  // ───────────────────────── Türkiye · Süper Lig ─────────────────────────
  'Alanyaspor': (0xFFF47A20, 0xFF00954E),
  'Amed Sportif Faaliyetler Kulübü': (0xFF009639, 0xFFE30613),
  'BB Erzurumspor': (0xFF0F52BA, 0xFFFFFFFF),
  'Beşiktaş': (0xFF000000, 0xFFFFFFFF),
  'Çaykur Rizespor': (0xFF006B3F, 0xFF0067B1),
  'Çorum Belediye Spor Kulübü': (0xFFE1251B, 0xFF000000),
  'Eyüp Spor Kulübü': (0xFF6A1B9A, 0xFFFDD835),
  'Fenerbahçe': (0xFF003B7B, 0xFFFFED00),
  'Galatasaray': (0xFFA90432, 0xFFFBB800),
  'Gaziantep FK': (0xFFD3122E, 0xFF000000),
  'Gençlerbirliği': (0xFFE30613, 0xFF000000),
  'Göztepe': (0xFFFFD500, 0xFFE2001A),
  'İstanbul Başakşehir FK': (0xFF0B2F6E, 0xFFF58220),
  'Kasimpasa': (0xFF0B3B75, 0xFFFFFFFF),
  'Kocaelispor Kulübü': (0xFF00693E, 0xFF000000),
  'Konyaspor': (0xFF00693E, 0xFFFFFFFF),
  'Samsunspor': (0xFFE30613, 0xFFFFFFFF),
  'Trabzonspor': (0xFF7B1E3C, 0xFF00539F),

  // ────────────────────── İngiltere · Premier League ──────────────────────
  'AFC Bournemouth': (0xFFDA291C, 0xFF000000),
  'Arsenal FC': (0xFFEF0107, 0xFFFFFFFF),
  'Aston Villa FC': (0xFF670E36, 0xFF95BFE5),
  'Brentford FC': (0xFFE30613, 0xFFFFFFFF),
  'Brighton & Hove Albion FC': (0xFF0057B8, 0xFFFFFFFF),
  'Chelsea FC': (0xFF034694, 0xFFFFFFFF),
  'Coventry City FC': (0xFF6CACE4, 0xFF00205B),
  'Crystal Palace FC': (0xFF1B458F, 0xFFC4122E),
  'Everton FC': (0xFF003399, 0xFFFFFFFF),
  'Fulham FC': (0xFFFFFFFF, 0xFF000000),
  'Hull City AFC': (0xFFF5971D, 0xFF000000),
  'Ipswich Town FC': (0xFF0044A9, 0xFFFFFFFF),
  'Leeds United FC': (0xFFFFFFFF, 0xFF1D428A),
  'Liverpool FC': (0xFFC8102E, 0xFFFFFFFF),
  'Manchester City FC': (0xFF6CABDD, 0xFF1C2C5B),
  'Manchester United FC': (0xFFDA291C, 0xFFFBE122),
  'Newcastle United FC': (0xFF241F20, 0xFFFFFFFF),
  'Nottingham Forest FC': (0xFFDD0000, 0xFFFFFFFF),
  'Sunderland AFC': (0xFFEB172B, 0xFFFFFFFF),
  'Tottenham Hotspur FC': (0xFFFFFFFF, 0xFF132257),

  // ────────────────────────── İspanya · La Liga ──────────────────────────
  'Athletic Club Bilbao': (0xFFEE2523, 0xFFFFFFFF),
  'CA Osasuna': (0xFFD91A21, 0xFF0A346F),
  'Club Atlético de Madrid': (0xFFCB3524, 0xFF272E61),
  'Deportivo Alavés': (0xFF0761AF, 0xFFFFFFFF),
  'Elche CF': (0xFF00963F, 0xFFFFFFFF),
  'FC Barcelona': (0xFFA50044, 0xFF004D98),
  'Getafe Club de Fútbol': (0xFF005999, 0xFFFFFFFF),
  'Levante UD': (0xFFA61B2B, 0xFF0B4EA2),
  'Málaga CF': (0xFF0080C8, 0xFFFFFFFF),
  'Rayo Vallecano': (0xFFFFFFFF, 0xFFE53027),
  'Real Betis Balompié': (0xFF00954C, 0xFFFFFFFF),
  'Real Club Celta de Vigo': (0xFF8AC3EE, 0xFFFFFFFF),
  'Real Club Deportivo de La Coruña': (0xFF0066B3, 0xFFFFFFFF),
  'Real Madrid CF': (0xFFFFFFFF, 0xFFFEBE10),
  'Real Racing Club de Santander': (0xFFFFFFFF, 0xFF00A650),
  'Real Sociedad de Fútbol': (0xFF0067B1, 0xFFFFFFFF),
  'Reial Club Deportiu Espanyol': (0xFF0079C2, 0xFFFFFFFF),
  'Sevilla FC': (0xFFFFFFFF, 0xFFD91A21),
  'Valencia CF': (0xFFFFFFFF, 0xFFF18101),
  'Villarreal CF': (0xFFFFE667, 0xFF005187),

  // ────────────────────────── İtalya · Serie A ───────────────────────────
  'AC Milan': (0xFFFB090B, 0xFF000000),
  'ACF Fiorentina': (0xFF6A0DAD, 0xFFFFFFFF),
  'AS Roma': (0xFF8E1F2F, 0xFFF0BC42),
  'Atalanta Bergamasca Calcio': (0xFF1E71B8, 0xFF000000),
  'Bologna FC 1909': (0xFFB02A30, 0xFF1A2F4B),
  'Cagliari Calcio': (0xFFB01B2E, 0xFF002B5C),
  'Calcio Como': (0xFF005AA7, 0xFFFFFFFF),
  'FC Internazionale Milano': (0xFF0068A8, 0xFF000000),
  'Frosinone Calcio': (0xFF1E5AA8, 0xFFFFD500),
  'Genoa CFC': (0xFFB4162B, 0xFF002B5C),
  'Juventus FC': (0xFF000000, 0xFFFFFFFF),
  'Parma Calcio 1913': (0xFFFFD700, 0xFF004B8D),
  'SS Lazio': (0xFF87D8F7, 0xFFFFFFFF),
  'SS Monza 1912': (0xFFE30613, 0xFFFFFFFF),
  'SSC Napoli': (0xFF12A0D7, 0xFFFFFFFF),
  'Torino FC': (0xFF881B1F, 0xFFFFFFFF),
  'Udinese Calcio': (0xFF000000, 0xFFFFFFFF),
  'US Lecce': (0xFFFFD500, 0xFFD3122E),
  'US Sassuolo Calcio': (0xFF00A752, 0xFF000000),
  'Venezia FC': (0xFF000000, 0xFF00A650),

  // ───────────────────────── Almanya · Bundesliga ────────────────────────
  '1. FC Köln': (0xFFE32219, 0xFFFFFFFF),
  '1. FC Union Berlin': (0xFFEB1923, 0xFFFDE100),
  '1. FSV Mainz 05': (0xFFC3141E, 0xFFFFFFFF),
  'Bayer 04 Leverkusen': (0xFFE32221, 0xFF000000),
  'Borussia VfL Mönchengladbach': (0xFFFFFFFF, 0xFF00A752),
  'BVB 09 Borussia Dortmund': (0xFFFDE100, 0xFF000000),
  'Eintracht Frankfurt': (0xFF000000, 0xFFE1000F),
  'FC Augsburg': (0xFF00694E, 0xFFBA3733),
  'FC Bayern München': (0xFFDC052D, 0xFF0066B2),
  'FC Schalke 04': (0xFF004D9D, 0xFFFFFFFF),
  'Hamburger SV': (0xFF0A3F7E, 0xFFD50032),
  'Rasen Ballsport Leipzig': (0xFFFFFFFF, 0xFFDD0741),
  'SC Freiburg': (0xFFE2001A, 0xFFFFFFFF),
  'SC Paderborn 07': (0xFF004E9E, 0xFF000000),
  'SV 07 Elversberg': (0xFFE30613, 0xFF000000),
  'SV Werder Bremen': (0xFF1D9053, 0xFFFFFFFF),
  'TSG 1899 Hoffenheim': (0xFF1C63B7, 0xFFFFFFFF),
  'VfB Stuttgart 1893': (0xFFFFFFFF, 0xFFE32219),

  // ───────────────────── Portekiz · Liga Portugal ────────────────────────
  'Academico de Viseu FC': (0xFFC8102E, 0xFF000000),
  'Alverca': (0xFFE30613, 0xFFFFFFFF),
  'Casa Pia AC': (0xFF000000, 0xFFFFFFFF),
  'CD Nacional Funchal': (0xFF000000, 0xFFFFFFFF),
  'CD Santa Clara': (0xFFE30613, 0xFFFFFFFF),
  'CS Marítimo Funchal': (0xFF00693E, 0xFFD3122E),
  'Estrela Amadora': (0xFFD3122E, 0xFF00A650),
  'FC Arouca': (0xFFFFD500, 0xFFD3122E),
  'FC Famalicão': (0xFFFFFFFF, 0xFF004A99),
  'FC Porto': (0xFF003E7E, 0xFFFFFFFF),
  'GD Estoril Praia': (0xFFFFD500, 0xFF003E7E),
  'Gil Vicente FC': (0xFFD3122E, 0xFFFFFFFF),
  'Moreirense FC': (0xFF00693E, 0xFFFFFFFF),
  'Rio Ave FC': (0xFF00693E, 0xFFFFFFFF),
  'SL Benfica': (0xFFE30613, 0xFFFFFFFF),
  'Sporting Braga': (0xFFC8102E, 0xFFFFFFFF),
  'Sporting Clube de Portugal': (0xFF008057, 0xFFFFFFFF),
  'Vitória Guimarães SC': (0xFFFFFFFF, 0xFF000000),

  // ───────────────────── Hollanda · Eredivisie ───────────────────────────
  'AFC Ajax': (0xFFD2122E, 0xFFFFFFFF),
  'Alkmaar Zaanstreek': (0xFFE30613, 0xFFFFFFFF),
  'FC Groningen': (0xFF00A650, 0xFFFFFFFF),
  'FC Twente': (0xFFE30613, 0xFFFFFFFF),
  'FC Utrecht': (0xFFE30613, 0xFFFFFFFF),
  'Feyenoord Rotterdam': (0xFFE30613, 0xFFFFFFFF),
  'Fortuna Sittard': (0xFFFFD500, 0xFF00A650),
  'Go Ahead Eagles': (0xFFE30613, 0xFFFFD500),
  'HFC ADO Den Haag': (0xFF00A650, 0xFFFFD500),
  'Nijmegen Eendracht Combinatie': (0xFFE30613, 0xFF00A650),
  'PEC Zwolle': (0xFF0057B8, 0xFFFFFFFF),
  'PSV Eindhoven': (0xFFED1C24, 0xFFFFFFFF),
  'SBV Excelsior': (0xFFE30613, 0xFF000000),
  'SC Cambuur Leeuwarden': (0xFFFFD500, 0xFF0057B8),
  'SC Heerenveen': (0xFF0057B8, 0xFFFFFFFF),
  'SC Telstar': (0xFFFFFFFF, 0xFF000000),
  'Sparta Rotterdam': (0xFFE30613, 0xFFFFFFFF),
  'Willem II': (0xFFE30613, 0xFF0057B8),

  // ────────────────────────── Fransa · Ligue 1 ───────────────────────────
  "Angers Sporting Club de l'Ouest": (0xFF000000, 0xFFFFFFFF),
  'AS Monaco FC': (0xFFE63329, 0xFFFFFFFF),
  'Association Jeunesse Auxerroise': (0xFFFFFFFF, 0xFF0057B8),
  'Espérance Sportive Troyes Aube Champagne': (0xFF003DA5, 0xFFFFFFFF),
  'FC Lorient': (0xFFF58220, 0xFF000000),
  'Le Havre AC': (0xFF6CACE4, 0xFF00205B),
  'Le Mans FC': (0xFFFFD500, 0xFFD3122E),
  'Lille OSC Métropole': (0xFFE01E13, 0xFFFFFFFF),
  "OGC Nice Côte d'Azur": (0xFFE30613, 0xFF000000),
  'Olympique de Marseille': (0xFF2FAEE0, 0xFFFFFFFF),
  'Olympique Lyonnais': (0xFFFFFFFF, 0xFF003DA5),
  'Paris FC': (0xFF003DA5, 0xFFFFFFFF),
  'Paris Saint-Germain FC': (0xFF004170, 0xFFDA291C),
  'Racing Club de Lens': (0xFFFFD500, 0xFFE30613),
  'RC Strasbourg Alsace': (0xFF0072BC, 0xFFFFFFFF),
  'Stade Brestois 29': (0xFFE30613, 0xFFFFFFFF),
  'Stade Rennais FC': (0xFFE23D28, 0xFF000000),
  'Toulouse FC': (0xFF6A1B9A, 0xFFFFFFFF),
};

/// Normalize edilmiş arama tablosu — her çağrıda yeniden kurulmasın diye
/// modül düzeyinde bir kez hesaplanır.
final Map<String, MapEntry<String, TakimRenkCifti>> _aramaTablosu = {
  for (final e in kTakimRenkleri.entries)
    kucukTr(e.key): MapEntry(e.key, e.value),
};

/// Favori takım adından palet çözer. Eşleşme yoksa **null** — çağıran taraf
/// varsayılan temayı korur, renk UYDURULMAZ.
///
/// Eşleşme `kucukTr` ile yapılır (profil ekranı ve arma filigranıyla aynı
/// kural): 'GALATASARAY', 'Galatasaray', 'galatasaray' aynı takımdır.
TakimPaleti? takimPaletiBul(String? favoriAd) {
  final ad = (favoriAd ?? '').trim();
  if (ad.isEmpty) return null;
  final kayit = _aramaTablosu[kucukTr(ad)];
  if (kayit == null) return null;
  return paletUret(
    takim: kayit.key,
    ana: Color(kayit.value.$1),
    ikincil: Color(kayit.value.$2),
  );
}

/// Tablodaki tüm takımların paletleri — kontrast taraması testinde kullanılır.
List<TakimPaleti> tumTakimPaletleri() => [
  for (final e in kTakimRenkleri.entries)
    paletUret(takim: e.key, ana: Color(e.value.$1), ikincil: Color(e.value.$2)),
];
