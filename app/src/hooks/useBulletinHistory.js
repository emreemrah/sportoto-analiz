// app/src/hooks/useBulletinHistory.js
import { useCallback, useEffect, useState } from 'react';
import { listBulletins, getBulletinById } from '../services/bulletinHistoryService';
import { getSnapshot } from '../services/analysisSnapshotService';
import { getCouponForBulletin } from '../services/couponService';

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
      const withCoupons = await Promise.all(
        list.map(async (b) => {
          const coupon = await getCouponForBulletin(b.id).catch(() => null);
          return { ...b, myCoupon: coupon };
        })
      );
      setBulletins(withCoupons);
    } catch (e) {
      setError(e.message || 'Bülten geçmişi alınamadı.');
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
        getCouponForBulletin(bulletinId).catch(() => null),
      ]);
      if (!bulletin) throw new Error('Bülten bulunamadı.');
      setState({ bulletin, snapshot, coupon, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message || 'Bülten detayı alınamadı.' }));
    }
  }, [bulletinId]);

  useEffect(() => { reload(); }, [reload]);

  return { ...state, reload };
}
