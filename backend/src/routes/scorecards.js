// KARNE API'Sİ — /api/scorecards/*
// Sistem / Kapsama / Radar / Kriter / Retrospektif / Provenance uçları.
// ÜÇ KARNE DE aynı merkezî uygunluk kuralını (scorecards/provenance.js) kullanır:
// yalnız KANITLI official_forward kayıtlar resmî başarıya girer (default-deny).
import { Router } from 'express';
import {
  buildSystemScorecard, buildRetrospectiveScorecard, buildProvenanceReport,
} from '../scorecards/scorecardService.js';
import { buildRadarScorecard } from '../radar/scorecard.js';
import { buildCriterionScorecard } from '../analysis/analysisService.js';

// server.js sonuç servisini (retrospektif ölçüm için) enjekte eder — testte stub.
export default function makeScorecardsRouter({ fetchBulletin = null } = {}) {
  const router = Router();
  const fail = (res, e) => {
    console.warn('[scorecards-api] hata:', e.message);
    res.status(500).json({ error: 'Karne isteği işlenemedi.' });
  };

  // 5 dk yanıt cache'i (hesaplar arşiv taramalı — kullanıcı başına tekrarlanmaz).
  const mem = new Map();
  const cached = async (key, ttlMs, fn) => {
    const hit = mem.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.val;
    const val = await fn();
    mem.set(key, { at: Date.now(), val });
    return val;
  };
  const TTL = 5 * 60 * 1000;

  router.get('/system', async (req, res) => {
    try { res.json(await cached('system', TTL, () => buildSystemScorecard())); } catch (e) { fail(res, e); }
  });

  router.get('/system/weeks', async (req, res) => {
    try {
      const sc = await cached('system', TTL, () => buildSystemScorecard());
      res.json({ generatedAt: sc.generatedAt, hasOfficialForwardData: sc.hasOfficialForwardData, weeks: sc.weeks });
    } catch (e) { fail(res, e); }
  });

  router.get('/system/errors', async (req, res) => {
    try {
      const sc = await cached('system', TTL, () => buildSystemScorecard());
      res.json({ generatedAt: sc.generatedAt, hasOfficialForwardData: sc.hasOfficialForwardData, errors: sc.errors });
    } catch (e) { fail(res, e); }
  });

  router.get('/coverage', async (req, res) => {
    try {
      const sc = await cached('system', TTL, () => buildSystemScorecard());
      res.json({ generatedAt: sc.generatedAt, hasOfficialForwardData: sc.hasOfficialForwardData, isDemo: false, ...sc.coverage });
    } catch (e) { fail(res, e); }
  });

  router.get('/radar', async (req, res) => {
    try { res.json(await cached('radar', TTL, () => buildRadarScorecard())); } catch (e) { fail(res, e); }
  });

  router.get('/criteria', async (req, res) => {
    try { res.json(await cached('criteria', TTL, () => buildCriterionScorecard({}))); } catch (e) { fail(res, e); }
  });

  // RETROSPEKTİF UÇ — ⛔ VARSAYILAN KAPALI (normal kullanıcıya sunulmaz).
  // Yalnız geliştirme/admin incelemesi için ENABLE_LEGACY_RETROSPECTIVE=true
  // iken açılır. Production'da eski/legacy başarı yüzdeleri kullanıcıya sızmaz.
  router.get('/retrospective', async (req, res) => {
    try {
      if (process.env.ENABLE_LEGACY_RETROSPECTIVE !== 'true') {
        return res.status(404).json({
          error: 'Retrospektif inceleme kapalı.',
          note: 'Eski geliştirme kayıtları resmî başarıdan ayrılmıştır ve bu karneye dahil edilmez.',
        });
      }
      res.json(await cached('retrospective', TTL, () => buildRetrospectiveScorecard({ fetchBulletin })));
    } catch (e) { fail(res, e); }
  });

  router.get('/provenance', async (req, res) => {
    try { res.json(await cached('provenance', TTL, () => buildProvenanceReport())); } catch (e) { fail(res, e); }
  });

  return router;
}
