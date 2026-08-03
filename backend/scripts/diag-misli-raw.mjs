// TEŞHİS — Misli'nin HAM yanıtında program ile playRatio hizalı mı?
// ---------------------------------------------------------------------------
// ŞÜPHE: Radar 3'te Misli yüzdeleri Nesine'ninkilerle taban tabana zıt
// (ör. Oulu–HJK: Nesine 40/25/35, Misli 84/3/13). Eşleştirme izleri her iki
// kaynakta da DOĞRU maçı gösteriyor, yani sorun bülten eşleştirmesinde değil.
// Kalan olasılık: `playRatio.events[].no` ile `draw.events[].no` aynı şeyi
// göstermiyor ve yüzdeler yanlış maça biniyor.
//
// SALT OKUR. Hiçbir şey yazmaz. Çıktı: backend/cache/diagMisliRaw.json
import { save } from '../src/cache.js';

const URL = 'https://apivx.misli.com/api/web/v1/sportoto/active';
const UA = 'Mozilla/5.0 (compatible; SporTotoAnalyzer/1.0)';

export async function runMisliRaw() {
  const r = await fetch(URL, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  const json = await r.json();
  const draw = json?.data?.draw;
  const pr = json?.data?.playRatio;

  const programNolar = (draw?.events || []).map((e) => Number(e.no));
  const ratioNolar = (pr?.events || []).map((e) => Number(e.no));

  const satirlar = (draw?.events || []).map((e) => {
    const pe = (pr?.events || []).find((x) => Number(x.no) === Number(e.no));
    const sel = {};
    for (const s of (pe?.selections || [])) sel[String(s.name)] = Number(s.ratio);
    return {
      no: e.no,
      mac: e.name,
      tarih: e.date ? new Date(Number(e.date)).toISOString() : null,
      ratioBulundu: !!pe,
      selectionAdlari: (pe?.selections || []).map((s) => s.name),
      ev1: sel['1'] ?? null, beraberlik0: sel['0'] ?? null, dep2: sel['2'] ?? null,
      toplam: [sel['1'], sel['0'], sel['2']].every((v) => Number.isFinite(v))
        ? sel['1'] + sel['0'] + sel['2'] : null,
    };
  });

  const sonuc = {
    calistirilma: new Date().toISOString(),
    httpDurum: r.status,
    drawNumber: draw?.drawNumber ?? null,
    programMacSayisi: programNolar.length,
    ratioKayitSayisi: ratioNolar.length,
    programNolar, ratioNolar,
    nolarAyniMi: JSON.stringify(programNolar) === JSON.stringify(ratioNolar),
    // playRatio kaydında maç adı var mı? Varsa hizalama DOĞRUDAN doğrulanır.
    ratioOrnekHamKayit: (pr?.events || [])[0] ?? null,
    playRatioUstAlanlar: pr ? Object.keys(pr) : null,
    satirlar,
  };

  console.log(`\nMisli draw=${sonuc.drawNumber} · program=${sonuc.programMacSayisi} maç · playRatio=${sonuc.ratioKayitSayisi} kayıt · no listeleri aynı mı: ${sonuc.nolarAyniMi}`);
  console.log('playRatio ilk ham kayıt:', JSON.stringify(sonuc.ratioOrnekHamKayit));
  for (const s of satirlar) {
    console.log(`  no=${String(s.no).padEnd(3)} ${String(s.mac).padEnd(38)} 1=${String(s.ev1).padEnd(5)} X=${String(s.beraberlik0).padEnd(5)} 2=${String(s.dep2).padEnd(5)} toplam=${s.toplam}`);
  }

  save('diagMisliRaw', sonuc);
  console.log('[diag] backend/cache/diagMisliRaw.json yazıldı.');
  return sonuc;
}
