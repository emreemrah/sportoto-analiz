// app/src/hooks/useAnalysisPerformanceDashboard.js
import { useCallback, useEffect, useState } from 'react';
import { getAnalysisPerformanceDashboard } from '../services/analysisPerformanceService';

// Analiz bölümleri + istatistik sinyalleri başarı dashboard'u için.
export function useAnalysisPerformanceDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getAnalysisPerformanceDashboard());
    } catch (e) {
      setError(e.message || 'Analiz başarı verisi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, error, reload };
}
