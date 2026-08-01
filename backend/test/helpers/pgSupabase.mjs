// ---------------------------------------------------------------------------
// PostgREST BİÇİMLİ İNCE KABUK — gerçek PostgreSQL üstünde
// ---------------------------------------------------------------------------
// NEDEN VAR: `moderationOps.js` işlevleri Supabase istemcisini DIŞARIDAN alır.
// Sahte istemciyle (helpers/fakeSupabase.mjs) mantık ölçülür, ama trigger'ın
// ne yaptığı ölçülemez — sahte istemcide trigger yoktur.
//
// Bu kabuk, aynı işlevleri GERÇEK veritabanına karşı çalıştırmayı sağlar.
// Böylece test edilen şey "trigger şöyle davranır" varsayımı değil, ÜRETİMDE
// çalışacak kodun gerçek şema üstündeki davranışıdır.
//
// KAPSAM: bilerek dar. Yalnız moderationOps.js'in kullandığı zincir desteklenir
// (select/update + eq/neq/in/is/order/limit/maybeSingle). Desteklenmeyen bir
// çağrı SESSİZCE yanlış sonuç vermez, HATA fırlatır — kabuğun eksikliği teste
// "geçti" dedirtmemeli.
//
// GÜVENLİK: bu dosya YALNIZ testte kullanılır. Kolon adları kimlik olarak
// tırnaklanır, değerler her zaman parametre olarak gider ($1, $2 ...); metin
// birleştirmeyle SQL kurulmaz.

const KOLON = /^[a-z_][a-z0-9_]*$/i;

function kimlik(ad) {
  const s = String(ad);
  if (!KOLON.test(s)) throw new Error(`pgSupabase: geçersiz kolon adı "${s}"`);
  return `"${s}"`;
}

/**
 * @param {{q: (sql: string, p?: any[]) => Promise<any[]>}} db helpers/livePg.mjs'in `baglan` çıktısı
 * @returns {{from: (tablo: string) => object}} Supabase istemcisine benzeyen nesne
 */
export function pgSupabase(db) {
  class Q {
    constructor(tablo) {
      this.tablo = kimlik(tablo);
      this.eylem = 'select';
      this.kolonlar = '*';
      this.kosullar = [];
      this.parametreler = [];
      this._tek = false;
      this._limit = 0;
      this._sira = '';
    }

    yer(deger) {
      this.parametreler.push(deger);
      return `$${this.parametreler.length}`;
    }

    select(kolonlar = '*') {
      this.kolonlar = kolonlar === '*'
        ? '*'
        : String(kolonlar).split(',').map((s) => kimlik(s.trim())).join(', ');
      return this;
    }

    // update() zincirin BAŞINDA çağrılır; SET parametreleri bu yüzden WHERE
    // parametrelerinden önce numaralanır ve sıralama kendiliğinden doğrudur.
    update(yama) {
      this.eylem = 'update';
      this.atamalar = Object.entries(yama).map(([k, v]) => `${kimlik(k)} = ${this.yer(v)}`);
      return this;
    }

    eq(kolon, deger) { this.kosullar.push(`${kimlik(kolon)} = ${this.yer(deger)}`); return this; }
    neq(kolon, deger) { this.kosullar.push(`${kimlik(kolon)} <> ${this.yer(deger)}`); return this; }

    is(kolon, deger) {
      this.kosullar.push(deger === null ? `${kimlik(kolon)} is null` : `${kimlik(kolon)} = ${this.yer(deger)}`);
      return this;
    }

    in(kolon, degerler) {
      const liste = (degerler || []).map((v) => this.yer(v));
      // Boş liste: PostgREST hiçbir satır döndürmez; `in ()` SQL hatası olurdu.
      this.kosullar.push(liste.length ? `${kimlik(kolon)} in (${liste.join(', ')})` : 'false');
      return this;
    }

    order(kolon, secenek = {}) {
      this._sira = ` order by ${kimlik(kolon)} ${secenek.ascending === false ? 'desc' : 'asc'}`;
      return this;
    }

    limit(n) { this._limit = Number(n) || 0; return this; }
    maybeSingle() { this._tek = true; return this; }

    nere() { return this.kosullar.length ? ` where ${this.kosullar.join(' and ')}` : ''; }

    then(coz, red) { return this.calistir().then(coz, red); }

    async calistir() {
      let sql;
      if (this.eylem === 'select') {
        sql = `select ${this.kolonlar} from public.${this.tablo}${this.nere()}${this._sira}`
          + (this._limit ? ` limit ${Number(this._limit)}` : '');
      } else if (this.eylem === 'update') {
        // Koşulsuz UPDATE bir kaza olurdu; kabuk buna izin vermez.
        if (!this.kosullar.length) throw new Error('pgSupabase: koşulsuz update reddedildi');
        sql = `update public.${this.tablo} set ${this.atamalar.join(', ')}${this.nere()}`;
      } else {
        throw new Error(`pgSupabase: desteklenmeyen eylem "${this.eylem}"`);
      }

      try {
        const satirlar = await db.q(sql, this.parametreler);
        if (this.eylem !== 'select') return { data: null, error: null, count: null };
        return {
          data: this._tek ? (satirlar[0] ?? null) : satirlar,
          error: null,
          count: satirlar.length,
        };
      } catch (e) {
        // Supabase hata biçimi: fırlatmaz, `error` döndürür.
        return { data: null, error: { message: e.message }, count: null };
      }
    }
  }

  return { from: (tablo) => new Q(tablo) };
}
