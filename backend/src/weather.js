// Hava durumu — Open-Meteo (ANAHTAR GEREKMEZ, ücretsiz). Şehir → koordinat →
// maç günü/saati tahmini. Şehir koordinatları dosyada cache'lenir (şehir taşınmaz).
// Tahmin ~16 gün ileriye kadar; aralık dışıysa null (uydurma yok).
import { save, load } from './cache.js';

const GEO_KEY = 'geocache';
let geo = null;
function loadGeo() { if (!geo) geo = load(GEO_KEY)?.data || {}; return geo; }
function saveGeo() { save(GEO_KEY, geo || {}); }

async function geocode(city) {
  if (!city) return null;
  const g = loadGeo();
  if (Object.prototype.hasOwnProperty.call(g, city)) return g[city]; // null da olabilir (bulunamadı)
  let loc = null;
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=tr`);
    const j = await r.json();
    const p = j.results?.[0];
    if (p) loc = { lat: p.latitude, lon: p.longitude };
  } catch { loc = null; }
  g[city] = loc; saveGeo();
  return loc;
}

// Open-Meteo weather_code → Türkçe etiket + emoji
const CODE = {
  0: ['Açık', '☀️'], 1: ['Az bulutlu', '🌤️'], 2: ['Parçalı bulutlu', '⛅'], 3: ['Kapalı', '☁️'],
  45: ['Sisli', '🌫️'], 48: ['Sisli', '🌫️'],
  51: ['Çisenti', '🌦️'], 53: ['Çisenti', '🌦️'], 55: ['Çisenti', '🌦️'],
  56: ['Dondurucu çisenti', '🌧️'], 57: ['Dondurucu çisenti', '🌧️'],
  61: ['Hafif yağmur', '🌦️'], 63: ['Yağmurlu', '🌧️'], 65: ['Kuvvetli yağmur', '🌧️'],
  66: ['Dondurucu yağmur', '🌧️'], 67: ['Dondurucu yağmur', '🌧️'],
  71: ['Hafif kar', '🌨️'], 73: ['Karlı', '🌨️'], 75: ['Yoğun kar', '❄️'], 77: ['Kar taneleri', '🌨️'],
  80: ['Sağanak', '🌦️'], 81: ['Sağanak', '🌧️'], 82: ['Kuvvetli sağanak', '⛈️'],
  85: ['Kar sağanağı', '🌨️'], 86: ['Kar sağanağı', '❄️'],
  95: ['Gök gürültülü', '⛈️'], 96: ['Dolu fırtınası', '⛈️'], 99: ['Dolu fırtınası', '⛈️'],
};

// city (şehir adı) + dateIso (maç tarihi) → { tempC, label, emoji } | null
export async function getWeather(city, dateIso) {
  if (!city || !dateIso) return null;
  const t = new Date(dateIso).getTime();
  if (Number.isNaN(t)) return null;
  const diffDays = (t - Date.now()) / 86400000;
  if (diffDays > 15 || diffDays < -1) return null; // tahmin penceresi dışında
  const loc = await geocode(city);
  if (!loc) return null;
  const day = dateIso.slice(0, 10);      // YYYY-MM-DD
  const hh = dateIso.slice(11, 13);      // maç saati (yerel)
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&hourly=temperature_2m,weather_code&start_date=${day}&end_date=${day}&timezone=auto`);
    const j = await r.json();
    const h = j.hourly;
    if (!h?.time?.length) return null;
    let idx = h.time.findIndex((x) => x.slice(11, 13) === hh);
    if (idx < 0) idx = Math.min(15, h.time.length - 1); // saat bulunamazsa öğleden sonra
    const code = h.weather_code?.[idx];
    const temp = h.temperature_2m?.[idx];
    if (temp == null) return null;
    const [label, emoji] = CODE[code] || ['—', '🌡️'];
    return { tempC: Math.round(temp), label, emoji };
  } catch { return null; }
}
