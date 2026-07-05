// app/src/data/mockPerformance.js
// Dashboard hesaplamaları services/performanceService.js içinde canlı olarak
// mockCoupons + mockBulletins + mockAnalysisSnapshots üzerinden yapılır (statik
// sayı tekrarı çelişki yaratabileceği için burada saklanmaz). Bu dosya sadece
// dashboard ekranlarının ihtiyaç duyduğu, veriden bağımsız sabit eşikleri ve
// yardımcı listeleri tutar.

import { mockBulletins } from './mockBulletins';

export const RECENT_FORM_WINDOW_SHORT = 5;
export const RECENT_FORM_WINDOW_LONG = 10;

// Mock bültenlerde geçen tüm ligler (filtre/etiket amaçlı).
export function allMockLeagues() {
  const set = new Set();
  mockBulletins.forEach((b) => b.matches.forEach((m) => set.add(m.league)));
  return Array.from(set).sort();
}
