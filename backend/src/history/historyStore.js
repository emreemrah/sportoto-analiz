// RESMÎ SPOR TOTO GEÇMİŞ BÜLTEN HAFIZASI — kalıcı depo (dosya + Supabase).
// ---------------------------------------------------------------------------
// Provenance: 'official_result_history' — YALNIZ resmî 90 dk sonuç arşivi.
// * Geçmişe tahmin/radar/kriter sinyali ÜRETMEZ; ileri-test karnelerine GİREMEZ.
// * bulletin_snapshots'a YAZMAZ — ayrı, doğru provenance'lı tablolar/dosyalar.
// * Idempotent upsert: aynı sezon/hafta/sıra ikinci kez EKLENMEZ; kaynak
//   düzeltmesi gelirse eski değer SESSİZCE EZİLMEZ → correctionVersion + audit.
// * Tüm zamanlar UTC; ekran çevirisi frontend'te (Europe/Istanbul).
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sbAdmin } from '../supabase.js';
import { tumSatirlar } from '../db/sayfala.js';

const here = dirname(fileURLToPath(import.meta.url));

export const HISTORY_PROVENANCE = 'official_result_history';

// ---------------------------------------------------------------------------
// DOSYA SÜRÜCÜSÜ (geliştirme + Supabase yapılandırılmamışsa fallback)
// ---------------------------------------------------------------------------
class FileHistoryStore {
  constructor(base = process.env.HISTORY_DIR || join(here, '..', '..', 'data', 'history')) {
    this.base = base;
    mkdirSync(join(base, 'matches'), { recursive: true });
  }
  _p(...x) { return join(this.base, ...x); }
  _read(f, fb) { try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : fb; } catch { return fb; } }
  _write(f, data) {
    const tmp = `${f}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, f);
  }

  async listRounds() { return this._read(this._p('rounds.json'), []); }
  async getRound(roundId) { return (await this.listRounds()).find((r) => String(r.roundId) === String(roundId)) || null; }
  async upsertRound(row) {
    const all = await this.listRounds();
    const i = all.findIndex((r) => String(r.roundId) === String(row.roundId));
    if (i === -1) all.push(row); else all[i] = { ...all[i], ...row };
    this._write(this._p('rounds.json'), all);
    return row;
  }

  async getMatches(roundId) { return this._read(this._p('matches', `${roundId}.json`), []); }
  async putMatches(roundId, matches) { this._write(this._p('matches', `${roundId}.json`), matches); }

  // Tüm tamamlanmış maçlar (öğrenme sınırı filtresi çağırana ait).
  async listAllMatches() {
    const out = [];
    for (const r of await this.listRounds()) {
      if (r.status !== 'completed') continue;
      const ms = await this.getMatches(r.roundId);
      for (const m of ms) out.push({ ...m, roundId: r.roundId, seasonYear: r.seasonYear, roundCloseAt: r.roundCloseAt });
    }
    return out;
  }

  async appendAudit(entry) {
    const all = this._read(this._p('audit.json'), []);
    all.push({ ...entry, at: entry.at || new Date().toISOString() });
    this._write(this._p('audit.json'), all.slice(-2000));
  }
  async listAudit() { return this._read(this._p('audit.json'), []); }

  async getCheckpoint() { return this._read(this._p('checkpoint.json'), null); }
  async setCheckpoint(cp) { this._write(this._p('checkpoint.json'), { ...cp, updatedAt: new Date().toISOString() }); }
}

// ---------------------------------------------------------------------------
// SUPABASE SÜRÜCÜSÜ (üretim — migration 005 tabloları)
// ---------------------------------------------------------------------------
// export: sayfalama davranışı sahte bir istemciyle sınanabilsin diye
// (bkz. test/gecmis-sayfalama.test.mjs). Üretimde getHistoryStore() kullanılır.
export class SupabaseHistoryStore {
  constructor(client = sbAdmin) {
    if (!client) throw new Error('Supabase yapılandırılmamış.');
    this.sb = client;
  }
  async listRounds() {
    // Sayfalanır: haftalar birikiyor (sezonda ~52) ve 1000 sınırına çarptığı
    // gün sessizce eksik dönerdi. round_close_at eşit olabilir; round_id ile
    // bitirmek sırayı benzersiz ve kararlı yapar.
    const data = await tumSatirlar(() => this.sb
      .from('sportoto_history_rounds').select('*').order('round_close_at').order('round_id'));
    return data.map(rowToRound);
  }
  async getRound(roundId) {
    const { data, error } = await this.sb.from('sportoto_history_rounds').select('*').eq('round_id', String(roundId)).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToRound(data) : null;
  }
  async upsertRound(r) {
    const { error } = await this.sb.from('sportoto_history_rounds').upsert({
      round_id: String(r.roundId), season_year: r.seasonYear, week_name: r.weekName,
      status: r.status, round_close_at: r.roundCloseAt, match_count: r.matchCount,
      source_url: r.sourceUrl, source_type: r.sourceType, source_hash: r.sourceHash,
      fetched_at: r.fetchedAt, observed_at: r.observedAt, provenance_type: HISTORY_PROVENANCE,
      correction_version: r.correctionVersion ?? 1,
    }, { onConflict: 'round_id' });
    if (error) throw new Error(error.message);
    return r;
  }
  async getMatches(roundId) {
    const { data, error } = await this.sb.from('sportoto_history_matches').select('*').eq('round_id', String(roundId)).order('position');
    if (error) throw new Error(error.message);
    return (data || []).map(rowToMatch);
  }
  async putMatches(roundId, matches) {
    const rows = matches.map((m) => ({
      round_id: String(roundId), position: m.position, home_team: m.homeTeam, away_team: m.awayTeam,
      match_at: m.matchAt, score_home: m.scoreHome, score_away: m.scoreAway,
      result: m.result, result_valid: m.resultValid, conflict: m.conflict ?? null,
      source_hash: m.sourceHash, observed_at: m.observedAt, fetched_at: m.fetchedAt,
      provenance_type: HISTORY_PROVENANCE, correction_version: m.correctionVersion ?? 1,
    }));
    const { error } = await this.sb.from('sportoto_history_matches').upsert(rows, { onConflict: 'round_id,position' });
    if (error) throw new Error(error.message);
  }
  // TÜM GEÇMİŞ MAÇLAR — SAYFALANARAK okunur.
  //
  // NEDEN: PostgREST tek istekte en çok db-max-rows satır döndürür (Supabase
  // varsayılanı 1000) ve bunu SESSİZCE yapar — hata yok, uyarı yok, yalnız
  // eksik veri. Bir bültende 15 maç olduğuna göre bu, arşivin ilk ~66 haftası
  // demektir. Radar 5 sıra yüzdeleri bu eksik kümeden hesaplanıyordu:
  // "2025/2026 · 44 hafta" görünüyordu, oysa o sezonda 52 hafta oynanmıştı.
  //
  // Üstelik .order() olmadan hangi 1000 satırın döneceği garanti bile değil
  // (fiziksel sıra) — yani eksik olan "en eski haftalar" olmayabilir.
  // round_id + position ile sıralayıp sayfa sayfa okuyoruz; sıra kararlı
  // olmadan sayfalama satır atlar ya da tekrar eder.
  async listAllMatches() {
    const hepsi = await tumSatirlar(() => this.sb
      .from('sportoto_history_matches')
      .select('*, sportoto_history_rounds!inner(round_id,season_year,status,round_close_at)')
      .eq('sportoto_history_rounds.status', 'completed')
      .order('round_id').order('position'));   // (round_id, position) benzersiz → kararlı sıra
    return hepsi.map((row) => ({
      ...rowToMatch(row), roundId: row.round_id,
      seasonYear: row.sportoto_history_rounds?.season_year ?? null,
      roundCloseAt: row.sportoto_history_rounds?.round_close_at ?? null,
    }));
  }
  async appendAudit(e) {
    const { error } = await this.sb.from('sportoto_history_audit').insert({
      round_id: e.roundId != null ? String(e.roundId) : null, position: e.position ?? null,
      action: e.action, field: e.field ?? null, old_value: e.oldValue ?? null, new_value: e.newValue ?? null,
      source_url: e.sourceUrl ?? null, at: e.at || new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }
  async listAudit() {
    // Denetim kaydı her düzeltmede büyür — kırpılırsa "hangi sonuç ne zaman
    // düzeltildi" izi eksik görünür. Aynı 'at' değerleri olabildiği için
    // sıralama id ile bitirilir.
    return tumSatirlar(() => this.sb
      .from('sportoto_history_audit').select('*').order('at').order('id'));
  }
  async getCheckpoint() {
    const { data, error } = await this.sb.from('sportoto_history_checkpoint').select('*').eq('id', 'main').maybeSingle();
    if (error) throw new Error(error.message);
    return data?.state ?? null;
  }
  async setCheckpoint(cp) {
    const { error } = await this.sb.from('sportoto_history_checkpoint')
      .upsert({ id: 'main', state: cp, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) throw new Error(error.message);
  }
}

const rowToRound = (d) => ({
  roundId: d.round_id, seasonYear: d.season_year, weekName: d.week_name, status: d.status,
  roundCloseAt: d.round_close_at, matchCount: d.match_count, sourceUrl: d.source_url,
  sourceType: d.source_type, sourceHash: d.source_hash, fetchedAt: d.fetched_at,
  observedAt: d.observed_at, correctionVersion: d.correction_version,
});
const rowToMatch = (d) => ({
  position: d.position, homeTeam: d.home_team, awayTeam: d.away_team, matchAt: d.match_at,
  scoreHome: d.score_home, scoreAway: d.score_away, result: d.result, resultValid: d.result_valid,
  conflict: d.conflict, sourceHash: d.source_hash, observedAt: d.observed_at, fetchedAt: d.fetched_at,
  correctionVersion: d.correction_version,
});

// ---------------------------------------------------------------------------
// DAYANIKLI SARMALAYICI — Supabase'te 005 migration'ı HENÜZ uygulanmamışsa
// (tablo yok hatası) süreç ömrü boyunca dosya sürücüsüne düşer; arşivleme
// migration beklemeden başlar. Migration uygulandıktan sonraki yeniden
// başlatmada Supabase kullanılır ve idempotent içe aktarım kaynaktan
// checkpoint'le yeniden dolar (çift kayıt/karışma riski yok — upsert + unique).
// ---------------------------------------------------------------------------
const MISSING_TABLE_RE = /does not exist|schema cache|PGRST205|42P01/i;

class ResilientHistoryStore {
  constructor(primary, fallbackFactory, log = console.warn) {
    this.primary = primary;
    this.fallbackFactory = fallbackFactory;
    this.active = primary;
    this.fellBack = false;
    this.log = log;
  }
  async _call(method, args) {
    try {
      return await this.active[method](...args);
    } catch (e) {
      if (!this.fellBack && this.active === this.primary && MISSING_TABLE_RE.test(e?.message || '')) {
        this.fellBack = true;
        this.active = this.fallbackFactory();
        this.log('[history] Supabase 005 migration tabloları bulunamadı — geçici DOSYA arşivi kullanılıyor. '
          + 'migrations/005_history_dna.sql uygulandıktan sonraki yeniden başlatmada Supabase\'e geçilir.');
        return this.active[method](...args);
      }
      throw e;
    }
  }
}
for (const m of ['listRounds', 'getRound', 'upsertRound', 'getMatches', 'putMatches', 'listAllMatches', 'appendAudit', 'listAudit', 'getCheckpoint', 'setCheckpoint']) {
  ResilientHistoryStore.prototype[m] = function (...args) { return this._call(m, args); };
}

let _store = null;
export function getHistoryStore() {
  if (_store) return _store;
  const driver = (process.env.HISTORY_DRIVER || '').toLowerCase();
  if (driver === 'file') _store = new FileHistoryStore();
  else if (driver === 'supabase') _store = new SupabaseHistoryStore();
  else if (sbAdmin) _store = new ResilientHistoryStore(new SupabaseHistoryStore(), () => new FileHistoryStore());
  else _store = new FileHistoryStore();
  return _store;
}
export function _resetHistoryStoreForTests() { _store = null; }
export { FileHistoryStore, ResilientHistoryStore };
