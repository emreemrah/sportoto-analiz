// PROFİL / GİRİŞ AKIŞI RENDER TESTLERİ.
//
// Korunan davranışlar:
//  * Girişsiz kullanıcı boş ekran görmez; giriş/kayıt yolu ve GİZLİLİK metni
//    giriş yapmadan da erişilebilir olmalıdır (KVKK gereği).
//  * Bağımsızlık beyanı ("resmî bağlantısı yoktur") her iki durumda da görünür.
//  * Operatör (moderatör) girişi VARSAYILAN OLARAK GİZLİDİR: kararı sunucu
//    verir, uygulama vermez. Uç cevap vermezse giriş çizilmez — yetki
//    bilinmiyorsa GÖSTERİLMEZ.
//
// Sürüm notu için bkz. ekranlar.test.jsx (RNTL 13.x kullanılır, 14.x DEĞİL).
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

import ProfileScreen from '../src/screens/ProfileScreen';
import { INDEPENDENCE_NOTICE } from '../src/brand';

const nav = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) };

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(cb, [cb]); },
}));

// Oturum durumu testten sürülür; gerçek auth modülünün yüzeyi korunur.
const oturum = { token: null, user: null, ready: true };
jest.mock('../src/auth', () => ({
  useAuth: () => oturum,
  logout: jest.fn(),
  refreshUser: jest.fn(async () => {}),
}));

function mockUclar(harita = {}) {
  global.fetch.mockImplementation(async (url) => {
    const u = String(url);
    const k = Object.keys(harita).find((x) => u.includes(x));
    if (!k) return { ok: false, status: 404, json: async () => ({ error: 'yok' }), text: async () => 'yok' };
    return { ok: true, status: 200, json: async () => harita[k], text: async () => JSON.stringify(harita[k]) };
  });
}

const KULLANICI = { id: 'u1', username: 'emrah', avatar: null, email: 'e@example.com' };

beforeEach(() => { oturum.token = null; oturum.user = null; oturum.ready = true; });

describe('Profil — girişsiz', () => {
  test('giriş ve kayıt yolları görünüyor, boş ekran yok', async () => {
    mockUclar();
    render(<ProfileScreen navigation={nav} />);
    expect(await screen.findByText('Giriş Yap')).toBeTruthy();
    expect(screen.getByText('Kayıt Ol')).toBeTruthy();
  });

  test('gizlilik metni GİRİŞ YAPMADAN da erişilebilir', async () => {
    mockUclar();
    render(<ProfileScreen navigation={nav} />);
    // KVKK gereği: aydınlatma metni giriş duvarının arkasında olamaz.
    expect(await screen.findByText('Hakkında ve Gizlilik')).toBeTruthy();
  });

  test('bağımsızlık beyanı girişsiz kullanıcıya da gösteriliyor', async () => {
    mockUclar();
    render(<ProfileScreen navigation={nav} />);
    expect(await screen.findByText(INDEPENDENCE_NOTICE)).toBeTruthy();
    // Beyanın içeriği de kontrol edilir — boş bir sabit işe yaramaz.
    expect(INDEPENDENCE_NOTICE).toMatch(/bağlantısı yoktur|resmî değildir|bağımsız/i);
  });
});

describe('Profil — girişli', () => {
  test('girişli menü çiziliyor ve e-posta doğrulama durumu GİZLENMİYOR', async () => {
    oturum.token = 't'; oturum.user = KULLANICI;
    mockUclar();
    render(<ProfileScreen navigation={nav} />);
    // Girişli kullanıcıya özel girişler.
    expect(await screen.findByText('Çıkış Yap')).toBeTruthy();
    expect(screen.getByText('Hesabımı Sil')).toBeTruthy();
    // Doğrulanmamış e-posta gizlenmez — kullanıcı durumunu bilir.
    expect(screen.getByText(/doğrulanmadı/)).toBeTruthy();
  });

  test('MODERATÖR GİRİŞİ varsayılan olarak GİZLİ (uç cevap vermezse çizilmez)', async () => {
    oturum.token = 't'; oturum.user = KULLANICI;
    mockUclar();                       // /api/moderation/access → 404
    render(<ProfileScreen navigation={nav} />);
    await waitFor(() => expect(screen.getByText('Çıkış Yap')).toBeTruthy());
    // Yetki bilinmiyorsa giriş GÖSTERİLMEZ — kullanıcı reddedileceği bir
    // ekrana hiç gitmez ve operatör listesi uygulamada tutulmaz.
    expect(screen.queryByText('🛡️  İnceleme (bildirilen yorumlar)')).toBeNull();
  });

  test('sunucu operator:false derse de giriş çizilmez', async () => {
    oturum.token = 't'; oturum.user = KULLANICI;
    mockUclar({ '/api/moderation/access': { operator: false } });
    render(<ProfileScreen navigation={nav} />);
    await waitFor(() => expect(screen.getByText('Çıkış Yap')).toBeTruthy());
    expect(screen.queryByText('🛡️  İnceleme (bildirilen yorumlar)')).toBeNull();
  });

  test('yalnız sunucu operator:true derse moderasyon girişi çizilir', async () => {
    oturum.token = 't'; oturum.user = KULLANICI;
    mockUclar({ '/api/moderation/access': { operator: true } });
    render(<ProfileScreen navigation={nav} />);
    expect(await screen.findByText('🛡️  İnceleme (bildirilen yorumlar)')).toBeTruthy();
  });
});
