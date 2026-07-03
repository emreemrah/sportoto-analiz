// Tüm gizli/ayarlanabilir değerler .env dosyasından okunur.
// API anahtarı ASLA kodun içine yazılmaz.
import 'dotenv/config';

export const config = {
  // FootyStats API anahtarı — .env'den. Yoksa "example" (örnek lig).
  footyStatsKey: process.env.FOOTYSTATS_API_KEY || 'example',

  // API-Football (api-sports.io) — gerçek canlı skor + dakika için.
  apiFootballKey: process.env.APIFOOTBALL_API_KEY || '',
  apiFootballApi: 'https://v3.football.api-sports.io',

  // Anthropic (Claude) anahtarı — maç yorumlarını üretmek için. Yoksa kural-tabanlı yoruma düşülür.
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'claude-opus-4-8',

  port: Number(process.env.PORT) || 4000,

  refreshHours: Number(process.env.REFRESH_HOURS) || 6,

  // Analiz edilecek FootyStats sezon id'leri (en fazla 50)
  seasonIds: (process.env.FOOTYSTATS_SEASON_IDS || '2012')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50),

  // Dış servis adresleri
  sportotoApi: 'https://webapi.sportoto.gov.tr/',
  footyStatsApi: 'https://api.football-data-api.com',
};

// Anahtarın gerçek mi yoksa örnek mi olduğunu (anahtarı sızdırmadan) bildirir
export const usingExampleKey = config.footyStatsKey === 'example';
