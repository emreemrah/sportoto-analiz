// DOSYA TABANLI ARŞİV DEPOSU (fallback)
// Supabase yapılandırılmamışsa kullanılır: backend/data/archive/ altında JSON.
// DEĞİŞMEZLİK bu katmanda da uygulanır: kilitli snapshot update/delete edilemez,
// snapshot dosyası 'wx' (exclusive) ile yazılır → aynı bültene ikinci snapshot
// dosya sisteminde bile oluşamaz. Not: Render free'de disk kalıcı DEĞİLDİR;
// üretim için Supabase yapılandırılmalıdır (bkz. migrations/README.md).
import {
  mkdirSync, writeFileSync, readFileSync, existsSync, renameSync,
  openSync, closeSync, writeSync, appendFileSync, readdirSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ImmutableError, AlreadyExistsError, NotFoundError } from './errors.js';

const here = dirname(fileURLToPath(import.meta.url));

export class FileArchiveStore {
  constructor(baseDir) {
    this.base = baseDir || process.env.ARCHIVE_DIR || join(here, '..', '..', 'data', 'archive');
    for (const d of ['', 'matches', 'observations', 'snapshots', 'results', 'evaluations', 'audit']) {
      mkdirSync(join(this.base, d), { recursive: true });
    }
    this._locks = new Map(); // bulletinId -> Promise (in-process freeze kilidi)
  }

  // --- yardımcılar ---------------------------------------------------------
  _p(...parts) { return join(this.base, ...parts); }

  // GÜVENLİK: Rota parametresinden gelen kimlik dosya adına dönüşmeden önce
  // süzülür — "..%2f" tarzı path traversal ile arşiv dizini dışına çıkılamaz
  // (analysisStore.js ile aynı desen).
  _safeId(id) { return String(id).replace(/[^A-Za-z0-9_-]/g, '_'); }

  _readJson(file, fallback = null) {
    if (!existsSync(file)) return fallback;
    try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; }
  }

  // Atomik yazım: tmp dosyaya yaz + rename (yarım dosya kalmaz).
  _writeJson(file, data) {
    const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, file);
  }

  // Aynı bülten için eşzamanlı kritik bölge (freeze) — sıraya sokar.
  async withLock(bulletinId, fn) {
    const prev = this._locks.get(bulletinId) || Promise.resolve();
    let release;
    const next = new Promise((res) => { release = res; });
    this._locks.set(bulletinId, prev.then(() => next));
    await prev;
    try { return await fn(); }
    finally { release(); if (this._locks.get(bulletinId) === next) this._locks.delete(bulletinId); }
  }

  // --- bulletins -----------------------------------------------------------
  async listBulletins() {
    return this._readJson(this._p('bulletins.json'), []);
  }

  async getBulletin(id) {
    const all = await this.listBulletins();
    return all.find((b) => b.id === String(id)) || null;
  }

  async upsertBulletin(row) {
    const all = await this.listBulletins();
    const idx = all.findIndex((b) => b.id === row.id);
    const now = new Date().toISOString();
    if (idx === -1) {
      all.push({ ...row, createdAt: row.createdAt || now, updatedAt: now });
    } else {
      const prev = all[idx];
      // Kilit sonrası kimlik/zaman alanları değişemez (DB trigger'ının dosya eşleniği).
      if (['locked', 'completed'].includes(prev.status)) {
        const frozenFields = ['roundId', 'firstMatchStartAt', 'freezeAt', 'lockedAt'];
        for (const f of frozenFields) {
          if (row[f] !== undefined && String(row[f]) !== String(prev[f])) {
            throw new ImmutableError(`Kilitli bültenin ${f} alanı değiştirilemez (${prev.id}).`);
          }
        }
        if (prev.status === 'locked' && ['draft', 'active'].includes(row.status)) {
          throw new ImmutableError(`Kilitli bülten geri açılamaz (${prev.id}).`);
        }
        if (prev.status === 'completed' && row.status && row.status !== 'completed') {
          throw new ImmutableError(`Tamamlanmış bültenin durumu değiştirilemez (${prev.id}).`);
        }
      }
      all[idx] = { ...prev, ...row, updatedAt: now };
    }
    this._writeJson(this._p('bulletins.json'), all);
    return this.getBulletin(row.id);
  }

  // --- bulletin_matches ----------------------------------------------------
  async getMatches(bulletinId) {
    return this._readJson(this._p('matches', `${this._safeId(bulletinId)}.json`), []);
  }

  async replaceMatches(bulletinId, matches) {
    const b = await this.getBulletin(bulletinId);
    if (b && ['locked', 'completed', 'cancelled'].includes(b.status)) {
      throw new ImmutableError(`Kilitli bültenin maç listesi değiştirilemez (${bulletinId}).`);
    }
    this._writeJson(this._p('matches', `${this._safeId(bulletinId)}.json`), matches);
    return matches;
  }

  // --- observations (JSONL — zaman serisi) ---------------------------------
  async addObservations(bulletinId, rows) {
    if (!rows?.length) return 0;
    const file = this._p('observations', `${this._safeId(bulletinId)}.jsonl`);
    appendFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    return rows.length;
  }

  async listObservations(bulletinId, matchId = null) {
    const file = this._p('observations', `${this._safeId(bulletinId)}.jsonl`);
    if (!existsSync(file)) return [];
    const rows = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
    return matchId == null ? rows : rows.filter((r) => String(r.matchId) === String(matchId));
  }

  // --- snapshots (TEK + DEĞİŞMEZ) ------------------------------------------
  async getSnapshot(bulletinId) {
    return this._readJson(this._p('snapshots', `${this._safeId(bulletinId)}.json`), null);
  }

  async createSnapshot(row) {
    const file = this._p('snapshots', `${this._safeId(row.bulletinId)}.json`);
    // 'wx' = dosya varsa HATA → dosya sisteminde bile ikinci snapshot imkânsız.
    let fd;
    try {
      fd = openSync(file, 'wx');
    } catch (e) {
      if (e.code === 'EEXIST') throw new AlreadyExistsError(`Bu bültenin resmî snapshot'ı zaten var (${row.bulletinId}).`);
      throw e;
    }
    try {
      writeSync(fd, JSON.stringify(row));
    } finally {
      closeSync(fd);
    }
    return row;
  }

  // Bilinçli olarak "değiştirme" API'si SUNULMAZ; yine de çağıran olursa reddedilir.
  async updateSnapshot(bulletinId) {
    const snap = await this.getSnapshot(bulletinId);
    if (!snap) throw new NotFoundError(`Snapshot yok (${bulletinId}).`);
    throw new ImmutableError(`Kilitli snapshot değiştirilemez (${bulletinId}).`);
  }

  async deleteSnapshot(bulletinId) {
    const snap = await this.getSnapshot(bulletinId);
    if (!snap) throw new NotFoundError(`Snapshot yok (${bulletinId}).`);
    throw new ImmutableError(`Kilitli snapshot silinemez (${bulletinId}).`);
  }

  // --- resmî sonuçlar (snapshot'tan ayrı) ----------------------------------
  async listOfficialResults(bulletinId) {
    return this._readJson(this._p('results', `${this._safeId(bulletinId)}.json`), []);
  }

  async upsertOfficialResult(row) {
    const file = this._p('results', `${this._safeId(row.bulletinId)}.json`);
    const all = this._readJson(file, []);
    const idx = all.findIndex((r) => String(r.matchId) === String(row.matchId));
    const now = new Date().toISOString();
    let saved;
    if (idx === -1) {
      saved = { ...row, confirmedAt: now, sourceUpdatedAt: now, correctionVersion: 1, corrections: [] };
      all.push(saved);
    } else {
      const prev = all[idx];
      const changed = prev.officialResult !== row.officialResult
        || prev.fullTimeScore?.home !== row.fullTimeScore?.home
        || prev.fullTimeScore?.away !== row.fullTimeScore?.away;
      if (!changed) return { row: prev, changed: false, corrected: false };
      // DÜZELTME: orijinal snapshot'a dokunulmaz; eski değer tarihçeye eklenir.
      saved = {
        ...prev,
        officialResult: row.officialResult,
        fullTimeScore: row.fullTimeScore,
        resultSource: row.resultSource || prev.resultSource,
        sourceUpdatedAt: now,
        correctionVersion: (prev.correctionVersion || 1) + 1,
        corrections: [...(prev.corrections || []), {
          at: now,
          from: { officialResult: prev.officialResult, fullTimeScore: prev.fullTimeScore },
          to: { officialResult: row.officialResult, fullTimeScore: row.fullTimeScore },
        }],
      };
      all[idx] = saved;
      this._writeJson(file, all);
      return { row: saved, changed: true, corrected: true };
    }
    this._writeJson(file, all);
    return { row: saved, changed: true, corrected: false };
  }

  // --- değerlendirmeler ----------------------------------------------------
  async getEvaluation(bulletinId) {
    return this._readJson(this._p('evaluations', `${this._safeId(bulletinId)}.json`), null);
  }

  async saveEvaluation(row) {
    this._writeJson(this._p('evaluations', `${this._safeId(row.bulletinId)}.json`), row);
    return row;
  }

  async listEvaluations() {
    try {
      return readdirSync(this._p('evaluations'))
        .filter((f) => f.endsWith('.json'))
        .map((f) => this._readJson(this._p('evaluations', f), null))
        .filter(Boolean);
    } catch { return []; }
  }

  // --- audit (append-only JSONL) -------------------------------------------
  async appendAudit(entry) {
    const bid = entry.bulletinId || '_global';
    const row = { at: new Date().toISOString(), actor: 'system', rejected: false, ...entry };
    appendFileSync(this._p('audit', `${this._safeId(bid)}.jsonl`), JSON.stringify(row) + '\n');
    return row;
  }

  async listAudit(bulletinId) {
    const file = this._p('audit', `${this._safeId(bulletinId)}.jsonl`);
    if (!existsSync(file)) return [];
    return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
  }
}
