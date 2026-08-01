// Ülke adından bayrak emojisi (FootyStats nationality alanı → emoji).
// Eşleşmezse boş döner (bayrak gösterilmez).
const ISO = {
  Sweden: 'SE', Norway: 'NO', Denmark: 'DK', Finland: 'FI', Iceland: 'IS',
  England: 'GB', Scotland: 'GB', Wales: 'GB', 'Northern Ireland': 'GB', Ireland: 'IE',
  Spain: 'ES', France: 'FR', Germany: 'DE', Netherlands: 'NL', Belgium: 'BE',
  Portugal: 'PT', Italy: 'IT', Switzerland: 'CH', Austria: 'AT', Greece: 'GR',
  Croatia: 'HR', Serbia: 'RS', 'Bosnia and Herzegovina': 'BA', Bosnia: 'BA', Slovenia: 'SI',
  Slovakia: 'SK', 'Czech Republic': 'CZ', Czechia: 'CZ', Poland: 'PL', Hungary: 'HU',
  Romania: 'RO', Bulgaria: 'BG', Ukraine: 'UA', Russia: 'RU', Turkey: 'TR',
  Albania: 'AL', Kosovo: 'XK', 'North Macedonia': 'MK', Montenegro: 'ME',
  Brazil: 'BR', Argentina: 'AR', Uruguay: 'UY', Chile: 'CL', Colombia: 'CO',
  Peru: 'PE', Ecuador: 'EC', Paraguay: 'PY', Venezuela: 'VE', Mexico: 'MX',
  'United States': 'US', USA: 'US', Canada: 'CA',
  Japan: 'JP', 'South Korea': 'KR', 'Korea Republic': 'KR', Korea: 'KR',
  China: 'CN', 'China PR': 'CN', Australia: 'AU', 'New Zealand': 'NZ',
  Iran: 'IR', Iraq: 'IQ', 'Saudi Arabia': 'SA', Qatar: 'QA', 'United Arab Emirates': 'AE',
  Uzbekistan: 'UZ', Thailand: 'TH', Vietnam: 'VN', Indonesia: 'ID',
  Mali: 'ML', Senegal: 'SN', Nigeria: 'NG', Ghana: 'GH', Gambia: 'GM',
  'Ivory Coast': 'CI', "Cote d'Ivoire": 'CI', Cameroon: 'CM', Morocco: 'MA',
  Algeria: 'DZ', Tunisia: 'TN', Egypt: 'EG', 'South Africa': 'ZA', Kenya: 'KE',
  Zambia: 'ZM', Zimbabwe: 'ZW', Angola: 'AO', Guinea: 'GN', 'Burkina Faso': 'BF',
  'DR Congo': 'CD', 'Congo DR': 'CD', Congo: 'CG', Togo: 'TG', Benin: 'BJ',
  'Sierra Leone': 'SL', Liberia: 'LR', Gabon: 'GA', Israel: 'IL',
};

export function countryFlag(name) {
  const code = ISO[name];
  if (!code) return '';
  return code.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

// Ülke adından küçük harfli ISO2 kodu (flagcdn görseli için). Eşleşmezse ''.
export function countryCode(name) {
  const code = ISO[name];
  return code ? code.toLowerCase() : '';
}

// "2026-07-03T20:00:00" → { day: "03 Tem", time: "20:00" }
const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export function matchDate(iso) {
  if (!iso) return { day: '', time: '' };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { day: '', time: '' };
  const p = (n) => String(n).padStart(2, '0');
  return { day: `${d.getDate()} ${AYLAR[d.getMonth()]}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
}

// KULÜP ARMASI — bir maçın verilen tarafı için arma adresi.
// İki kaynak vardır ve sıralaması önemlidir:
//   1) match.stats[side].logo — maç kaynak fikstürüyle eşleştiğinde gelir (en kesin).
//   2) match[side].logo       — arma kayıt defterinden gelir; maç eşleşmese bile
//                               kulübün arması biliniyorsa dolu olur.
// İkisi de yoksa null döner ve çağıran nötr ⚽ çizer. Başka kulübün arması veya
// "benzeri" bir görsel ASLA konmaz — bu karar backend'de verilir, burada sadece
// okunur.
export function crestOf(match, side) {
  return match?.stats?.[side]?.logo || match?.[side]?.logo || null;
}
