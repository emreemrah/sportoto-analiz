// ---------------------------------------------------------------------------
// MIGRATION PLANI — hangi dosya çalışacak, hangisi çalışmayacak, ne bozulmuş?
// ---------------------------------------------------------------------------
// Bu dosya SAF'tır: veritabanına bağlanmaz, yalnız (dosyalar + defter kayıtları)
// çiftinden bir KARAR üretir. Böylece kararın kendisi veritabanı olmadan test
// edilebilir ve runner.js yalnız "kararı uygulayan" ince bir katman kalır.
//
// TEK DOĞRULUK KAYNAĞI: backend/migrations/*.sql dosyalarının DİSKTEKİ HÂLİ.
// Defter (public.schema_migrations) yalnız "bunlardan hangileri, ne zaman ve
// hangi içerikle uygulandı" sorusunun cevabını tutar.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** `001_bulletin_archive.sql` → sürüm `001`. Kalıba uymayan dosya YOK SAYILMAZ, hata olur. */
const DOSYA_KALIBI = /^(\d{3,})_([A-Za-z0-9_.-]+)\.sql$/;

/** Dosya baytlarının sha256 özeti — bütünlük mührü. */
export function ozetle(icerik) {
  return createHash('sha256').update(icerik, 'utf8').digest('hex');
}

/**
 * Migration klasörünü okur ve sürüm sırasına dizer.
 * @param {string} klasor
 * @returns {{surum:string, sira:number, dosya:string, icerik:string, ozet:string}[]}
 */
export function dosyalariOku(klasor) {
  const hepsi = readdirSync(klasor).filter((f) => f.toLowerCase().endsWith('.sql'));
  const gecersiz = hepsi.filter((f) => !DOSYA_KALIBI.test(f));
  if (gecersiz.length) {
    // Sessizce atlamak, bir migration'ın hiç çalışmaması demek olurdu.
    throw new Error(
      `Migration dosya adı kuralına uymayan dosya(lar): ${gecersiz.join(', ')}. ` +
      'Beklenen biçim: 001_aciklayici_ad.sql',
    );
  }
  const dosyalar = hepsi.map((dosya) => {
    const [, numara] = dosya.match(DOSYA_KALIBI);
    const icerik = readFileSync(join(klasor, dosya), 'utf8');
    return { surum: numara, sira: Number(numara), dosya, icerik, ozet: ozetle(icerik) };
  });

  const tekrar = dosyalar.map((d) => d.surum).filter((s, i, a) => a.indexOf(s) !== i);
  if (tekrar.length) {
    throw new Error(`Aynı sürüm numarasına sahip birden çok migration: ${[...new Set(tekrar)].join(', ')}`);
  }
  return dosyalar.sort((a, b) => a.sira - b.sira);
}

/**
 * Dosyalar + defter → uygulanacak plan.
 *
 * @param {{surum:string,sira:number,dosya:string,ozet:string}[]} dosyalar
 * @param {{version:string,filename:string,checksum:string}[]} defter
 * @returns {{bekleyen:any[], uygulanmis:any[], sorunlar:{tur:string,surum:string,mesaj:string}[]}}
 */
export function planCikar(dosyalar, defter) {
  const defterMap = new Map(defter.map((k) => [k.version, k]));
  const bekleyen = [];
  const uygulanmis = [];
  const sorunlar = [];

  for (const d of dosyalar) {
    const kayit = defterMap.get(d.surum);
    if (!kayit) { bekleyen.push(d); continue; }

    // BÜTÜNLÜK: uygulanmış bir dosya sonradan değiştirilmişse SESSİZCE KABUL EDİLMEZ.
    if (kayit.checksum !== d.ozet) {
      sorunlar.push({
        tur: 'icerik-degismis',
        surum: d.surum,
        mesaj:
          `${d.dosya} daha önce uygulanmış, ama dosyanın içeriği o günden beri DEĞİŞMİŞ. ` +
          'Uygulanmış bir migration geriye dönük değiştirilemez — değişiklik yeni bir ' +
          'migration dosyası olarak eklenmelidir. (Veritabanına hiçbir şey uygulanmadı.)',
      });
      continue;
    }
    if (kayit.filename !== d.dosya) {
      sorunlar.push({
        tur: 'dosya-adi-degismis',
        surum: d.surum,
        mesaj:
          `${d.surum} sürümü deftere "${kayit.filename}" adıyla yazılmış, diskte ise ` +
          `"${d.dosya}" var. Uygulanmış bir migration'ın adı değiştirilemez.`,
      });
      continue;
    }
    uygulanmis.push(d);
  }

  // Defterde olup diskte OLMAYAN kayıt: dosya silinmiş demektir. Geçmiş silinmez.
  const diskSurumleri = new Set(dosyalar.map((d) => d.surum));
  for (const k of defter) {
    if (!diskSurumleri.has(k.version)) {
      sorunlar.push({
        tur: 'dosya-silinmis',
        surum: k.version,
        mesaj:
          `Defterde uygulanmış görünen ${k.version} (${k.filename}) dosyası backend/migrations ` +
          'içinde YOK. Uygulanmış bir migration dosyası silinemez.',
      });
    }
  }

  // SIRA: uygulanmış en yüksek sürümün ALTINDA bekleyen bir dosya varsa, araya
  // sonradan migration sokulmuş demektir. Bu sessizce çalıştırılırsa sıra bozulur.
  const enYuksekUygulanan = defter.reduce((m, k) => Math.max(m, Number(k.version) || 0), 0);
  for (const d of bekleyen) {
    if (d.sira < enYuksekUygulanan) {
      sorunlar.push({
        tur: 'sirasiz',
        surum: d.surum,
        mesaj:
          `${d.dosya} henüz uygulanmamış, ama ondan daha yüksek numaralı migration'lar ` +
          `zaten uygulanmış (en yüksek: ${String(enYuksekUygulanan).padStart(3, '0')}). ` +
          'Araya geriye dönük migration eklenemez; yeni dosyaya sıradaki numarayı ver.',
      });
    }
  }

  return { bekleyen, uygulanmis, sorunlar };
}
