// OYNANMA DNA PANELİ (Radar 3) — "bu dağılıma benzer geçmiş maçlar nasıl bitti?"
//
// NEDEN AYRI DOSYA: RadarScreen'de bu panel 5 ayrı `useState`, 1 `useEffect` ve
// 1 `useRef` ile ekranın geri kalanına karışmış hâldeydi. Panelin verisi
// yalnız paneli ilgilendiriyor; artık kendi durumunu kendisi taşıyor. Ekran
// sadece "hangi satır açık" bilgisini tutuyor.
//
// DÜRÜSTLÜK KURALLARI (tasarım gereği, sadeleştirilmemeli):
//  * Panelde GÜVEN SEVİYESİ, örneklem uyarısı veya olasılık iddiası YOKTUR.
//    "Kaç kayıtta" ifadesi örneklemi zaten şeffaf biçimde bildirir.
//  * Yakınlık kullanıcı seçer — otomatik genişleme yok. Sistem örneklemi
//    kendiliğinden büyütüp sayıyı güçlü göstermez.
//  * Toplam önce gelir; altındaki iki kırılım AYNI kayıtların iki farklı
//    görünümüdür, TOPLANMAZ.
//  * Yakınlık ve kapsam bilinçli olarak en sonda ve soluktur: ana sonucun
//    önüne geçmemeli.
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { api } from '../api';
import { colors, radius } from '../theme';

const GUN_ADLARI = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

// Filtre birimi MAÇ (hafta değil): en yeni N sonuçlanmış maç.
const MAC_SECENEKLERI = [
  { v: null, l: 'Tüm Maçlar' }, { v: 5, l: 'Son 5 Maç' }, { v: 10, l: 'Son 10 Maç' }, { v: 15, l: 'Son 15 Maç' },
];
// Yakınlık: kullanıcı seçer, otomatik genişleme yok.
const YAKINLIK_SECENEKLERI = [
  { v: 0, l: 'Birebir aynı' }, { v: 1, l: '±1' }, { v: 2, l: '±2' }, { v: 3, l: '±3' },
];

function DnaSatir({ etiket, ozet }) {
  return (
    <View style={styles.dnaLine}>
      <Text style={styles.dnaLineLbl}>{etiket}:</Text>
      <Text style={styles.dnaLineVal}>{ozet?.text || 'Geçmiş sonuç yok'}</Text>
    </View>
  );
}

/**
 * @param roundId  gösterilen hafta
 * @param no       maç sırası (1-15)
 * @param source   sağlayıcı kimliği (nesine/misli/…)
 * @param day      seçili gün — DNA seçili güne bağlıdır
 * @param tick     dışarıdan tetiklenen sessiz tazeleme sayacı (Radar 3'ün
 *                 60 sn'lik otomatik yenilemesiyle panel de tazelensin diye)
 */
export default function PlayedDnaPanel({ roundId, no, source, day, tick = 0 }) {
  const [dnaWeeks, setDnaWeeks] = useState(null);   // null | 5 | 10 | 15 (MAÇ)
  const [dnaTol, setDnaTol] = useState(2);          // 0 birebir · 1 · 2 · 3
  const [dnaData, setDnaData] = useState(null);
  const [dnaBusy, setDnaBusy] = useState(false);
  const sorguRef = useRef(null);

  useEffect(() => {
    if (roundId == null || !source) return undefined;
    // AYNI sorgunun periyodik tazelemesi SESSİZ olur: "taranıyor…" yazısı her
    // dakika yanıp sönmez ve ağ hatasında panel boşalmaz (son değer kalır).
    const sorgu = `${roundId}|${no}|${source}|${day}|${dnaWeeks}|${dnaTol}`;
    const sessiz = sorguRef.current === sorgu;
    sorguRef.current = sorgu;
    let iptal = false;
    if (!sessiz) setDnaBusy(true);
    api.radarPlayedDna(roundId, Number(no), source, day, dnaWeeks, dnaTol)
      .then((d) => { if (!iptal) setDnaData(d); })
      .catch(() => { if (!iptal && !sessiz) setDnaData(null); })
      .finally(() => { if (!iptal) setDnaBusy(false); });
    return () => { iptal = true; };
  }, [roundId, no, source, day, dnaWeeks, dnaTol, tick]);

  const d = dnaData;
  const gunAdi = d?.weekday != null ? GUN_ADLARI[d.weekday] : null;
  const dag = d?.distribution;
  const hrk = d?.movement;

  return (
    // testID: panelin dürüstlük kurallarını EKRANIN geri kalanından ayrı
    // sınayabilmek için (ör. "panelde güven/olasılık iddiası yok" testi, ekran
    // başlığındaki "Tahmin güveni…" cümlesine takılmasın).
    <View style={styles.dnaBox} testID={`oynanma-dna-${no}-${source}`}>
      <View style={styles.dnaChips}>
        {MAC_SECENEKLERI.map((o) => (
          <TouchableOpacity
            key={String(o.v)}
            onPress={() => setDnaWeeks(o.v)}
            style={[styles.dnaChip, dnaWeeks === o.v && styles.dnaChipOn]}
            activeOpacity={0.8}
          >
            <Text style={[styles.dnaChipTxt, dnaWeeks === o.v && styles.dnaChipTxtOn]}>{o.l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {/* YAKINLIK — kullanıcı seçer; otomatik genişleme yok. */}
      <View style={styles.dnaChips}>
        {YAKINLIK_SECENEKLERI.map((o) => (
          <TouchableOpacity
            key={String(o.v)}
            onPress={() => setDnaTol(o.v)}
            style={[styles.dnaChip, dnaTol === o.v && styles.dnaChipOn]}
            activeOpacity={0.8}
          >
            <Text style={[styles.dnaChipTxt, dnaTol === o.v && styles.dnaChipTxtOn]}>{o.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {dnaBusy ? <Text style={styles.dnaMuted}>Geçmiş kayıtlar taranıyor…</Text> : null}
      {!dnaBusy && !d?.hasData ? (
        <Text style={styles.dnaMuted}>{d?.note || 'Bu dağılıma yakın geçmiş sonuç yok'}</Text>
      ) : null}

      {!dnaBusy && d?.hasData ? (
        <>
          <Text style={styles.dnaHead}>Mevcut oynanma</Text>
          <Text style={styles.dnaNow}>
            1 %{Math.round(Number(d.current['1']))} · X %{Math.round(Number(d.current.X))} · 2 %{Math.round(Number(d.current['2']))}
          </Text>

          <Text style={styles.dnaHead}>Benzer oynanma yüzdeleri</Text>
          {dag?.hasData ? (
            <>
              {/* TOPLAM önce gelir. Altındaki iki kırılım AYNI kayıtların
                  iki farklı görünümüdür — toplanmaz. */}
              <Text style={styles.dnaNow}>{dag.overall?.text}</Text>
              <Text style={styles.dnaSub}>Güne göre</Text>
              <DnaSatir etiket={gunAdi ? `${gunAdi} kayıtları` : 'Seçili gün'} ozet={dag.byDay?.selected} />
              <DnaSatir etiket="Diğer günler" ozet={dag.byDay?.others} />
              <Text style={styles.dnaSub}>Sıraya göre</Text>
              <DnaSatir etiket={`${d.position}. sıradaki maçlar`} ozet={dag.byPosition?.own} />
              <DnaSatir etiket="Diğer sıralar" ozet={dag.byPosition?.rest} />
              {/* HANGİ kayıtlar eşleşti — sayı soyut kalmasın. */}
              {dag.samples?.length ? (
                <>
                  <Text style={styles.dnaSub}>Eşleşen kayıtlar</Text>
                  {dag.samples.map((s, i) => (
                    <Text key={i} style={styles.dnaSample}>• {s.text}</Text>
                  ))}
                </>
              ) : null}
            </>
          ) : (
            <Text style={styles.dnaMuted}>Bu dağılıma yakın geçmiş sonuç yok</Text>
          )}

          <Text style={styles.dnaHead}>Oynanma değişimi</Text>
          {hrk?.words ? (
            <>
              {/* Değişim yüzdeyle gösterilir: hangi tablodan hangi tabloya. */}
              {hrk.openText && hrk.closeText ? (
                <Text style={styles.dnaNow}>{hrk.openText} → {hrk.closeText}</Text>
              ) : null}
              <Text style={styles.dnaLineLbl}>{hrk.words}</Text>
              {hrk.hasData ? (
                <>
                  <Text style={styles.dnaLineVal}>Benzer hareket: {hrk.overall?.text}</Text>
                  {hrk.samples?.length ? (
                    <>
                      <Text style={styles.dnaSub}>Eşleşen hareketler</Text>
                      {hrk.samples.map((s, i) => (
                        <Text key={i} style={styles.dnaSample}>• {s.text}</Text>
                      ))}
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={styles.dnaMuted}>Bu harekete yakın geçmiş sonuç yok</Text>
                  {/* GEVŞEK EŞLEŞME (yön kovası): birebir dağılım eşleşmesi
                      boşken aynı yön kovasındaki maçlar gösterilir. "Gevşek"
                      olduğu AÇIKÇA yazılır — birebir eşleşme gibi sunulmaz.
                      Küçük arşivde birebir eşleşme pratikte hiç tutmuyordu;
                      kullanıcı yine de gerçek kayıtları görebilmeli. */}
                  {hrk.fallback ? (
                    <>
                      <Text style={styles.dnaLineVal}>
                        Gevşek eşleşme · {hrk.fallback.label}: {hrk.fallback.overall?.text}
                      </Text>
                      {hrk.fallback.samples?.length ? (
                        <>
                          <Text style={styles.dnaSub}>Kovadaki kayıtlar</Text>
                          {hrk.fallback.samples.map((s, i) => (
                            <Text key={i} style={styles.dnaSample}>• {s.text}</Text>
                          ))}
                        </>
                      ) : null}
                    </>
                  ) : null}
                </>
              )}
            </>
          ) : (
            <Text style={styles.dnaMuted}>
              {hrk?.note || 'Değişim için en az iki günün kaydı gerekir.'}
            </Text>
          )}

          {/* Yakınlık ve kapsam bilinçli olarak EN SONDA ve soluk: ana
              sonucun önüne geçmemeli. */}
          <Text style={styles.dnaFoot}>
            {dnaTol === 0 ? 'Birebir aynı' : `Yakınlık ±${dnaTol}`}
            {d.settledMatches != null ? ` · arşivde ${d.settledMatches} sonuçlanmış maç` : ''}
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dnaBox: { marginTop: 6, marginLeft: 34, backgroundColor: colors.surfaceSoft, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: 9 },
  dnaChips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  dnaChip: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: colors.card },
  dnaChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  dnaChipTxt: { color: colors.textSoft, fontSize: 10.5, fontWeight: '800' },
  dnaChipTxtOn: { color: '#fff' },
  dnaHead: { color: colors.textMuted, fontSize: 10, fontWeight: '900', marginTop: 8, marginBottom: 3 },
  dnaNow: { color: colors.text, fontSize: 13, fontWeight: '900', marginBottom: 2 },
  dnaSub: { color: colors.textMuted, fontSize: 9.5, fontWeight: '900', marginTop: 6, marginBottom: 2 },
  dnaLine: { marginBottom: 4 },
  dnaLineLbl: { color: colors.textMuted, fontSize: 10.5, fontWeight: '800' },
  dnaLineVal: { color: colors.text, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  dnaMuted: { color: colors.textMuted, fontSize: 11.5, fontStyle: 'italic', lineHeight: 16 },
  dnaFoot: { color: colors.textMuted, fontSize: 9.5, marginTop: 8, opacity: 0.8 },
  dnaSample: { color: colors.textSoft, fontSize: 10.5, lineHeight: 15, marginBottom: 1 },
});
