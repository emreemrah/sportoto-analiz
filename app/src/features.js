// ÖZELLİK ANAHTARLARI — bir özelliği KODU SİLMEDEN kapatmak için.
//
// NEDEN SİLMİYORUZ: "şimdilik kullanmayacağım" kalıcı bir karar değildir.
// Silmek geri dönüşü pahalı yapar (kod, test, stil, navigasyon hepsi tek tek
// geri konur ve arada bir şey unutulur). Kapatmak ise tek satırdır ve geri
// açmak da tek satır.
//
// KURAL: Kapalı bir özelliğin TESTLERİ SİLİNMEZ ve çalışmaya devam eder.
// Kapalıyken bozulan bir ekran, geri açıldığı gün fark edilir — o da en kötü
// zamandır. Testler burada bir maliyet değil, geri dönüş sigortasıdır.

/**
 * YAYIN STÜDYOSU — 15 maçlık bülteni canlı yayında maç maç işleyen koyu mod
 * (StudioBulletin · StudioMatch · StudioKarne · Broadcast).
 *
 * KAPALI: emrah şu an kullanmıyor (01.08.2026 kararı).
 *
 * Kapalıyken:
 *   • Ana sayfadaki 📺 düğmesi çizilmez,
 *   • dört ekranın navigasyon kaydı yapılmaz (derin bağlantıyla da açılamaz),
 *   • stüdyo yazı tipleri yüklenmez (açılış biraz hızlanır).
 *
 * Geri açmak: aşağıdaki değeri `true` yap. Kod, testler ve stiller olduğu
 * yerde duruyor; başka hiçbir şey gerekmez.
 */
export const YAYIN_STUDYOSU_ACIK = false;
