// ARAYÜZ TESTLERİ ORTAK KURULUM (T15).
//
// Ekranlar cihaz yeteneklerine (güvenli depo, bildirim, biyometri, ağ) bağlı.
// Testler GERÇEK cihaza da ağa da çıkmaz: bu modüller burada taklit edilir.
// Amaç ekranın ÇİZİLDİĞİNİ ve doğru metinleri gösterdiğini doğrulamak.

// --- Expo yerel modülleri ---
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => false),
  isEnrolledAsync: jest.fn(async () => false),
  authenticateAsync: jest.fn(async () => ({ success: true })),
  supportedAuthenticationTypesAsync: jest.fn(async () => []),
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: 'undetermined' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => false),
  shareAsync: jest.fn(async () => {}),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
}));

// --- Ağ: testler sunucuya GİTMEZ ---
// Her test kendi verisini `global.fetch.mockResolvedValueOnce(...)` ile verir;
// varsayılan olarak "veri yok" döner (ekranların boş durumu da test edilebilsin).
global.fetch = jest.fn(async () => ({
  ok: false,
  status: 503,
  json: async () => ({ error: 'test' }),
  text: async () => 'test',
}));

beforeEach(() => {
  global.fetch.mockClear();
});
