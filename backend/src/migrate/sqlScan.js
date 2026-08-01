// ---------------------------------------------------------------------------
// SQL TARAYICI — migration dosyalarını GÜVENLE parçalara ayırır.
// ---------------------------------------------------------------------------
// NEDEN GEREKLİ: Migration dosyalarını çalıştıran taraf, transaction'ı KENDİSİ
// yönetmek zorundadır (bkz. runner.js). Ama 001–005 dosyaları kendi içlerinde
// `BEGIN;` / `COMMIT;` taşıyor, 006 taşımıyor. Dosyanın içindeki `COMMIT;`
// çalışırsa runner'ın açtığı transaction erkenden kapanır ve defter kaydı
// (schema_migrations) migration'la AYNI transaction'da olmaz — yani "uygulandı
// ama deftere yazılamadı" ya da tersi bir yarım durum mümkün hale gelir.
//
// Çözüm: dosyayı ifadelere ayırıp YALNIZ EN ÜST SEVİYEDEKİ transaction kontrol
// ifadelerini (BEGIN/COMMIT/ROLLBACK/SAVEPOINT...) devre dışı bırakmak. Böylece
// dosyanın SQL'i hiç değiştirilmeden, tek ve bölünmez bir transaction içinde
// çalışır. Dosyaların DİSKTEKİ İÇERİĞİNE DOKUNULMAZ; checksum da her zaman
// diskteki ham baytlar üzerinden hesaplanır.
//
// NEDEN BASİT bir regex YETMEZ: PL/pgSQL gövdeleri `$$ ... BEGIN ... END $$`
// içinde kendi BEGIN'lerini taşır (001'de 8, 002'de 4 dolar-tırnak bloğu var).
// Bir regex bunları da yakalar ve fonksiyon gövdesini bozardı. Bu yüzden
// dolar-tırnak, tek tırnak, çift tırnak, satır yorumu ve (iç içe geçebilen)
// blok yorumu doğru şekilde izlenir.
//
// Bu dosya SAF'tır: hiçbir şey import etmez, veritabanına dokunmaz. Bu yüzden
// veritabanı olmadan test edilebilir.

// PSQL META-KOMUTLARI: `\set ON_ERROR_STOP on`, `\i dosya`, `\echo ...` gibi
// satırlar SQL DEĞİLDİR — psql komut satırı aracına aittir. Hiçbir PostgreSQL
// sürücüsü bunları çalıştıramaz; sunucuya gönderilirlerse
// `syntax error at or near "\"` [42601] hatası verir ve migration çöker.
// 005_history_dna.sql'in 27. satırı tam olarak böyle bir satır taşıyor.
// Dosya baytlarına DOKUNULMAZ (checksum ve mevcut psql yolu bozulmasın diye);
// yalnız çalıştırma sırasında atlanır ve atlandığı açıkça raporlanır.

/** En üst seviyede transaction akışını değiştiren ifadeler. */
const ISLEM_KONTROL = [
  { tur: 'begin', kalip: /^(begin|start\s+transaction)\b/i },
  { tur: 'commit', kalip: /^(commit|end)\b(?!\s+(if|loop|case))/i },
  { tur: 'rollback', kalip: /^rollback\b/i },
  { tur: 'savepoint', kalip: /^(savepoint|release\s+savepoint)\b/i },
  { tur: 'set-transaction', kalip: /^set\s+(local\s+)?transaction\b/i },
];

/**
 * SQL metnini en üst seviye ifadelere ayırır.
 * Yorumlar ve boşluklar ifadenin metninde KORUNUR (satır numaraları doğru kalsın
 * diye), ama yalnız gerçekten çalıştırılabilir içerik taşıyan ifadeler döner.
 *
 * @param {string} sql
 * @returns {{metin:string, satir:number, tur:string|null}[]}
 */
export function ifadeleriAyir(sql) {
  const ifadeler = [];
  let bas = 0;         // mevcut ifadenin başlangıç indeksi
  let satir = 1;       // mevcut ifadenin başladığı satır
  let satirSayaci = 1; // taranan konumun satırı
  let i = 0;
  const n = sql.length;

  const bitir = (son) => {
    const ham = sql.slice(bas, son);
    if (calisirIcerikVar(ham)) {
      ifadeler.push({ metin: ham, satir, tur: ifadeTuru(ham) });
    }
    bas = son;
    satir = satirSayaci;
  };

  while (i < n) {
    const c = sql[i];

    // --- psql meta-komutu (satır başında `\...`) ---
    // SQL değil, psql aracının komutu. Sürücüye gönderilemez.
    if (c === '\\' && satirBasindaMi(sql, i)) {
      // Bir ifadenin ORTASINDA meta-komut varsa, atlamak ifadeyi ikiye böler ve
      // iki yarım parça sunucuya ayrı ayrı gider. Bu sessizce yapılmaz.
      if (calisirIcerikVar(sql.slice(bas, i))) {
        throw new Error(
          `psql meta-komutu bir SQL ifadesinin ORTASINDA (${satirSayaci}. satır): ` +
          `"${satirSonunaKadar(sql, i).slice(0, 60)}". Meta-komut, ifadeler ARASINDA ` +
          'olmalıdır; aksi hâlde ifade ikiye bölünürdü.',
        );
      }
      let son = i;
      while (son < n && sql[son] !== '\n') son++;
      ifadeler.push({ metin: sql.slice(i, son).trim(), satir: satirSayaci, tur: 'psql-meta' });
      if (son < n) { son++; satirSayaci++; } // satır sonunu da yut
      i = son;
      bas = i;
      satir = satirSayaci;
      continue;
    }

    // --- satır yorumu ---
    if (c === '-' && sql[i + 1] === '-') {
      while (i < n && sql[i] !== '\n') i++;
      continue;
    }

    // --- blok yorumu (PostgreSQL'de İÇ İÇE geçebilir) ---
    if (c === '/' && sql[i + 1] === '*') {
      let derinlik = 1;
      i += 2;
      while (i < n && derinlik > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') { derinlik++; i += 2; continue; }
        if (sql[i] === '*' && sql[i + 1] === '/') { derinlik--; i += 2; continue; }
        if (sql[i] === '\n') satirSayaci++;
        i++;
      }
      continue;
    }

    // --- tek tırnaklı metin ('' kaçışıyla) ---
    if (c === "'") {
      i++;
      while (i < n) {
        if (sql[i] === "'" && sql[i + 1] === "'") { i += 2; continue; }
        if (sql[i] === "'") { i++; break; }
        if (sql[i] === '\n') satirSayaci++;
        i++;
      }
      continue;
    }

    // --- çift tırnaklı tanımlayıcı ("" kaçışıyla) ---
    if (c === '"') {
      i++;
      while (i < n) {
        if (sql[i] === '"' && sql[i + 1] === '"') { i += 2; continue; }
        if (sql[i] === '"') { i++; break; }
        if (sql[i] === '\n') satirSayaci++;
        i++;
      }
      continue;
    }

    // --- dolar-tırnak: $$ ... $$ veya $etiket$ ... $etiket$ ---
    if (c === '$') {
      const etiket = dolarEtiketi(sql, i);
      if (etiket) {
        i += etiket.length;
        const kapanis = sql.indexOf(etiket, i);
        const son = kapanis === -1 ? n : kapanis + etiket.length;
        for (let k = i; k < son; k++) if (sql[k] === '\n') satirSayaci++;
        i = son;
        continue;
      }
    }

    // --- ifade sonu ---
    if (c === ';') {
      i++;
      bitir(i);
      continue;
    }

    if (c === '\n') satirSayaci++;
    i++;
  }

  // Son ifade noktalı virgülle bitmemiş olabilir.
  if (bas < n) bitir(n);
  return ifadeler;
}

/** `i` konumundan önce, satır başından beri yalnız boşluk mu var? */
function satirBasindaMi(sql, i) {
  for (let j = i - 1; j >= 0; j--) {
    const c = sql[j];
    if (c === '\n') return true;
    if (c === ' ' || c === '\t' || c === '\r') continue;
    return false;
  }
  return true; // dosyanın en başı
}

/** `i` konumundan satır sonuna kadarki metin (hata mesajları için). */
function satirSonunaKadar(sql, i) {
  let son = i;
  while (son < sql.length && sql[son] !== '\n') son++;
  return sql.slice(i, son).trim();
}

/** `$$` veya `$etiket$` ise tam etiketi döndürür, değilse null. */
function dolarEtiketi(sql, i) {
  if (sql[i] !== '$') return null;
  let j = i + 1;
  while (j < sql.length && /[A-Za-z0-9_]/.test(sql[j])) j++;
  if (sql[j] !== '$') return null;
  return sql.slice(i, j + 1);
}

/** Yorum ve boşluk çıkarıldığında geriye çalışacak bir şey kalıyor mu? */
function calisirIcerikVar(ham) {
  return cikarYorum(ham).replace(/;/g, '').trim().length > 0;
}

/**
 * Yorumları çıkarır (metin/dolar-tırnak içindekilere DOKUNMAZ).
 * Yalnız ifade türü tespiti ve statik denetimler için kullanılır.
 */
export function cikarYorum(sql) {
  let cikti = '';
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    if (c === '-' && sql[i + 1] === '-') { while (i < n && sql[i] !== '\n') i++; continue; }
    if (c === '/' && sql[i + 1] === '*') {
      let d = 1; i += 2;
      while (i < n && d > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') { d++; i += 2; continue; }
        if (sql[i] === '*' && sql[i + 1] === '/') { d--; i += 2; continue; }
        i++;
      }
      continue;
    }
    if (c === "'" || c === '"') {
      const q = c; cikti += sql[i++];
      while (i < n) {
        if (sql[i] === q && sql[i + 1] === q) { cikti += sql[i] + sql[i + 1]; i += 2; continue; }
        cikti += sql[i];
        if (sql[i] === q) { i++; break; }
        i++;
      }
      continue;
    }
    const etiket = dolarEtiketi(sql, i);
    if (etiket) {
      const kapanis = sql.indexOf(etiket, i + etiket.length);
      const son = kapanis === -1 ? n : kapanis + etiket.length;
      cikti += sql.slice(i, son);
      i = son;
      continue;
    }
    cikti += c;
    i++;
  }
  return cikti;
}

/** İfade en üst seviye bir transaction kontrolü mü? Değilse null. */
export function ifadeTuru(ham) {
  const t = cikarYorum(ham).trim().replace(/;+\s*$/, '').trim();
  for (const { tur, kalip } of ISLEM_KONTROL) if (kalip.test(t)) return tur;
  return null;
}

/**
 * Dosyayı, EN ÜST SEVİYEDEKİ transaction kontrol ifadeleri çıkarılmış hâlde
 * çalıştırılabilir ifadeler listesine çevirir.
 * @returns {{ifadeler:{metin:string,satir:number}[], atlanan:{tur:string,satir:number}[]}}
 */
export function calistirilacakIfadeler(sql) {
  const ifadeler = [];
  const atlanan = [];
  for (const it of ifadeleriAyir(sql)) {
    if (it.tur) atlanan.push({ tur: it.tur, satir: it.satir });
    else ifadeler.push({ metin: it.metin, satir: it.satir });
  }
  return { ifadeler, atlanan };
}

// ---------------------------------------------------------------------------
// DOĞRULAMA MANİFESTOSU — migration'lardan TÜRETİLİR, elle yazılmaz.
// ---------------------------------------------------------------------------
// Böylece yeni bir migration eklendiğinde doğrulama listesi kendiliğinden
// güncellenir; elle tutulan bir liste gibi sessizce eskiyemez.

const TABLO_KALIBI = /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?((?:"[^"]+"|[A-Za-z0-9_]+)(?:\.(?:"[^"]+"|[A-Za-z0-9_]+))?)/gi;
const RLS_KALIBI = /\balter\s+table\s+(?:if\s+exists\s+)?((?:"[^"]+"|[A-Za-z0-9_]+)(?:\.(?:"[^"]+"|[A-Za-z0-9_]+))?)\s+enable\s+row\s+level\s+security/gi;
const TRIGGER_KALIBI = /\bcreate\s+(?:or\s+replace\s+)?(?:constraint\s+)?trigger\s+([A-Za-z0-9_"]+)/gi;

const ad = (s) => {
  const p = s.split('.').map((x) => x.replace(/^"|"$/g, ''));
  return p.length === 2 ? `${p[0]}.${p[1]}` : `public.${p[0]}`;
};

/** SQL'de `create table` ile oluşturulan tabloların tam adları. */
export function olusturulanTablolar(sql) {
  const temiz = cikarYorum(sql);
  return [...temiz.matchAll(TABLO_KALIBI)].map((m) => ad(m[1]));
}

/** SQL'de RLS açılan tabloların tam adları. */
export function rlsAcilanTablolar(sql) {
  const temiz = cikarYorum(sql);
  return [...temiz.matchAll(RLS_KALIBI)].map((m) => ad(m[1]));
}

/** SQL'de oluşturulan trigger adları. */
export function olusturulanTriggerlar(sql) {
  const temiz = cikarYorum(sql);
  return [...temiz.matchAll(TRIGGER_KALIBI)].map((m) => m[1].replace(/^"|"$/g, ''));
}
