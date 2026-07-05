// app/src/hooks/useCoupon.js
import { useCallback, useEffect, useState } from 'react';
import { getBulletinById } from '../services/bulletinHistoryService';
import { getSnapshot } from '../services/analysisSnapshotService';
import { getCouponForBulletin, getCouponHistory, saveCoupon, checkCoupon, isCouponEditable } from '../services/couponService';

// Kupon Oluştur / Kuponum / Kupon Sonuç ekranlarının ortak veri kaynağı.
// Bülten + snapshot (sistem önerisi/güven/sürpriz) + kullanıcının en güncel
// kupon versiyonunu bir arada getirir; save/check aksiyonlarını sağlar.
export function useCoupon(bulletinId, userId) {
  const [state, setState] = useState({
    bulletin: null,
    snapshot: null,
    coupon: null,
    history: [],
    loading: true,
    error: null,
  });
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [actionError, setActionError] = useState(null);

  const reload = useCallback(async () => {
    if (!bulletinId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [bulletin, snapshot, coupon, history] = await Promise.all([
        getBulletinById(bulletinId),
        getSnapshot(bulletinId),
        getCouponForBulletin(bulletinId, userId).catch(() => null),
        getCouponHistory(bulletinId, userId).catch(() => []),
      ]);
      if (!bulletin) throw new Error('Bülten bulunamadı.');
      setState({ bulletin, snapshot, coupon, history, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message || 'Kupon bilgisi alınamadı.' }));
    }
  }, [bulletinId, userId]);

  useEffect(() => { reload(); }, [reload]);

  const save = useCallback(async (selections) => {
    setSaving(true);
    setActionError(null);
    try {
      const coupon = await saveCoupon(bulletinId, selections, userId);
      await reload();
      return coupon;
    } catch (e) {
      setActionError(e.message || 'Kupon kaydedilemedi.');
      throw e;
    } finally {
      setSaving(false);
    }
  }, [bulletinId, userId, reload]);

  const check = useCallback(async () => {
    if (!state.coupon) return null;
    setChecking(true);
    setActionError(null);
    try {
      const result = await checkCoupon(state.coupon.id);
      await reload();
      return result;
    } catch (e) {
      setActionError(e.message || 'Kupon kontrol edilemedi.');
      throw e;
    } finally {
      setChecking(false);
    }
  }, [state.coupon, reload]);

  return {
    ...state,
    editable: isCouponEditable(state.bulletin),
    saving,
    checking,
    actionError,
    save,
    check,
    reload,
  };
}
