// ANALİZ DEPOSU — profiller (sürümlü), kullanıcı analiz kayıtları, backtest.
// Supabase yapılandırılmışsa Postgres (bkz. migrations/002), değilse dosya
// deposu (backend/data/analysis/). KURALLAR:
//  * Profil düzenlemek ESKİ SÜRÜMÜ EZMEZ — yeni sürüm satırı eklenir.
//  * Kilitli (freeze sonrası) kullanıcı analizi DEĞİŞTİRİLEMEZ/SİLİNEMEZ.
import {
  mkdirSync, writeFileSync, readFileSync, existsSync, renameSync, readdirSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { supabaseEnabled, sbAdmin } from '../supabase.js';
import { ImmutableError, NotFoundError, ValidationError } from '../archive/errors.js';

const here = dirname(fileURLToPath(import.meta.url));

/* ─────────────────────────── DOSYA SÜRÜCÜSÜ ─────────────────────────── */
class FileAnalysisStore {
  constructor(baseDir) {
    this.base = baseDir || process.env.ANALYSIS_DIR || join(here, '..', '..', 'data', 'analysis');
    for (const d of ['', 'profiles', 'userAnalyses', 'backtests']) mkdirSync(join(this.base, d), { recursive: true });
  }
  _p(...x) { return join(this.base, ...x); }
  _read(f, fb = null) { if (!existsSync(f)) return fb; try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return fb; } }
  _write(f, d) { const t = `${f}.tmp-${process.pid}`; writeFileSync(t, JSON.stringify(d)); renameSync(t, f); }

  // ---- Profiller (kullanıcı bazlı; userId 'local' = girişsiz yerel senkron) ----
  _profFile(userId) { return this._p('profiles', `${String(userId).replace(/[^a-zA-Z0-9_-]/g, '_')}.json`); }

  async listProfiles(userId) {
    return this._read(this._profFile(userId), []);
  }
  async getProfile(userId, id) {
    return (await this.listProfiles(userId)).find((p) => p.id === id) || null;
  }
  async saveProfiles(userId, profiles) {
    this._write(this._profFile(userId), profiles);
    return profiles;
  }

  // ---- Kullanıcı analiz kayıtları (bülten bazlı, kilitle DONAR) ----
  _uaFile(bulletinId) { return this._p('userAnalyses', `${bulletinId}.json`); }

  async listUserAnalyses(bulletinId, userId = null) {
    const all = this._read(this._uaFile(bulletinId), []);
    return userId == null ? all : all.filter((x) => x.userId === userId);
  }
  async saveUserAnalysis(entry) {
    const all = this._read(this._uaFile(entry.bulletinId), []);
    const idx = all.findIndex((x) => x.userId === entry.userId);
    if (idx >= 0) {
      if (all[idx].locked) throw new ImmutableError('Kilitli kullanıcı analizi değiştirilemez.');
      all[idx] = entry;
    } else all.push(entry);
    this._write(this._uaFile(entry.bulletinId), all);
    return entry;
  }
  async lockUserAnalyses(bulletinId, lockedAt) {
    const all = this._read(this._uaFile(bulletinId), []);
    let n = 0;
    for (const x of all) if (!x.locked) { x.locked = true; x.lockedAt = lockedAt; n += 1; }
    if (n) this._write(this._uaFile(bulletinId), all);
    return n;
  }
  async deleteUserAnalysis(bulletinId, userId) {
    const all = this._read(this._uaFile(bulletinId), []);
    const idx = all.findIndex((x) => x.userId === userId);
    if (idx === -1) throw new NotFoundError('Kayıtlı analiz yok.');
    if (all[idx].locked) throw new ImmutableError('Kilitli kullanıcı analizi silinemez.');
    all.splice(idx, 1);
    this._write(this._uaFile(bulletinId), all);
  }

  // ---- Backtest koşuları ----
  async saveBacktest(run) { this._write(this._p('backtests', `${run.runId}.json`), run); return run; }
  async getBacktest(runId) { return this._read(this._p('backtests', `${String(runId).replace(/[^a-zA-Z0-9_-]/g, '_')}.json`), null); }
  async listBacktests() {
    try {
      return readdirSync(this._p('backtests')).filter((f) => f.endsWith('.json'))
        .map((f) => this._read(this._p('backtests', f), null)).filter(Boolean);
    } catch { return []; }
  }
}

/* ─────────────────────────── SUPABASE SÜRÜCÜSÜ ─────────────────────────── */
class SupabaseAnalysisStore {
  constructor(client = sbAdmin) { this.sb = client; }

  async listProfiles(userId) {
    const { data, error } = await this.sb.from('analysis_profiles').select('*').eq('user_id', String(userId));
    if (error) throw new Error(`profiller okunamadı: ${error.message}`);
    return (data || []).map((r) => r.payload);
  }
  async getProfile(userId, id) {
    return (await this.listProfiles(userId)).find((p) => p.id === id) || null;
  }
  async saveProfiles(userId, profiles) {
    const { error: delErr } = await this.sb.from('analysis_profiles').delete().eq('user_id', String(userId));
    if (delErr) throw new Error(`profiller yazılamadı: ${delErr.message}`);
    if (profiles.length) {
      const rows = profiles.map((p) => ({ id: p.id, user_id: String(userId), name: p.name, current_version: p.currentVersion, is_default: !!p.isDefault, payload: p }));
      const { error } = await this.sb.from('analysis_profiles').insert(rows);
      if (error) throw new Error(`profiller yazılamadı: ${error.message}`);
    }
    return profiles;
  }

  async listUserAnalyses(bulletinId, userId = null) {
    let q = this.sb.from('user_analysis_snapshots').select('*').eq('bulletin_id', String(bulletinId));
    if (userId != null) q = q.eq('user_id', String(userId));
    const { data, error } = await q;
    if (error) throw new Error(`kullanıcı analizleri okunamadı: ${error.message}`);
    return (data || []).map((r) => r.payload);
  }
  async saveUserAnalysis(entry) {
    const existing = (await this.listUserAnalyses(entry.bulletinId, entry.userId))[0] || null;
    if (existing?.locked) throw new ImmutableError('Kilitli kullanıcı analizi değiştirilemez.');
    const row = { bulletin_id: String(entry.bulletinId), user_id: String(entry.userId), locked: !!entry.locked, locked_at: entry.lockedAt || null, payload: entry };
    const { error } = await this.sb.from('user_analysis_snapshots').upsert(row, { onConflict: 'bulletin_id,user_id' });
    if (error) throw (/(LOCKED_USER_ANALYSIS)/.test(error.message) ? new ImmutableError(error.message) : new Error(`kullanıcı analizi yazılamadı: ${error.message}`));
    return entry;
  }
  async lockUserAnalyses(bulletinId, lockedAt) {
    const all = await this.listUserAnalyses(bulletinId);
    let n = 0;
    for (const x of all) {
      if (x.locked) continue;
      x.locked = true; x.lockedAt = lockedAt;
      const { error } = await this.sb.from('user_analysis_snapshots')
        .update({ locked: true, locked_at: lockedAt, payload: x })
        .eq('bulletin_id', String(bulletinId)).eq('user_id', String(x.userId)).eq('locked', false);
      if (!error) n += 1;
    }
    return n;
  }
  async deleteUserAnalysis(bulletinId, userId) {
    const existing = (await this.listUserAnalyses(bulletinId, userId))[0] || null;
    if (!existing) throw new NotFoundError('Kayıtlı analiz yok.');
    if (existing.locked) throw new ImmutableError('Kilitli kullanıcı analizi silinemez.');
    const { error } = await this.sb.from('user_analysis_snapshots').delete()
      .eq('bulletin_id', String(bulletinId)).eq('user_id', String(userId));
    if (error) throw new Error(`analiz silinemedi: ${error.message}`);
  }

  async saveBacktest(run) {
    const { error } = await this.sb.from('backtest_runs').upsert({ run_id: run.runId, requested_at: run.requestedAt, status: run.status, payload: run }, { onConflict: 'run_id' });
    if (error) throw new Error(`backtest yazılamadı: ${error.message}`);
    return run;
  }
  async getBacktest(runId) {
    const { data, error } = await this.sb.from('backtest_runs').select('*').eq('run_id', String(runId)).maybeSingle();
    if (error) throw new Error(`backtest okunamadı: ${error.message}`);
    return data?.payload || null;
  }
  async listBacktests() {
    const { data, error } = await this.sb.from('backtest_runs').select('*');
    if (error) return [];
    return (data || []).map((r) => r.payload);
  }
}

let _store = null;
export function getAnalysisStore() {
  if (_store) return _store;
  const pref = (process.env.ANALYSIS_DRIVER || '').toLowerCase();
  _store = (pref === 'file' || (!supabaseEnabled && pref !== 'supabase'))
    ? new FileAnalysisStore()
    : new SupabaseAnalysisStore();
  return _store;
}
export function _resetAnalysisStoreForTests() { _store = null; }
export { FileAnalysisStore, SupabaseAnalysisStore };

/* ─────────────── PROFİL SÜRÜMLEME (sürücüden bağımsız kurallar) ─────────────── */
// Profil biçimi: { id, name, isDefault, currentVersion, mode, globalFilters,
//   criteria, versions: [{version, name, mode, globalFilters, criteria, createdAt}],
//   createdAt, updatedAt }
export function newProfile({ name, criteria = {}, mode = 'manual', globalFilters = null, isDefault = false }, now = new Date().toISOString()) {
  if (!name || !String(name).trim()) throw new ValidationError('Profil adı gerekli.');
  const v1 = { version: 1, name: String(name).trim(), mode, globalFilters: globalFilters || null, criteria, createdAt: now };
  return {
    id: `prof-${randomUUID().slice(0, 8)}`,
    name: v1.name, isDefault: !!isDefault,
    currentVersion: 1, mode, globalFilters: v1.globalFilters, criteria,
    versions: [v1], createdAt: now, updatedAt: now,
  };
}

// GÜNCELLEME = YENİ SÜRÜM (eski sürüm asla ezilmez; mühürlü analizler eski
// profileVersion ile değişmeden kalır).
export function updateProfileVersion(profile, { name, criteria, mode, globalFilters }, now = new Date().toISOString()) {
  const next = {
    version: profile.currentVersion + 1,
    name: name != null ? String(name).trim() : profile.name,
    mode: mode || profile.mode,
    globalFilters: globalFilters !== undefined ? globalFilters : profile.globalFilters,
    criteria: criteria !== undefined ? criteria : profile.criteria,
    createdAt: now,
  };
  return {
    ...profile,
    name: next.name, mode: next.mode, globalFilters: next.globalFilters, criteria: next.criteria,
    currentVersion: next.version,
    versions: [...profile.versions, next],           // append-only
    updatedAt: now,
  };
}

export function duplicateProfile(profile, newName, now = new Date().toISOString()) {
  const copy = newProfile({
    name: newName || `${profile.name} (kopya)`,
    criteria: JSON.parse(JSON.stringify(profile.criteria || {})),
    mode: profile.mode, globalFilters: profile.globalFilters ? { ...profile.globalFilters } : null,
  }, now);
  return copy;
}
