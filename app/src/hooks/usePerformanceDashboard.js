// app/src/hooks/usePerformanceDashboard.js
import { useCallback, useEffect, useState } from 'react';
import { getUserDashboard } from '../services/performanceService';

// Kullanıcı Başarı Dashboard ekranı için.
export function usePerformanceDashboard(userId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getUserDashboard(userId));
    } catch (e) {
      setError(e.message || 'Başarı panelin alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, error, reload };
}
