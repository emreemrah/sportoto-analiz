// app/src/hooks/useSystemAnalysisDashboard.js
import { useCallback, useEffect, useState } from 'react';
import { getSystemDashboard } from '../services/performanceService';

// Sistem Analiz Başarı Dashboard ekranı için.
export function useSystemAnalysisDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getSystemDashboard());
    } catch (e) {
      setError(e.message || 'Sistem analiz karnesi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, error, reload };
}
