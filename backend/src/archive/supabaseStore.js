// SUPABASE (PostgreSQL) ARŞİV DEPOSU — üretim sürücüsü.
// Şema: backend/migrations/001_bulletin_archive.sql. DEĞİŞMEZLİK iki katmanlıdır:
//  1) DB trigger'ları (kilitli snapshot UPDATE/DELETE → hata, kilitli maç kimliği → hata)
//  2) Bu katman zaten update/delete İSTEMEZ; yine de çağrılırsa reddeder.
// Not: Tablolara yalnız service-role (SUPABASE_SECRET_KEY) istemcisi erişir (RLS).
import { sbAdmin } from '../supabase.js';
import { ImmutableError, AlreadyExistsError, NotFoundError } from './errors.js';
import { tumSatirlar } from '../db/sayfala.js';

const toIso = (v) => (v == null ? null : new Date(v).toISOString());

// 005 migration'ın oynanma semantiği kolonları henüz yoksa Supabase'in verdiği
// "kolon bulunamadı" imzaları (PostgREST şema cache + PostgreSQL 42703).
const MISSING_COLUMN_RE = /column .* does not exist|could not find the .* column|PGRST204|42703|schema cache/i;

// snake_case satır <-> camelCase model dönüştürücüleri
function bulletinFromRow(r) {
  if (!r) return null;
  return {
    id: r.id, roundId: Number(r.round_id), season: r.season, week: r.week_name,
    status: r.status, firstMatchStartAt: r.first_match_start_at, freezeAt: r.freeze_at,
    lockedAt: r.locked_at, completedAt: r.completed_at, cancelledAt: r.cancelled_at,
    closeDate: r.close_date, officialSignature: r.official_signature,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function snapshotFromRow(r) {
  if (!r) return null;
  return {
    id: r.id, bulletinId: r.bulletin_id, schemaVersion: r.schema_version,
    engineVersion: r.engine_version, sourceVersions: r.source_versions,
    createdAt: r.created_at, lockedAt: r.locked_at, dataObservedAt: r.data_observed_at,
    late: r.late, immutable: r.immutable, payload: r.snapshot_payload,
    payloadHash: r.payload_hash, hashAlgo: r.hash_algo,
  };
}

// ---------------------------------------------------------------------------
// SAYFALAMA — SESSİZ VERİ KAYBINA KARŞI.
// PostgREST tek istekte varsayılan olarak EN ÇOK 1000 satır döndürür ve bunu
// hata olarak bildirmez. Zaman serisi tabloları (gözlem, audit) bir hafta
// içinde bu sınırı aşar; sayfalama yapılmazsa yalnız EN ESKİ 1000 satır okunur
// ve o andan sonraki her yeni kayıt OKUYUCUYA GÖRÜNMEZ olur:
//   * Radar 3/4 ekranda "dün akşamdan beri hiç değişmemiş" gibi görünür,
//   * gözlem döngüsündeki "değişti mi?" kontrolü boş listeyle çalışıp her turda
//     yeni satır yazar (tekrar kaydı şişer).
// Bu yüzden liste okumaları TÜM SAYFALARI sırayla çeker.
const PAGE_SIZE = 1000;
const MAX_PAGES = 500;                  // 500k satır — sonsuz döngüye karşı emniyet

async function fetchAllPages(makeQuery, ctx) {
  const out = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await makeQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throwDb(error, ctx);
    const batch = data || [];
    out.push(...batch);
    if (batch.length < PAGE_SIZE) return out;
  }
  console.warn(`[arsiv] ${ctx}: sayfa sınırına ulaşıldı (${MAX_PAGES * PAGE_SIZE} satır).`);
  return out;
}

function throwDb(error, ctx) {
  const msg = `${ctx}: ${error.message}`;
  if (/IMMUTABLE_SNAPSHOT|LOCKED_BULLETIN|AUDIT_APPEND_ONLY/.test(error.message)) {
    throw new ImmutableError(msg);
  }
  if (error.code === '23505') throw new AlreadyExistsError(msg); // unique violation
  throw new Error(msg);
}

export class SupabaseArchiveStore {
  constructor(client = sbAdmin) {
    if (!client) throw new Error('Supabase yapılandırılmamış (SUPABASE_URL/SECRET_KEY).');
    this.sb = client;
  }

  async withLock(_bulletinId, fn) {
    // Eşzamanlılık güvencesi DB unique index'inden gelir (createSnapshot 23505 →
    // AlreadyExists). Ek süreç-içi kilit gerekmez.
    return fn();
  }

  // --- bulletins -----------------------------------------------------------
  async listBulletins() {
    // Sayfalanir: bultenler sezonda ~52 birikiyor. 1000 sinirina carpinca
    // PostgREST hata vermez, yalniz eksik doner (bkz. db/sayfala.js).
    // round_id benzersizdir -> sira kararli.
    const data = await tumSatirlar(() => this.sb
      .from('bulletins').select('*').order('round_id', { ascending: false }));
    return data.map(bulletinFromRow);
  }

  async getBulletin(id) {
    const { data, error } = await this.sb.from('bulletins').select('*').eq('id', String(id)).maybeSingle();
    if (error) throwDb(error, 'bulletin okunamadı');
    return bulletinFromRow(data);
  }

  async upsertBulletin(row) {
    // KISMİ upsert: yalnız row'da GERÇEKTEN verilen alanlar yazılır — verilmeyen
    // alanlar mevcut değerini korur (aksi halde upsert kolonları null'lardı).
    const payload = { id: row.id, round_id: row.roundId };
    const setIf = (col, val, map = (x) => x) => { if (val !== undefined) payload[col] = map(val); };
    setIf('season', row.season);
    setIf('week_name', row.week);
    setIf('status', row.status);
    setIf('first_match_start_at', row.firstMatchStartAt, toIso);
    setIf('freeze_at', row.freezeAt, toIso);
    setIf('locked_at', row.lockedAt, toIso);
    setIf('completed_at', row.completedAt, toIso);
    setIf('cancelled_at', row.cancelledAt, toIso);
    setIf('close_date', row.closeDate, toIso);
    setIf('official_signature', row.officialSignature);

    const existing = await this.getBulletin(row.id);
    if (!existing) {
      const { data, error } = await this.sb.from('bulletins').insert(payload).select('*').maybeSingle();
      if (error) throwDb(error, 'bulletin yazılamadı');
      return bulletinFromRow(data);
    }
    const { id, round_id, ...updates } = payload;
    if (!Object.keys(updates).length) return existing;
    const { data, error } = await this.sb.from('bulletins').update(updates).eq('id', row.id).select('*').maybeSingle();
    if (error) throwDb(error, 'bulletin güncellenemedi');
    return bulletinFromRow(data);
  }

  // --- bulletin_matches ----------------------------------------------------
  async getMatches(bulletinId) {
    const { data, error } = await this.sb.from('bulletin_matches')
      .select('*').eq('bulletin_id', String(bulletinId)).order('order_no');
    if (error) throwDb(error, 'maçlar okunamadı');
    return (data || []).map((r) => ({
      bulletinId: r.bulletin_id, matchId: r.match_id, orderNo: r.order_no,
      homeName: r.home_name, awayName: r.away_name, league: r.league,
      kickoffAt: r.kickoff_at, externalIds: r.external_ids, preMatchIdentity: r.pre_match_identity,
    }));
  }

  async replaceMatches(bulletinId, matches) {
    const b = await this.getBulletin(bulletinId);
    if (b && ['locked', 'completed', 'cancelled'].includes(b.status)) {
      throw new ImmutableError(`Kilitli bültenin maç listesi değiştirilemez (${bulletinId}).`);
    }
    const rows = matches.map((m) => ({
      bulletin_id: String(bulletinId), match_id: String(m.matchId), order_no: m.orderNo,
      home_name: m.homeName, away_name: m.awayName, league: m.league ?? null,
      kickoff_at: toIso(m.kickoffAt), external_ids: m.externalIds || {}, pre_match_identity: m.preMatchIdentity || {},
    }));
    const { error: delErr } = await this.sb.from('bulletin_matches').delete().eq('bulletin_id', String(bulletinId));
    if (delErr) throwDb(delErr, 'maç listesi güncellenemedi');
    if (rows.length) {
      const { error } = await this.sb.from('bulletin_matches').insert(rows);
      if (error) throwDb(error, 'maç listesi yazılamadı');
    }
    return matches;
  }

  // --- observations --------------------------------------------------------
  // DAYANIKLILIK: 005 migration'ın oynanma semantiği kolonları (kind /
  // usable_for_prediction / first_observed_late) HENÜZ uygulanmamışsa Supabase
  // "column not found" (PGRST204/42703) döndürür. Bu durumda semantik alanlar
  // zaten raw JSON içinde taşındığından, o kolonlar DÜŞÜRÜLÜP tekrar yazılır —
  // gözlem akışı migration'ı BEKLEMEZ (veri kaybı yok, okuma raw'a geri düşer).
  async addObservations(bulletinId, rows) {
    if (!rows?.length) return 0;
    const base = rows.map((r) => ({
      bulletin_id: String(bulletinId), match_id: String(r.matchId), source: r.source,
      observed_at: toIso(r.observedAt) || new Date().toISOString(),
      played_pct: r.playedPct ?? null, odds: r.odds ?? null,
      stats_summary: r.statsSummary ?? null, data_quality: r.dataQuality ?? null,
      raw: r.raw ?? null,
    }));
    const withSemantics = base.map((row, i) => ({
      ...row,
      kind: rows[i].kind ?? null,
      usable_for_prediction: rows[i].usableForPrediction ?? null,
      first_observed_late: rows[i].firstObservedLate ?? null,
    }));
    let { error } = await this.sb.from('bulletin_data_observations').insert(withSemantics);
    if (error && MISSING_COLUMN_RE.test(error.message || '')) {
      // 005 öncesi şema → semantik kolonlar olmadan yaz (raw yeterli).
      ({ error } = await this.sb.from('bulletin_data_observations').insert(base));
    }
    if (error) throwDb(error, 'gözlem yazılamadı');
    return rows.length;
  }

  async listObservations(bulletinId, matchId = null) {
    // Sıralamada 'id' İKİNCİL anahtardır: aynı saniyede yazılan onlarca gözlem
    // var (15 maç x sağlayıcı). Tek anahtarla sayfalama satır atlayabilir/
    // tekrarlayabilir; id ile sıra kesin ve sayfalar tutarlı olur.
    const data = await fetchAllPages(() => {
      let q = this.sb.from('bulletin_data_observations').select('*')
        .eq('bulletin_id', String(bulletinId)).order('observed_at').order('id');
      if (matchId != null) q = q.eq('match_id', String(matchId));
      return q;
    }, 'gözlemler okunamadı');
    return (data || []).map((r) => ({
      bulletinId: r.bulletin_id, matchId: r.match_id, source: r.source, observedAt: r.observed_at,
      playedPct: r.played_pct, odds: r.odds, statsSummary: r.stats_summary,
      dataQuality: r.data_quality, raw: r.raw,
      kind: r.kind ?? r.raw?.kind ?? null,
      usableForPrediction: r.usable_for_prediction ?? r.raw?.usableForPrediction ?? null,
      firstObservedLate: r.first_observed_late ?? r.raw?.firstObservedLate ?? null,
      // Ölçülmüş gecikmenin kanıt mührü; kolonu yok, raw'da taşınır.
      openingEvidence: r.raw?.openingEvidence ?? null,
    }));
  }

  // --- snapshots -----------------------------------------------------------
  async getSnapshot(bulletinId) {
    const { data, error } = await this.sb.from('bulletin_snapshots')
      .select('*').eq('bulletin_id', String(bulletinId)).maybeSingle();
    if (error) throwDb(error, 'snapshot okunamadı');
    return snapshotFromRow(data);
  }

  async createSnapshot(row) {
    const payload = {
      id: row.id, bulletin_id: row.bulletinId, schema_version: row.schemaVersion,
      engine_version: row.engineVersion, source_versions: row.sourceVersions || {},
      created_at: toIso(row.createdAt) || new Date().toISOString(),
      locked_at: toIso(row.lockedAt), data_observed_at: toIso(row.dataObservedAt),
      late: !!row.late, immutable: row.immutable !== false,
      snapshot_payload: row.payload, payload_hash: row.payloadHash, hash_algo: row.hashAlgo,
    };
    const { data, error } = await this.sb.from('bulletin_snapshots').insert(payload).select('*').maybeSingle();
    if (error) throwDb(error, 'snapshot oluşturulamadı');
    return snapshotFromRow(data);
  }

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

  // --- resmî sonuçlar ------------------------------------------------------
  async listOfficialResults(bulletinId) {
    const { data, error } = await this.sb.from('match_official_results')
      .select('*').eq('bulletin_id', String(bulletinId)).order('order_no');
    if (error) throwDb(error, 'sonuçlar okunamadı');
    return (data || []).map((r) => ({
      bulletinId: r.bulletin_id, matchId: r.match_id, orderNo: r.order_no,
      officialResult: r.official_result,
      // NOTER KAYDINDA SKOR YOKTUR. Şemadaki NOT NULL kısıtı yüzünden noter
      // satırı {home:null, away:null} olarak durur; okuyana NULL normalize
      // edilir ki dosya deposuyla AYNI şekil dönsün (012 göçü uygulanırsa
      // gerçek NULL yazılabilir, bu normalizasyon yine doğru kalır).
      fullTimeScore: (r.full_time_score
        && (r.full_time_score.home != null || r.full_time_score.away != null))
        ? r.full_time_score : null,
      // NULL = normal sonuç · 'notary_decision' = ertelenen maçın noter kararı.
      // result_type kolonu 012 göçüne kadar YOK olabilir; o durumda kimlik
      // kaynak sabitinden türetilir (öncelik her zaman kolonda).
      resultType: r.result_type
        ?? (r.result_source === 'Noter kararı' ? 'notary_decision' : null),
      resultSource: r.result_source, confirmedAt: r.confirmed_at,
      sourceUpdatedAt: r.source_updated_at, correctionVersion: r.correction_version,
      corrections: r.corrections || [],
    }));
  }

  async upsertOfficialResult(row) {
    const existing = (await this.listOfficialResults(row.bulletinId))
      .find((r) => String(r.matchId) === String(row.matchId));
    const now = new Date().toISOString();
    if (!existing) {
      // NOTER KAYDI: full_time_score NOT NULL kısıtı 012 göçüne kadar durur;
      // skor UYDURULMAZ — alanları null bir nesne yazılır ve okuma katmanı
      // bunu NULL'a çevirir. result_type kolonu da göç öncesi olmayabilir;
      // gönderilmez, kimlik result_source sabitinden türetilir (üstteki map).
      const notary = row.resultType === 'notary_decision';
      const { error } = await this.sb.from('match_official_results').insert({
        bulletin_id: String(row.bulletinId), match_id: String(row.matchId), order_no: row.orderNo ?? null,
        official_result: row.officialResult,
        full_time_score: row.fullTimeScore ?? (notary ? { home: null, away: null } : null),
        result_source: row.resultSource || 'Spor Toto resmi API',
        confirmed_at: now, source_updated_at: now, correction_version: 1, corrections: [],
      });
      if (error) throwDb(error, 'sonuç yazılamadı');
      return { row: { ...row, confirmedAt: now, correctionVersion: 1 }, changed: true, corrected: false };
    }
    const changed = existing.officialResult !== row.officialResult
      || existing.fullTimeScore?.home !== row.fullTimeScore?.home
      || existing.fullTimeScore?.away !== row.fullTimeScore?.away;
    if (!changed) return { row: existing, changed: false, corrected: false };
    const { error } = await this.sb.from('match_official_results').update({
      official_result: row.officialResult, full_time_score: row.fullTimeScore,
      source_updated_at: now, correction_version: (existing.correctionVersion || 1) + 1,
      corrections: [...(existing.corrections || []), {
        at: now,
        from: { officialResult: existing.officialResult, fullTimeScore: existing.fullTimeScore },
        to: { officialResult: row.officialResult, fullTimeScore: row.fullTimeScore },
      }],
    }).eq('bulletin_id', String(row.bulletinId)).eq('match_id', String(row.matchId));
    if (error) throwDb(error, 'sonuç düzeltilemedi');
    return { row: { ...existing, ...row }, changed: true, corrected: true };
  }

  // --- değerlendirmeler ----------------------------------------------------
  async getEvaluation(bulletinId) {
    const { data, error } = await this.sb.from('snapshot_evaluations')
      .select('*').eq('bulletin_id', String(bulletinId)).maybeSingle();
    if (error) throwDb(error, 'değerlendirme okunamadı');
    if (!data) return null;
    return {
      bulletinId: data.bulletin_id, roundId: Number(data.round_id), snapshotId: data.snapshot_id,
      snapshotHash: data.snapshot_hash, evaluatedAt: data.evaluated_at, resultSource: data.result_source,
      effectiveFromRoundId: Number(data.effective_from_round_id), summary: data.summary, matches: data.matches,
    };
  }

  async saveEvaluation(row) {
    const { error } = await this.sb.from('snapshot_evaluations').upsert({
      bulletin_id: row.bulletinId, round_id: row.roundId, snapshot_id: row.snapshotId,
      snapshot_hash: row.snapshotHash, evaluated_at: toIso(row.evaluatedAt) || new Date().toISOString(),
      result_source: row.resultSource, effective_from_round_id: row.effectiveFromRoundId,
      summary: row.summary, matches: row.matches,
    }, { onConflict: 'bulletin_id' });
    if (error) throwDb(error, 'değerlendirme yazılamadı');
    return row;
  }

  async listEvaluations() {
    // Sayfalanir: her muhurlu hafta bir degerlendirme uretir. Kirpilirsa
    // radar karnesi ("%48 (n=45)") eksik ornekle hesaplanir.
    const data = await tumSatirlar(() => this.sb
      .from('snapshot_evaluations').select('*').order('round_id').order('bulletin_id'));
    return (data || []).map((d) => ({
      bulletinId: d.bulletin_id, roundId: Number(d.round_id), snapshotId: d.snapshot_id,
      snapshotHash: d.snapshot_hash, evaluatedAt: d.evaluated_at, resultSource: d.result_source,
      effectiveFromRoundId: Number(d.effective_from_round_id), summary: d.summary, matches: d.matches,
    }));
  }

  // --- audit ---------------------------------------------------------------
  async appendAudit(entry) {
    const row = { at: new Date().toISOString(), actor: 'system', rejected: false, ...entry };
    const { error } = await this.sb.from('snapshot_audit_log').insert({
      bulletin_id: row.bulletinId ?? null, action: row.action, actor: row.actor,
      at: row.at, old_value: row.oldValue ?? null, new_value: row.newValue ?? null,
      rejected: !!row.rejected, reason: row.reason ?? null,
    });
    if (error) console.warn('[arsiv] audit yazılamadı:', error.message);
    return row;
  }

  async listAudit(bulletinId) {
    const data = await fetchAllPages(() => this.sb.from('snapshot_audit_log')
      .select('*').eq('bulletin_id', String(bulletinId)).order('at').order('id'),
    'audit okunamadı');
    return (data || []).map((r) => ({
      bulletinId: r.bulletin_id, action: r.action, actor: r.actor, at: r.at,
      oldValue: r.old_value, newValue: r.new_value, rejected: r.rejected, reason: r.reason,
    }));
  }
}
