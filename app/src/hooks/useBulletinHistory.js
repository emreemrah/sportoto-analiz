// app/src/hooks/useBulletinHistory.js
import { useCallback, useEffect, useState } from 'react';
import { listBulletins, getBulletinById } from '../services/bulletinHistoryService';
import { getSnapshot } from '../services/analysisSnapshotService';
import { humanArchiveError } from '../services/archiveClient';

// Geçmiş Bültenler Ekranı için: tüm bültenler + (varsa) kullanıcının o bültene
// ait kupon özet bilgisi (liste kartında "kaç doğru" gösterebilmek için).
export function useBulletinHistory() {
  const [bulletins, setBulletins] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listBulletins();
      // Eski kupon servisi kaldırıldı — kuponlar artık Kupon Merkezi'nde (coupon/store).
      setBulletins(list.map((b) => ({ ...b, myCoupon: null })));
    } catch (e) {
      setError(humanArchiveError(e) || 'Bülten geçmişi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { bulletins, loading, error, reload };
}

// Tek bülten detayı: bülten + kilitli/editable analiz snapshot + kullanıcı kuponu.
export function useBulletinDetail(bulletinId) {
  const [state, setState] = useState({ bulletin: null, snapshot: null, coupon: null, loading: true, error: null });

  const reload = useCallback(async () => {
    if (!bulletinId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [bulletin, snapshot, coupon] = await Promise.all([
        getBulletinById(bulletinId),
        getSnapshot(bulletinId),
        Promise.resolve(null), // eski kupon servisi kaldırıldı (Kupon Merkezi ayrı)
      ]);
      if (!bulletin) throw new Error('Bülten bulunamadı.');
      setState({ bulletin, snapshot, coupon, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: humanArchiveError(e) || 'Bülten detayı alınamadı.' }));
    }
  }, [bulletinId]);

  useEffect(() => { reload(); }, [reload]);

  return { ...state, reload };
}
