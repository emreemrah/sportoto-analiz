// SAHTE SUPABASE — bellek içi, deterministik; ağ yok.
// sessionService / gamification testlerinin kullandığı sorgu yollarını taklit
// eder: select/insert/upsert/update + eq/neq/is/in/order/limit/maybeSingle,
// count:'exact' + head, onConflict + ignoreDuplicates (unique kısıt davranışı).
export function makeFakeSb({ missing = [] } = {}) {
  const tables = new Map();
  const missingSet = new Set(missing);
  let seq = 0;
  const genId = () => `fake-${++seq}`;
  const rowsOf = (n) => { if (!tables.has(n)) tables.set(n, []); return tables.get(n); };

  const match = (row, f) => {
    if (f.op === 'eq') return String(row[f.col]) === String(f.val);
    if (f.op === 'neq') return String(row[f.col]) !== String(f.val);
    if (f.op === 'is') return f.val === null ? row[f.col] == null : row[f.col] === f.val;
    if (f.op === 'in') return f.val.map(String).includes(String(row[f.col]));
    return false;
  };

  class Q {
    constructor(name) {
      this.name = name; this.filters = []; this.action = 'select';
      this.head = false; this._single = false; this.wantRows = false; this._limit = 0;
    }
    select(_cols, opts = {}) { this.head = !!opts.head; this.wantRows = true; return this; }
    eq(col, val) { this.filters.push({ op: 'eq', col, val }); return this; }
    neq(col, val) { this.filters.push({ op: 'neq', col, val }); return this; }
    is(col, val) { this.filters.push({ op: 'is', col, val }); return this; }
    in(col, val) { this.filters.push({ op: 'in', col, val }); return this; }
    order() { return this; }
    limit(n) { this._limit = n; return this; }
    maybeSingle() { this._single = true; return this; }
    insert(row) { this.action = 'insert'; this.payload = Array.isArray(row) ? row : [row]; return this; }
    upsert(row, opts = {}) { this.action = 'upsert'; this.payload = Array.isArray(row) ? row : [row]; this.opts = opts; return this; }
    update(patch) { this.action = 'update'; this.patch = patch; return this; }
    delete() { this.action = 'delete'; return this; }
    then(res, rej) { return Promise.resolve(this._exec()).then(res, rej); }
    _ret(list) {
      const data = this._single ? (list[0] ?? null) : (this.wantRows ? list : null);
      return { data, error: null, count: null };
    }
    _exec() {
      if (missingSet.has(this.name)) {
        return { data: null, count: null, error: { message: `relation "public.${this.name}" does not exist` } };
      }
      const rows = rowsOf(this.name);
      if (this.action === 'select') {
        let out = rows.filter((r) => this.filters.every((f) => match(r, f)));
        if (this._limit) out = out.slice(0, this._limit);
        if (this.head) return { data: null, error: null, count: out.length };
        return { data: this._single ? (out[0] ?? null) : out, error: null, count: out.length };
      }
      if (this.action === 'insert') {
        const ins = this.payload.map((r) => ({ id: genId(), ...r }));
        rows.push(...ins);
        return this._ret(ins);
      }
      if (this.action === 'upsert') {
        const cols = String(this.opts?.onConflict || '').split(',').map((s) => s.trim()).filter(Boolean);
        const touched = [];
        for (const r of this.payload) {
          const hit = cols.length ? rows.find((x) => cols.every((c) => String(x[c]) === String(r[c]))) : null;
          if (hit) {
            if (this.opts?.ignoreDuplicates) continue;  // unique kısıt: sessizce atla
            Object.assign(hit, r); touched.push(hit);
          } else {
            const nr = { ...('id' in r ? {} : { id: genId() }), ...r };
            rows.push(nr); touched.push(nr);
          }
        }
        return this._ret(touched);
      }
      if (this.action === 'update') {
        const out = [];
        for (const r of rows) {
          if (this.filters.every((f) => match(r, f))) { Object.assign(r, this.patch); out.push(r); }
        }
        return this._ret(out);
      }
      if (this.action === 'delete') {
        const keep = rows.filter((r) => !this.filters.every((f) => match(r, f)));
        const removed = rows.length - keep.length;
        tables.set(this.name, keep);
        return { data: null, error: null, count: removed };
      }
      return { data: null, error: { message: 'desteklenmeyen işlem' } };
    }
  }

  return { from: (n) => new Q(n), _tables: tables, _rowsOf: rowsOf };
}
