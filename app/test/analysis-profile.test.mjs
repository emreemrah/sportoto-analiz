// PROFİL SÜRÜMLEME + MASTER ANALİZ SERVİSİ TESTLERİ (frontend, RN gerekmez)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getProfileTemplate, getActiveProfile, saveProfile, countOn,
  listProfiles, createProfileLocal, duplicateActiveProfile, setActiveProfile, getProfileVersions,
} from '../src/analysisProfile.js';
import { setArchiveFetcher } from '../src/services/archiveClient.js';
import { calculateMatchMaster, _clearMasterAnalysisCacheForTests } from '../src/services/masterAnalysisService.js';

test('şablon 40 mevcut kriteri içerir; hepsi KAPALI başlar (motor boş başlar)', () => {
  const tpl = getProfileTemplate();
  assert.equal(Object.keys(tpl.criteria).length, 40);
  assert.equal(countOn(tpl), 0);
  assert.ok(tpl.criteria.position && tpl.criteria.formDrop && tpl.criteria.xgForVenue, 'mevcut key’ler korunur');
});

test('kaydet = YENİ SÜRÜM; eski sürüm ezilmez; çoklu profil/kopyalama çalışır', () => {
  const c1 = getProfileTemplate().criteria;
  c1.position = { on: true, impact: 'high' };
  const p1 = saveProfile(c1, 'Dengeli Analiz', { mode: 'manual' });
  assert.equal(p1.version, 1);

  const c2 = JSON.parse(JSON.stringify(c1));
  c2.xgFor = { on: true, impact: 'critical' };
  const p2 = saveProfile(c2, null, { mode: 'smart' });
  assert.equal(p2.version, 2, 'düzenleme yeni sürüm oluşturur');
  assert.equal(p2.mode, 'smart');

  const versions = getProfileVersions();
  assert.equal(versions.length, 2);
  assert.equal(versions[0].version, 1);
  assert.equal(versions[0].criteria.xgFor?.on ?? false, false, 'ESKİ sürüm değişmeden kalır');
  assert.equal(versions[0].mode, 'manual');

  const copy = duplicateActiveProfile('Sürpriz Avcısı');
  assert.equal(copy.name, 'Sürpriz Avcısı');
  assert.equal(copy.version, 1);
  assert.equal(countOn(copy), 2, 'kopya seçimleri taşır');

  const fresh = createProfileLocal('xG Odaklı');
  assert.equal(countOn(fresh), 0, 'yeni profil boş başlar');
  assert.ok(listProfiles().length >= 3);

  setActiveProfile(listProfiles().find((x) => x.name === 'Dengeli Analiz').id);
  assert.equal(getActiveProfile().name, 'Dengeli Analiz');
});

test('masterAnalysisService: profili backend’e gönderir; çevrimdışıysa null (dürüst fallback)', async () => {
  _clearMasterAnalysisCacheForTests();
  let seen = null;
  setArchiveFetcher(async (path, opts) => {
    seen = { path, opts };
    return { roundId: 4200, freezeStatus: 'live', match: { no: 3, master: { ok: true, mainPrediction: '1', selectedCriteriaCount: 2 } }, matches: [] };
  });
  const profile = { id: 'p1', name: 'Test', version: 2, mode: 'manual', criteria: { position: { on: true, impact: 'high' } } };
  const res = await calculateMatchMaster(3, profile);
  assert.equal(seen.path, '/api/analysis/matches/3/calculate');
  assert.equal(seen.opts.method, 'POST');
  assert.equal(seen.opts.body.profile.version, 2, 'profil sürümü sunucuya gider');
  assert.equal(res.match.master.mainPrediction, '1');

  _clearMasterAnalysisCacheForTests();
  setArchiveFetcher(async () => { throw new Error('Network request failed'); });
  const off = await calculateMatchMaster(3, profile);
  assert.equal(off, null, 'çevrimdışı → null (ekran yerel görünüme düşer, sahte veri yok)');
});
