// Node testleri için modül çözümleme kancası kaydı.
// Uygulama kaynak kodu Metro (Expo) uzantısız import kullanır
// ("../data/mockBulletins"); Node ESM ise uzantı ister. Bu kanca, göreli
// uzantısız import'lara ".js" ekleyerek AYNI kaynak dosyaları değiştirmeden
// node:test altında çalıştırmayı sağlar. Üretim koduna etkisi yoktur.
import { register } from 'node:module';

register(new URL('./resolve-js-extension.mjs', import.meta.url));
