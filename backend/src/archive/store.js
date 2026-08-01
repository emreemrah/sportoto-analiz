// ARŞİV DEPO SEÇİCİ
// Üretim: Supabase (kalıcı + DB-seviyesi değişmezlik trigger'ları).
// Yapılandırılmamışsa: dosya deposu (geliştirme/test — Render free'de kalıcı değil).
// ARCHIVE_DRIVER=file|supabase ile elle de seçilebilir.
import { supabaseEnabled } from '../supabase.js';
import { FileArchiveStore } from './fileStore.js';
import { SupabaseArchiveStore } from './supabaseStore.js';

let _store = null;
let _driver = null;

export function getArchiveStore() {
  if (_store) return _store;
  const pref = (process.env.ARCHIVE_DRIVER || '').toLowerCase();
  if (pref === 'file' || (!supabaseEnabled && pref !== 'supabase')) {
    _driver = 'file';
    _store = new FileArchiveStore();
    if (!supabaseEnabled && process.env.NODE_ENV === 'production') {
      console.warn('[arsiv] ÜRETİM UYARISI: Supabase yapılandırılmamış → arşiv dosya deposunda (Render free diski kalıcı DEĞİL). bkz. backend/migrations/README.md');
    }
    return _store;
  }
  _driver = 'supabase';
  _store = new SupabaseArchiveStore();
  return _store;
}

export function getArchiveDriverName() {
  getArchiveStore();
  return _driver;
}

// Testler için: depo örneğini sıfırla (ör. ARCHIVE_DIR değiştirildiğinde).
export function _resetArchiveStoreForTests() {
  _store = null;
  _driver = null;
}
