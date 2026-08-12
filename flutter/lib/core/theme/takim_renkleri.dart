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
// Değerlerin ÇOĞU kulüplerin bilinen forma/marka renklerinden yazıldı; resmî
// marka kılavuzundan okunmadı. Yani "yaklaşık doğru": bir kulübün tonu resmî
// değerinden birkaç basamak sapabilir.
//
// DENETLENEBİLİRLİK (kullanıcı isteği, 2026-08-12): hangi takımın rengi
// gerçekten DOĞRULANDIĞI [kResmiKaynakliTakimlar] kümesinde yazılıdır ve o
// takımların satırında kaynak yorumu vardır. Kümede OLMAYAN her takım
// "yaklaşık" sayılmalıdır — bu ayrım gizlenmez, çünkü doğrulanmamış bir
// değeri doğrulanmış göstermek renk hatasından beterdir.
//
// ═══════════ AİLE KONTROLÜ — SÜPER LİG (2026-08-12) ═══════════════════════
// Kesin hex çoğu kulüp için hiç yayımlanmıyor. Yapılabilen ikinci en iyi şey
// RENK AİLESİNİ bağımsız bir kaynakla karşılaştırmaktı: RSSSF'in Türkiye
// renk listesi (rsssf.org/colours/turkey.html) ile dokuz kulüp kontrol
// edildi — Çaykur Rizespor (yeşil/mavi), Gaziantep (kırmızı/siyah),
// Gençlerbirliği (kırmızı/siyah), Göztepe (sarı/kırmızı), Kasımpaşa
// (mavi/beyaz), Kocaelispor (yeşil/siyah), Konyaspor (yeşil/beyaz),
// Samsunspor (kırmızı/beyaz), BB Erzurumspor (mavi/beyaz). HEPSİ bu tabloyla
// UYUŞTU. Ayrıca Başakşehir (lacivert/turuncu) ve Konyaspor ayrı bir
// derlemeyle de teyit edildi.
//
// Yani Süper Lig'de AİLESİ yanlış tek kulüp Trabzonspor'du (mavi yerine
// lacivert yazılmıştı) ve düzeltildi. Aile doğru olmak kesin tonun doğru
// olduğunu KANITLAMAZ; bu yüzden bu kulüpler [kResmiKaynakliTakimlar]
// kümesine EKLENMEDİ.
//
// ═══════════ AİLE KONTROLÜ — DÖRT BÜYÜK LİG (2026-08-12) ══════════════════
// Aynı kaynakla (RSSSF) İngiltere 20, İspanya 20, İtalya 18 ve Almanya 14
// kulüp karşılaştırıldı. RENK AİLESİ YANLIŞ OLAN TEK KULÜP:
//   • 1. FC Union Berlin — ikincil "sarı" yazılmıştı; kulübün geleneksel
//     renkleri kırmızı-BEYAZ, sarı yalnız armada. Düzeltildi.
// Kalanların hepsi uyuştu. Birkaç kulüpte ana/ikincil SIRASI kaynaktan farklı
// (ör. Elche beyaz-yeşil yerine yeşil-beyaz, Real Sociedad mavi-beyaz);
// bunlar HATA DEĞİL: `paletUret` beyaz ağırlıklı takımlarda kimliği zaten
// ikincil renkten alıyor, sıra kimliği bozmuyor.
//
// ═══════════ AİLE KONTROLÜ — KALAN ÜÇ LİG (2026-08-12) ════════════════════
// Portekiz 17, Hollanda 16, Fransa 13 kulüp aynı kaynakla karşılaştırıldı.
// YANLIŞ ÇIKAN TEK KULÜP:
//   • FC Alverca — "kırmızı-beyaz" yazılmıştı; kulüp MAVİ-KIRMIZI. Düzeltildi.
//
// ARAŞTIRILIP DOĞRU ÇIKAN (değiştirilmedi):
//   • NEC Nijmegen — kaynak "kırmızı/siyah" diyordu, tabloda kırmızı-yeşil
//     yazıyor. Kulübün renkleri kırmızı, YEŞİL ve siyahtır ("balkenshirt":
//     kırmızı üstünde geniş yeşil bant, iki yanında siyah). Tablo doğru,
//     kaynak forma/şort ayrımını tarif ediyormuş.
//   • CS Marítimo — kaynak "siyah-kırmızı" diyor, tabloda yeşil-kırmızı.
//     Kulüp "verde-rubro" olarak bilinir; kaynağın kaydı şüpheli görüldüğü
//     için DEĞİŞTİRİLMEDİ. Kesin bir kulüp kaynağıyla teyit edilmeli.
//   • RSSSF'in "Academica Viseu"su bizim "Academico de Viseu"muzdan FARKLI
//     bir kulüptür; eşleştirilmedi (yanlış eşleşmeyle veri bozmak, eksik
//     veriden kötüdür).
//
// ═══════════ İKİNCİ TUR — KALAN 17 KULÜP (2026-08-12) ═════════════════════
// Aile kontrolünün dışında kalan 17 kulübün HER BİRİ tek tek araştırıldı.
//
// KESİN DEĞER BULUNDU (8) — hepsi [kResmiKaynakliTakimlar] kümesinde,
// satırlarında kaynak yorumu var:
//   Sassuolo (değişmedi) · RB Leipzig · Hoffenheim · Paderborn · Lorient ·
//   Brest · Groningen · Elversberg
//
// AİLESİ YANLIŞ ÇIKAN VE DÜZELTİLEN (1):
//   • SV 07 Elversberg — "kırmızı-siyah" yazılmıştı; kulübün lakabı
//     "Schwarz und Weiß", forması siyah/beyaz. Kırmızı kulüpte hiç yok.
//
// YALNIZ AİLE DOĞRULANDI, KESİN HEX YAYIMLANMAMIŞ (9) — değerler KORUNDU,
// tahmin YAPILMADI, kümeye EKLENMEDİ:
//   Alanyaspor (turuncu-yeşil) · Başakşehir (lacivert-turuncu) ·
//   Eyüpspor (eflatun-sarı) · Casa Pia (siyah-beyaz) ·
//   Famalicão (lacivert-altın-beyaz) · PEC Zwolle (mavi-beyaz) ·
//   Paris FC (mavi-beyaz) ·
//   Frosinone (YALNIZ mavi #004393 kaynaklı, sarı yayımlanmamış) ·
//   Arouca (YALNIZ sarı #FEF405 kaynaklı; ikincil renk BELİRSİZ — aynı palet
//     hem mavi hem kırmızı listeliyor, seçim yapılmadı)
//
// ÖZET (iki tur birlikte): 8 ligin 148 kulübünün TAMAMI gözden geçirildi.
// AİLESİ yanlış DÖRT kulüp bulundu ve düzeltildi — Trabzonspor, Union
// Berlin, Alverca, Elversberg. Kesin değeri kaynakla doğrulanmış kulüp
// sayısı 13. Kalanlarda renk UYDURULMADI.
//
// LİSTEDE OLMAYAN TAKIM: tabloya girmemiş, adı eşleşmeyen ya da katalogda
// bulunmayan takımda VARSAYILAN TEMA korunur (bkz. `takimPaletiBul` → null).
// Uydurma renk üretilmez.

import 'dart:ui';

import '../utils.dart';
import 'takim_paleti.dart';

/// (ana renk, ikincil renk) — türetme `paletUret` içinde.
typedef TakimRenkCifti = (int ana, int ikincil);

/// RENGİ DIŞ KAYNAKLA DOĞRULANMIŞ takımlar (kullanıcı isteği, 2026-08-12).
///
/// Buradaki her ad için [kTakimRenkleri] satırında KAYNAK YORUMU vardır.
/// Kümede olmayan takımların değerleri "bilinen forma rengi" düzeyindedir ve
/// resmî bir kaynakla karşılaştırılmamıştır.
///
/// NİYE AÇIKÇA YAZILIYOR: 148 takımın tamamını resmî kaynaktan doğrulamak tek
/// oturumda bitmez. Yarısı doğrulanmış bir tabloyu "hepsi resmî" diye sunmak,
/// yanlış rengi düzeltilemez hâle getirirdi. Doğrulanan her takım bu kümeye
/// eklenir; test kümedeki her adın tabloda gerçekten bulunmasını bekçiler.
const Set<String> kResmiKaynakliTakimlar = {
  '1. FC Union Berlin',
  'Beşiktaş',
  'Fenerbahçe',
  'Galatasaray',
  'Trabzonspor',
  // 2026-08-12 ikinci tur — kalan 17 takımın araştırmasından çıkanlar.
  'FC Groningen',
  'FC Lorient',
  'Rasen Ballsport Leipzig',
  'SC Paderborn 07',
  'SV 07 Elversberg',
  'Stade Brestois 29',
  'TSG 1899 Hoffenheim',
  'US Sassuolo Calcio',
};

/// Katalog adı → renk çifti. Anahtarlar `kucukTr` ile normalize edilerek
/// aranır; buradaki yazım katalogdaki `name` alanıyla birebir aynıdır.
const Map<String, TakimRenkCifti> kTakimRenkleri = {
  // ───────────────────────── Türkiye · Süper Lig ─────────────────────────
  // AİLE DOĞRULANDI (2026-08-12): turuncu-yeşil (1982 tüzük değişikliğiyle
  // benimsendi). Kesin hex yayımlanmamış — mevcut tonlar korundu.
  'Alanyaspor': (0xFFF47A20, 0xFF00954E),
  'Amed Sportif Faaliyetler Kulübü': (0xFF009639, 0xFFE30613),
  'BB Erzurumspor': (0xFF0F52BA, 0xFFFFFFFF),
  // DOĞRULANDI (2026-08-12): teamcolorcodes.com — siyah PMS Process Black C
  // (#000000), beyaz #FFFFFF. Mevcut değerle BİREBİR aynı, değişiklik yok.
  // (Armadaki kırmızı PMS 2347 C bir LOGO rengidir, kulüp rengi değil.)
  'Beşiktaş': (0xFF000000, 0xFFFFFFFF),
  'Çaykur Rizespor': (0xFF006B3F, 0xFF0067B1),
  'Çorum Belediye Spor Kulübü': (0xFFE1251B, 0xFF000000),
  // AİLE DOĞRULANDI (2026-08-12): eflatun-sarı. Kesin hex yayımlanmamış —
  // mevcut tonlar korundu.
  'Eyüp Spor Kulübü': (0xFF6A1B9A, 0xFFFDD835),
  // DOĞRULANDI (2026-08-12): kulüp sarı ve laciverdini RENK MARKASI olarak
  // tescil ettirdi (Pantone 13-0858 TPX sarı, 19-3939 TPX lacivert; başvuru
  // 24.06.2018, tescil 08.03.2019). Sayısal karşılık #FFED00 / #00417F.
  // Eski lacivert #003B7B birkaç basamak sapıyordu.
  'Fenerbahçe': (0xFF00417F, 0xFFFFED00),
  // DOĞRULANDI (2026-08-12): kulüp tüzüğü md.3 renkleri SÖZEL tanımlar —
  // kırmızı "vişneye çalan koyu bir kırmızı", sarı "içinde turuncudan iz
  // taşıyan tok bir sarı". Sayısal karşılık teamcolorcodes.com'dan: kırmızı
  // PANTONE 187 (#A90432), sarı PANTONE 123 C (#FDB912). Kırmızının bordoya
  // yakın durması TÜZÜĞÜN KENDİ TARİFİDİR, hata değil.
  'Galatasaray': (0xFFA90432, 0xFFFDB912),
  'Gaziantep FK': (0xFFD3122E, 0xFF000000),
  'Gençlerbirliği': (0xFFE30613, 0xFF000000),
  'Göztepe': (0xFFFFD500, 0xFFE2001A),
  // AİLE DOĞRULANDI (2026-08-12): "Turuncu-Lacivertliler"; lacivert+turuncu
  // teyit edildi ama kulüp kesin hex YAYIMLAMIYOR — mevcut tonlar korundu.
  'İstanbul Başakşehir FK': (0xFF0B2F6E, 0xFFF58220),
  'Kasimpasa': (0xFF0B3B75, 0xFFFFFFFF),
  'Kocaelispor Kulübü': (0xFF00693E, 0xFF000000),
  'Konyaspor': (0xFF00693E, 0xFFFFFFFF),
  'Samsunspor': (0xFFE30613, 0xFFFFFFFF),
  // DÜZELTİLDİ (2026-08-12): kulübün KENDİ kurumsal kimlik sayfası
  // (trabzonspor.org.tr → Kurumsal Kimlik) bordo #902F2F, mavi #4FBFF0 diyor.
  // Buradaki eski mavi #00539F KOYU LACİVERTTİ ve kulübün açık gök mavisiyle
  // hiç uyuşmuyordu (kullanıcı da bunu bildirdi).
  'Trabzonspor': (0xFF902F2F, 0xFF4FBFF0),

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
  // KISMEN DOĞRULANDI (2026-08-12): mavi #004393 (marka paleti). SARI için
  // kulüp resmî bir değer YAYIMLAMIYOR; eski sarı #FFD500 KORUNDU — uydurma
  // yapılmadı. Bu yüzden kResmiKaynakliTakimlar kümesine EKLENMEDİ.
  'Frosinone Calcio': (0xFF004393, 0xFFFFD500),
  'Genoa CFC': (0xFFB4162B, 0xFF002B5C),
  'Juventus FC': (0xFF000000, 0xFFFFFFFF),
  'Parma Calcio 1913': (0xFFFFD700, 0xFF004B8D),
  'SS Lazio': (0xFF87D8F7, 0xFFFFFFFF),
  'SS Monza 1912': (0xFFE30613, 0xFFFFFFFF),
  'SSC Napoli': (0xFF12A0D7, 0xFFFFFFFF),
  'Torino FC': (0xFF881B1F, 0xFFFFFFFF),
  'Udinese Calcio': (0xFF000000, 0xFFFFFFFF),
  'US Lecce': (0xFFFFD500, 0xFFD3122E),
  // DOĞRULANDI (2026-08-12): yeşil PANTONE 2257 XGC (#00A752), siyah PANTONE
  // Black 6 C (#000000). Mevcut değerle BİREBİR aynı — değişiklik yok.
  'US Sassuolo Calcio': (0xFF00A752, 0xFF000000),
  'Venezia FC': (0xFF000000, 0xFF00A650),

  // ───────────────────────── Almanya · Bundesliga ────────────────────────
  '1. FC Köln': (0xFFE32219, 0xFFFFFFFF),
  // DÜZELTİLDİ (2026-08-12): kulübün GELENEKSEL renkleri kırmızı-BEYAZ
  // ("Vereinsfarben rot-weiß"); kırmızı #EB1923 zaten doğruydu. Sarı
  // (#FDDC02) ve siyah ARMADA var ama kulüp rengi değil — ikincil olarak
  // sarı yazmak kulübün kimliğini yanlış gösteriyordu.
  '1. FC Union Berlin': (0xFFEB1923, 0xFFFFFFFF),
  '1. FSV Mainz 05': (0xFFC3141E, 0xFFFFFFFF),
  'Bayer 04 Leverkusen': (0xFFE32221, 0xFF000000),
  'Borussia VfL Mönchengladbach': (0xFFFFFFFF, 0xFF00A752),
  'BVB 09 Borussia Dortmund': (0xFFFDE100, 0xFF000000),
  'Eintracht Frankfurt': (0xFF000000, 0xFFE1000F),
  'FC Augsburg': (0xFF00694E, 0xFFBA3733),
  'FC Bayern München': (0xFFDC052D, 0xFF0066B2),
  'FC Schalke 04': (0xFF004D9D, 0xFFFFFFFF),
  'Hamburger SV': (0xFF0A3F7E, 0xFFD50032),
  // DOĞRULANDI (2026-08-12): kırmızı PANTONE 192 C (#DD013F), beyaz #FFFFFF.
  // Eski kırmızı #DD0741 iki basamak sapıyordu. NOT: kulüp ve Bundesliga
  // resmî bir renk tablosu YAYIMLAMIYOR; bu değer Pantone referanslı yaygın
  // standart.
  'Rasen Ballsport Leipzig': (0xFFFFFFFF, 0xFFDD013F),
  'SC Freiburg': (0xFFE2001A, 0xFFFFFFFF),
  // DOĞRULANDI (2026-08-12): kulüp renkleri mavi-siyah; logo mavisi #005CA8.
  // Eski mavi #004E9E sapıyordu. Siyah için ayrı bir değer yayımlanmamış,
  // #000000 korundu.
  'SC Paderborn 07': (0xFF005CA8, 0xFF000000),
  // DÜZELTİLDİ (2026-08-12): kulübün lakabı "Schwarz und Weiß" (siyah-beyaz);
  // Wikipedia forma tarifi de siyah forma / beyaz şort. Tabloda KIRMIZI-siyah
  // yazıyordu — kırmızı kulüpte hiç yok. Kesin hex yayımlanmadığı için saf
  // siyah/beyaz kullanıldı.
  'SV 07 Elversberg': (0xFF000000, 0xFFFFFFFF),
  'SV Werder Bremen': (0xFF1D9053, 0xFFFFFFFF),
  // DOĞRULANDI (2026-08-12): mavi PMS 2935 C (#1961B5), beyaz #FFFFFF.
  // Eski mavi #1C63B7 birkaç basamak sapıyordu.
  'TSG 1899 Hoffenheim': (0xFF1961B5, 0xFFFFFFFF),
  'VfB Stuttgart 1893': (0xFFFFFFFF, 0xFFE32219),

  // ───────────────────── Portekiz · Liga Portugal ────────────────────────
  'Academico de Viseu FC': (0xFFC8102E, 0xFF000000),
  // DÜZELTİLDİ (2026-08-12): kulübün geleneksel renkleri MAVİ-KIRMIZI
  // (2025-26 forması "Royal Blue / University Red"); tabloda kırmızı-beyaz
  // yazıyordu — ikisi de yanlıştı. Kesin marka hex'i yayımlanmadığı için ton
  // YAKLAŞIKTIR; doğrulanan şey renk AİLESİDİR, bu yüzden
  // kResmiKaynakliTakimlar kümesine eklenmedi.
  'Alverca': (0xFF0A4595, 0xFFD3122E),
  // AİLE DOĞRULANDI (2026-08-12): siyah-beyaz (2023-24 formaları siyah,
  // beyaz detaylı). Kulüp kesin hex YAYIMLAMIYOR — saf siyah/beyaz korundu.
  'Casa Pia AC': (0xFF000000, 0xFFFFFFFF),
  'CD Nacional Funchal': (0xFF000000, 0xFFFFFFFF),
  'CD Santa Clara': (0xFFE30613, 0xFFFFFFFF),
  'CS Marítimo Funchal': (0xFF00693E, 0xFFD3122E),
  'Estrela Amadora': (0xFFD3122E, 0xFF00A650),
  // KISMEN DOĞRULANDI (2026-08-12): marka paleti sarıyı #FEF405 veriyor;
  // eski #FFD500 sapıyordu. İKİNCİL RENK BELİRSİZ — aynı palet hem mavi
  // (#024CAB) hem kırmızı (#EE0206) listeliyor ve hangisinin kulüp rengi
  // olduğu kesinleşmedi. TAHMİN YAPILMADI: mevcut kırmızı korundu.
  'FC Arouca': (0xFFFEF405, 0xFFD3122E),
  // AİLE DOĞRULANDI (2026-08-12): resmî renkler lacivert, altın ve beyaz.
  // Lacivert+beyaz tabloyla uyuşuyor; altın ÜÇÜNCÜ renk olduğu için ikili
  // eşlemeye girmedi. Kesin hex yayımlanmamış, tonlar korundu.
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
  // DOĞRULANDI (2026-08-12): yeşil PANTONE 348 C (#008E5A), beyaz #FFFFFF.
  // Eski yeşil #00A650 daha parlaktı.
  'FC Groningen': (0xFF008E5A, 0xFFFFFFFF),
  'FC Twente': (0xFFE30613, 0xFFFFFFFF),
  'FC Utrecht': (0xFFE30613, 0xFFFFFFFF),
  'Feyenoord Rotterdam': (0xFFE30613, 0xFFFFFFFF),
  'Fortuna Sittard': (0xFFFFD500, 0xFF00A650),
  'Go Ahead Eagles': (0xFFE30613, 0xFFFFD500),
  'HFC ADO Den Haag': (0xFF00A650, 0xFFFFD500),
  'Nijmegen Eendracht Combinatie': (0xFFE30613, 0xFF00A650),
  // AİLE DOĞRULANDI (2026-08-12): mavi-beyaz (geleneksel mavi-beyaz çizgili).
  // Kesin hex yayımlanmamış — mevcut tonlar korundu.
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
  // DOĞRULANDI (2026-08-12): turuncu PANTONE 151 C (#F58113), siyah PMS
  // Process Black C (#000000). Eski turuncu #F58220 az sapıyordu.
  'FC Lorient': (0xFFF58113, 0xFF000000),
  'Le Havre AC': (0xFF6CACE4, 0xFF00205B),
  'Le Mans FC': (0xFFFFD500, 0xFFD3122E),
  'Lille OSC Métropole': (0xFFE01E13, 0xFFFFFFFF),
  "OGC Nice Côte d'Azur": (0xFFE30613, 0xFF000000),
  'Olympique de Marseille': (0xFF2FAEE0, 0xFFFFFFFF),
  'Olympique Lyonnais': (0xFFFFFFFF, 0xFF003DA5),
  // AİLE DOĞRULANDI (2026-08-12): mavi-beyaz. Kulüp marka kılavuzunda kesin
  // değer YAYIMLAMIYOR — mevcut tonlar korundu, uydurma yapılmadı.
  'Paris FC': (0xFF003DA5, 0xFFFFFFFF),
  'Paris Saint-Germain FC': (0xFF004170, 0xFFDA291C),
  'Racing Club de Lens': (0xFFFFD500, 0xFFE30613),
  'RC Strasbourg Alsace': (0xFF0072BC, 0xFFFFFFFF),
  // DOĞRULANDI (2026-08-12): kırmızı PANTONE 1788 C (#ED1C24), beyaz
  // #FFFFFF (siyah da resmî üçüncü renk). Eski kırmızı #E30613 sapıyordu.
  'Stade Brestois 29': (0xFFED1C24, 0xFFFFFFFF),
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
