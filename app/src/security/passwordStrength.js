// ŞİFRE GÜCÜ — SAF MODÜL (React Native bağımlılığı YOK; düz Node testinde çalışır).
//
// Amaç kullanıcıya DÜRÜST geri bildirim vermektir; "güçlü" etiketi bir garanti
// değildir ve şifre hiçbir yerde saklanmadığı için bu hesap yalnız cihazda,
// anlık olarak yapılır — şifre ağa/loga/depoya YAZILMAZ.

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Şifre gücünü 0-4 arası puanlar.
 * @returns {{score:0|1|2|3|4, label:string, color:'red'|'orange'|'yellow'|'green', ok:boolean, hints:string[]}}
 */
export function passwordStrength(pw) {
  const s = String(pw || '');
  const hints = [];
  if (!s) return { score: 0, label: 'Şifre gir', color: 'red', ok: false, hints: [`En az ${MIN_PASSWORD_LENGTH} karakter`] };

  let score = 0;
  if (s.length >= MIN_PASSWORD_LENGTH) score += 1; else hints.push(`En az ${MIN_PASSWORD_LENGTH} karakter olmalı`);
  if (s.length >= 12) score += 1;
  const variety = [/[a-zçğıöşü]/.test(s), /[A-ZÇĞİÖŞÜ]/.test(s), /\d/.test(s), /[^A-Za-z0-9çğıöşüÇĞİÖŞÜ]/.test(s)]
    .filter(Boolean).length;
  if (variety >= 2) score += 1; else hints.push('Harf + rakam karışımı kullan');
  if (variety >= 3) score += 1;

  // Çok bilinen kalıplar gücü düşürür (dürüst uyarı).
  if (/^(123456|12345678|password|şifre|sifre|qwerty|111111|abc123)/i.test(s) || /^(.)\1+$/.test(s)) {
    score = Math.min(score, 1);
    hints.push('Bu şifre çok yaygın; tahmin edilmesi kolay');
  }

  const ok = s.length >= MIN_PASSWORD_LENGTH;
  if (!ok) score = Math.min(score, 1);
  const label = score <= 1 ? 'Zayıf' : score === 2 ? 'Orta' : score === 3 ? 'İyi' : 'Güçlü';
  const color = score <= 1 ? 'red' : score === 2 ? 'orange' : score === 3 ? 'yellow' : 'green';
  return { score, label, color, ok, hints };
}
