import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { api } from '../api';
import { colors, spacing, radius } from '../theme';
import { ProbBar, SurpriseBadge, PredictionBadge, FormStrip, RecordBadges, StatBar } from '../components';
import { countryCode } from '../utils';

export default function MatchDetailScreen({ route }) {
  const { no } = route.params;
  const [m, setM] = useState(null);
  const [error, setError] = useState(null);
  const [openSquad, setOpenSquad] = useState(null); // 'home' | 'away' | null
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    api.match(no).then(setM).catch((e) => setError(e.message));
  }, [no]);

  if (error) return <View style={styles.center}><Text style={styles.muted}>{error}</Text></View>;
  if (!m) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  const a = m.analysis;
  const s = m.stats || {};
  const homeName = m.home.mediumName;
  const awayName = m.away.mediumName;
  const comment = m.aiComment || a.comment;
  const fromAI = !!m.aiComment;
  const sinyaller = buildSinyaller(m);
  const kuponYorumu = buildKuponYorumu(m.prediction);
  const riskNotu = buildRiskNotu(a.surpriseScore);
  const pmeta = PRED_META[m.prediction?.label] || { guven: '—', risk: '—', color: colors.gray };
  const pickDesc = buildPickDesc(m.prediction);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
      {/* Maç başlığı */}
      <Text style={styles.league}>{m.league}</Text>
      <Text style={styles.teams}>{homeName}  -  {awayName}</Text>
      {m.status === 'finished' && m.score && (
        <Text style={styles.score}>Sonuç: {m.score.home} - {m.score.away}  ({m.result})</Text>
      )}

      {/* Sürpriz etiketi + puan + risk seviyesi + açıklama */}
      <View style={styles.row}>
        <SurpriseBadge label={a.label} labelColor={a.labelColor} />
        {a.surpriseScore != null && (() => {
          const risk = riskOf(a.surpriseScore);
          return (
            <Text style={styles.scoreNum}>
              Sürpriz Puanı: <Text style={styles.scoreBig}>{a.surpriseScore}</Text>/100
              {risk ? <Text> · <Text style={{ color: risk.color, fontWeight: '800' }}>{risk.word}</Text></Text> : null}
            </Text>
          );
        })()}
        <TouchableOpacity onPress={() => setInfoOpen((v) => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.infoIcon}>ℹ️</Text>
        </TouchableOpacity>
      </View>
      {infoOpen && (
        <View style={styles.infoBox}>
          {LABEL_EXPLAIN[a.label] ? (
            <Text style={styles.infoLine}>
              <Text style={styles.infoKey}>{a.label}: </Text>{LABEL_EXPLAIN[a.label]}
            </Text>
          ) : null}
          <Text style={[styles.infoLine, { marginTop: 6 }]}>
            <Text style={styles.infoKey}>Sürpriz Puanı: </Text>{SURPRISE_EXPLAIN}
          </Text>
        </View>
      )}

      {/* Kupon Tahmini — premium karar kartı */}
      {m.prediction && m.prediction.symbol !== '-' && (
        <View style={[styles.predCard, { borderLeftColor: pmeta.color }]}>
          <View style={styles.pcTop}>
            <View style={styles.pcLeft}>
              <View style={[styles.pcSymbol, { borderColor: pmeta.color }]}>
                <Text style={[styles.pcSymbolTxt, { color: pmeta.color }]}>{m.prediction.symbol}</Text>
              </View>
              <Text style={styles.pcWho}>{SYM_WHO[m.prediction.symbol] || ''}</Text>
            </View>
            <View style={styles.pcMid}>
              <Text style={styles.pcKicker}>KUPON TAHMİNİ</Text>
              <Text style={styles.pcMain}>{m.prediction.meaning}</Text>
              {pickDesc ? <Text style={styles.pcDesc}>{pickDesc}</Text> : null}
              {sinyaller.slice(0, 3).map((sg, i) => (
                <Text key={i} style={styles.pcBullet}>•  {sg}</Text>
              ))}
            </View>
          </View>
          <View style={styles.pcRight}>
            <View style={[styles.pcBadge, { backgroundColor: pmeta.color + '22', borderColor: pmeta.color }]}>
              <Text style={[styles.pcBadgeTxt, { color: pmeta.color }]}>{m.prediction.label}</Text>
            </View>
            <View style={styles.pcMetaRow}><Text style={styles.pcMetaK}>Güven</Text><Text style={styles.pcMetaV}>{pmeta.guven}</Text></View>
            <View style={styles.pcMetaRow}><Text style={styles.pcMetaK}>Risk</Text><Text style={styles.pcMetaV}>{pmeta.risk}</Text></View>
          </View>
        </View>
      )}

      {/* Analiz — profesyonel, çok bölümlü */}
      <View style={styles.commentCard}>
        <Text style={styles.commentLabel}>🧠 Analiz{fromAI && <Text style={styles.aiTag}>  Claude</Text>}</Text>

        <Text style={styles.aSub}>Genel Değerlendirme</Text>
        <Text style={styles.comment}>{humanize(comment)}</Text>

        {sinyaller.length > 0 && (
          <>
            <Text style={styles.aSub}>Güçlü Sinyaller</Text>
            {sinyaller.map((sg, i) => (
              <Text key={i} style={styles.aBullet}>•  {sg}</Text>
            ))}
          </>
        )}

        {kuponYorumu ? (
          <>
            <Text style={styles.aSub}>Kupon Yorumu</Text>
            <Text style={styles.comment}>{kuponYorumu}</Text>
          </>
        ) : null}

        {riskNotu ? (
          <>
            <Text style={styles.aSub}>Risk Notu</Text>
            <Text style={styles.comment}>{riskNotu}</Text>
          </>
        ) : null}
      </View>

      {/* İhtimaller */}
      <Text style={styles.sectionTitle}>Kazanma İhtimalleri</Text>
      <View style={styles.probCard}>
        <ProbBars probabilities={a.probabilities} />
        {a.estimated && <Text style={styles.estNote}>≈ tahmini (oran yok, form + gol beklentisinden)</Text>}
      </View>

      {/* Puan Durumu — Takım Kıyası ile aynı karşılaştırma grafiği yapısı */}
      {(s.home?.standing || s.away?.standing) && (() => {
        const hs = s.home?.standing || {};
        const as = s.away?.standing || {};
        const minGd = Math.min(hs.goalDiff ?? 0, as.goalDiff ?? 0, 0);
        const sign = (n) => (n >= 0 ? '+' : '') + n;
        return (
          <>
            <Text style={styles.sectionTitle}>Puan Durumu</Text>
            <View style={styles.card}>
              {/* Takım adları — bar yarımlarının üstüne hizalı */}
              <View style={styles.puanHead}>
                <View style={styles.puanSpacer} />
                <Text style={[styles.puanTeam, { color: colors.green }]} numberOfLines={1}>● {homeName}</Text>
                <Text style={[styles.puanTeam, styles.puanTeamR, { color: colors.orange }]} numberOfLines={1}>{awayName} ●</Text>
                <View style={styles.puanSpacer} />
              </View>

              {/* Karşılaştırmalı bar satırları */}
              <StatRow label="Sıra" home={ord(hs.position)} away={ord(as.position)} homeBar={as.position || 1} awayBar={hs.position || 1} />
              <StatRow label="Puan" home={hs.points ?? '–'} away={as.points ?? '–'} homeBar={hs.points} awayBar={as.points} />
              <StatRow label="Averaj" home={sign(hs.goalDiff ?? 0)} away={sign(as.goalDiff ?? 0)} homeBar={(hs.goalDiff ?? 0) - minGd + 1} awayBar={(as.goalDiff ?? 0) - minGd + 1} />

              {/* Rozet / bilgi satırları (bardan ayrı) */}
              <View style={styles.cardDivider} />
              <StatRow label="O-G-B-M"
                left={<RecordBadges wins={hs.wins} draws={hs.draws} losses={hs.losses} played={hs.played} />}
                right={<RecordBadges wins={as.wins} draws={as.draws} losses={as.losses} played={as.played} align="right" />} />
              <StatRow label="İç / Dış form" sub="(ev içeride · dep dışarıda)"
                left={<RecordBadges wins={hs.home?.wins} draws={hs.home?.draws} losses={hs.home?.losses} />}
                right={<RecordBadges wins={as.away?.wins} draws={as.away?.draws} losses={as.away?.losses} align="right" />} />
              <StatRow label="Son 5 maç" sub="(içerde · dışarıda)"
                left={<FormStrip form={s.home?.last5venue} size={20} />}
                right={<FormStrip form={s.away?.last5venue} size={20} />} />

              {s.h2h && s.h2h.played > 0 && (
                <>
                  <View style={styles.cardDivider} />
                  <Text style={styles.subLabel}>Karşılıklı Geçmiş · {s.h2h.played} maç</Text>
                  <View style={styles.miniRow}>
                    <H2hCell n={s.h2h.homeWins} label={`${homeName} galibiyeti`} icon="🟢" color={colors.primary} />
                    <H2hCell n={s.h2h.draws} label="Beraberlik" icon="🤝" color={colors.gray} />
                    <H2hCell n={s.h2h.awayWins} label={`${awayName} galibiyeti`} icon="🟠" color={colors.orange} />
                  </View>
                </>
              )}

              {s.potentials && (
                <>
                  <View style={styles.cardDivider} />
                  <Text style={styles.subLabel}>Maç Beklentileri</Text>
                  <View style={styles.miniRow}>
                    <Pot label="2.5 Üst" val={`%${s.potentials.over25}`} icon="🔥" />
                    <Pot label="KG Var" val={`%${s.potentials.btts}`} icon="⚽" />
                    <Pot label="Korner" val={s.potentials.corners?.toFixed(1)} icon="🚩" />
                  </View>
                </>
              )}
            </View>
          </>
        );
      })()}

      {/* Lig Tablosu (tam, Son 5 ile) */}
      {s.leagueTable && ((s.leagueTable.overall?.length || s.leagueTable.length) > 0) && (
        <>
          <Text style={styles.sectionTitle}>Lig Tablosu</Text>
          <LeagueTableFull table={s.leagueTable} homeId={s.home?.standing?.teamId} awayId={s.away?.standing?.teamId} homeLogo={s.home?.logo} awayLogo={s.away?.logo} />
          <Text style={styles.legend}>
            <Text style={{ color: colors.green }}>G</Text> Galibiyet · <Text style={{ color: colors.yellow }}>B</Text> Beraberlik · <Text style={{ color: colors.red }}>M</Text> Mağlubiyet
          </Text>
          <Text style={styles.legend}>
            <Text style={{ color: colors.green }}>▍</Text> Üst sıra / şampiyonluk bölgesi   ·   <Text style={{ color: colors.red }}>▍</Text> Alt sıra / düşme bölgesi
          </Text>
        </>
      )}

      {/* Kadrolar (tam) */}
      {(s.home?.squad?.length || s.away?.squad?.length) ? (
        <>
          <Text style={styles.sectionTitle}>Kadrolar</Text>
          <SquadSection title={homeName} squad={s.home?.squad} open={openSquad === 'home'} onToggle={() => setOpenSquad(openSquad === 'home' ? null : 'home')} />
          <SquadSection title={awayName} squad={s.away?.squad} open={openSquad === 'away'} onToggle={() => setOpenSquad(openSquad === 'away' ? null : 'away')} />
        </>
      ) : null}

      {/* Eksikler (sakatlar/cezalılar) — veri varsa */}
      {(s.injuries?.home?.length || s.injuries?.away?.length) ? (
        <>
          <Text style={styles.sectionTitle}>Eksikler</Text>
          <View style={styles.playersWrap}>
            <InjuryCol title={homeName} list={s.injuries?.home} />
            <InjuryCol title={awayName} list={s.injuries?.away} />
          </View>
        </>
      ) : null}

      {/* Sezon ortalaması kıyası (karşılıklı çubuklar) */}
      {s.compare && s.compare.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Takım Kıyası</Text>
          <View style={styles.card}>
            <View style={styles.cmpStatHead}>
              <Text style={[styles.cmpStatTeam, { color: colors.green }]} numberOfLines={1}>● {homeName}</Text>
              <Text style={[styles.cmpStatTeam, { color: colors.orange, textAlign: 'right' }]} numberOfLines={1}>{awayName} ●</Text>
            </View>
            {s.compare.map((c, i) => (
              <StatBar key={i} label={c.label} home={c.home} away={c.away} suffix={c.suffix} />
            ))}
            <Text style={styles.estNote}>Galibiyet/beraberlik/mağlubiyet sezon toplamı · gol, şut vb. maç başı ortalama</Text>
          </View>
        </>
      )}

      {/* Sürprize iten unsurlar */}
      {a.factors && a.factors.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Sürprize İten Unsurlar</Text>
          <View style={styles.card}>
            {a.factors.map((f, i) => (
              <View key={i} style={[styles.factorRow, i === a.factors.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={styles.factorLabel}>{humanize(f.label)}</Text>
                <Text style={styles.factorPts}>+{f.points}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {!a.hasOdds && !a.estimated && (
        <Text style={styles.muted}>
          Bu maçın ligi seçili ligler arasında değil ya da oran/veri henüz açıklanmamış.
        </Text>
      )}
    </ScrollView>
  );
}

// --- küçük yardımcı bileşenler ---
function CmpRow({ label, h, a, bold, sub }) {
  return (
    <View style={styles.cmpRow}>
      <Text style={[styles.cmpVal, { textAlign: 'left' }, bold && styles.cmpValBold]}>{h ?? '–'}</Text>
      <View style={styles.cmpMidWrap}>
        <Text style={styles.cmpLabel}>{label}</Text>
        {sub && <Text style={styles.cmpSub}>{sub}</Text>}
      </View>
      <Text style={[styles.cmpVal, { textAlign: 'right' }, bold && styles.cmpValBold]}>{a ?? '–'}</Text>
    </View>
  );
}

// Kazanma ihtimali — kalın dolu barlar, yüzde bar içinde ortalı (1=mavi, X=gri, 2=sarı)
function ProbBars({ probabilities }) {
  if (!probabilities) return <Text style={styles.muted}>Oran yok</Text>;
  const segs = [
    { k: '1', v: probabilities['1'], c: colors.primary },
    { k: 'X', v: probabilities['X'], c: colors.gray },
    { k: '2', v: probabilities['2'], c: colors.yellow },
  ];
  return (
    <View style={styles.pbWrap}>
      {segs.map((s) => (
        <View key={s.k} style={[styles.pbSeg, { flex: Math.max(s.v, 1), backgroundColor: s.c }]}>
          <Text style={styles.pbK}>{s.k}</Text>
          <Text style={styles.pbV}>%{s.v}</Text>
        </View>
      ))}
    </View>
  );
}

// Takım Kıyası tarzı karşılaştırma satırı: ortada metrik, solda yeşil/ev, sağda turuncu/deplasman.
// Sayısal satırlarda bar; rozet/form satırlarında left/right öğeleri.
function StatRow({ label, sub, home, away, homeBar, awayBar, suffix, left, right }) {
  const custom = left != null || right != null;
  // Rozet/bilgi satırı: 3 kolon (sol değer · ortada başlık · sağ değer), bar yok
  if (custom) {
    return (
      <View style={styles.srRow}>
        <View style={styles.badgeRow}>
          <View style={styles.badgeSide}>{left}</View>
          <View style={styles.badgeMid}>
            <Text style={styles.srLabel}>{label}</Text>
            {sub ? <Text style={styles.srSub}>{sub}</Text> : null}
          </View>
          <View style={[styles.badgeSide, styles.badgeRight]}>{right}</View>
        </View>
      </View>
    );
  }
  const hb = Math.max(0, homeBar != null ? homeBar : Number(home) || 0);
  const ab = Math.max(0, awayBar != null ? awayBar : Number(away) || 0);
  const total = hb + ab || 1;
  return (
    <View style={styles.srRow}>
      <Text style={styles.srLabel}>{label}</Text>
      {sub ? <Text style={styles.srSub}>{sub}</Text> : null}
      <View style={styles.srBars}>
        <Text style={styles.srVal}>{home}{suffix || ''}</Text>
        <View style={styles.srHalf}>
          <View style={[styles.srFill, { width: `${(hb / total) * 100}%`, alignSelf: 'flex-end', backgroundColor: colors.green }]} />
        </View>
        <View style={styles.srHalf}>
          <View style={[styles.srFill, { width: `${(ab / total) * 100}%`, backgroundColor: colors.orange }]} />
        </View>
        <Text style={[styles.srVal, { textAlign: 'right' }]}>{away}{suffix || ''}</Text>
      </View>
    </View>
  );
}

function BadgeRow({ label, sub, home, away, played }) {
  return (
    <View style={styles.cmpRow}>
      <View style={{ flex: 1, alignItems: 'flex-start' }}>
        <RecordBadges wins={home?.wins} draws={home?.draws} losses={home?.losses} played={played ? home?.played : undefined} />
      </View>
      <View style={styles.cmpMidWrap}>
        <Text style={styles.cmpLabel}>{label}</Text>
        {sub ? <Text style={styles.cmpSub}>{sub}</Text> : null}
      </View>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <RecordBadges wins={away?.wins} draws={away?.draws} losses={away?.losses} played={played ? away?.played : undefined} align="right" />
      </View>
    </View>
  );
}

function PlayerCol({ title, players }) {
  return (
    <View style={styles.playerCol}>
      <Text style={styles.playerColTitle} numberOfLines={1}>{title}</Text>
      {players && players.length ? players.map((p, i) => (
        <View key={i} style={styles.playerRow}>
          <Text style={styles.playerRole}>{p.icon} {p.role}</Text>
          <Text style={styles.playerName} numberOfLines={1}>{p.name}</Text>
          <Text style={styles.playerLine}>{p.line}</Text>
        </View>
      )) : <Text style={styles.muted}>Veri yok</Text>}
    </View>
  );
}

function InjuryCol({ title, list }) {
  return (
    <View style={styles.playerCol}>
      <Text style={styles.playerColTitle} numberOfLines={1}>{title}</Text>
      {list && list.length ? list.map((p, i) => (
        <View key={i} style={styles.playerRow}>
          <Text style={styles.playerName} numberOfLines={1}>🚑 {p.name}</Text>
          {p.reason ? <Text style={styles.playerLine}>{p.reason}</Text> : null}
        </View>
      )) : <Text style={styles.muted}>Bilinen eksik yok</Text>}
    </View>
  );
}

function H2hCell({ n, label, icon, color }) {
  return (
    <View style={[styles.miniCard, { borderColor: color + '66', backgroundColor: color + '14' }]}>
      <Text style={styles.miniIcon}>{icon}</Text>
      <Text style={[styles.miniNum, { color }]}>{n}</Text>
      <Text style={styles.miniLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

function Pot({ label, val, icon }) {
  return (
    <View style={styles.miniCard}>
      <Text style={styles.miniIcon}>{icon}</Text>
      <Text style={styles.potValBig}>{val}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

// Tam kadro — açılır/kapanır, yatay kaydırmalı tablo
const POS_LONG = { K: 'Kaleci', D: 'Defans', O: 'Orta Saha', F: 'Forvet' };
function SquadSection({ title, squad, open, onToggle }) {
  if (!squad || !squad.length) return null;
  return (
    <View style={styles.squadCard}>
      <TouchableOpacity style={styles.squadHead} activeOpacity={0.7} onPress={onToggle}>
        <Text style={styles.squadTitle} numberOfLines={1}>{title}  ·  {squad.length} oyuncu</Text>
        <Text style={styles.squadChevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={[styles.sqRow, styles.sqHead]}>
              <Text style={[styles.sqH, styles.sqName]}>Oyuncu</Text>
              <Text style={[styles.sqH, styles.sqPos]}>Poz</Text>
              <Text style={[styles.sqH, styles.sqCell]}>Yaş</Text>
              <Text style={[styles.sqH, styles.sqCell]}>Maç</Text>
              <Text style={[styles.sqH, styles.sqCell]}>⚽</Text>
              <Text style={[styles.sqH, styles.sqCell]}>As</Text>
              <Text style={[styles.sqH, styles.sqCell]}>🟨</Text>
              <Text style={[styles.sqH, styles.sqCell]}>🟥</Text>
            </View>
            {squad.map((p, i) => (
              <View key={i} style={[styles.sqRow, i % 2 === 1 && styles.sqAlt]}>
                <View style={styles.sqNameCell}>
                  {countryCode(p.nat) ? (
                    <Image source={{ uri: `https://flagcdn.com/32x24/${countryCode(p.nat)}.png` }} style={styles.sqFlag} resizeMode="contain" />
                  ) : null}
                  <Text style={styles.sqNameText} numberOfLines={1}>{p.name}</Text>
                </View>
                <Text style={[styles.sqD, styles.sqPos, styles.tMuted]} numberOfLines={1}>{POS_LONG[p.pos] || p.pos}</Text>
                <Text style={[styles.sqD, styles.sqCell, styles.tMuted]}>{p.age || '-'}</Text>
                <Text style={[styles.sqD, styles.sqCell]}>{p.apps}</Text>
                <Text style={[styles.sqD, styles.sqCell, styles.tBold]}>{p.goals || ''}</Text>
                <Text style={[styles.sqD, styles.sqCell]}>{p.assists || ''}</Text>
                <Text style={[styles.sqD, styles.sqCell]}>{p.yellow || ''}</Text>
                <Text style={[styles.sqD, styles.sqCell]}>{p.red || ''}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// Tam lig tablosu — Genel / İç Saha / Dış Saha sekmeli, yatay kaydırmalı
function LeagueTableFull({ table, homeId, awayId, homeLogo, awayLogo }) {
  // Eski sürümle uyum: table dizi gelirse genel kabul et
  const variants = Array.isArray(table) ? { overall: table, home: [], away: [] } : (table || {});
  const sections = [
    ['Genel Lig Tablosu', variants.overall],
    ['İç Saha Lig Tablosu', variants.home],
    ['Dış Saha Lig Tablosu', variants.away],
  ];
  return (
    <View style={styles.ltGrid}>
      {sections.map(([title, rows]) =>
        rows && rows.length > 0 ? (
          <View key={title} style={styles.ltSection}>
            <Text style={styles.subLabel}>{title}</Text>
            <LeagueTableOne rows={rows} homeId={homeId} awayId={awayId} homeLogo={homeLogo} awayLogo={awayLogo} />
          </View>
        ) : null
      )}
    </View>
  );
}

// Lig tablosu satır logosu — gerçek arma varsa onu, yoksa nötr küçük placeholder.
function TableLogo({ logo }) {
  const [err, setErr] = useState(false);
  if (logo && !err) {
    return <Image source={{ uri: logo }} style={styles.tlImg} resizeMode="contain" onError={() => setErr(true)} />;
  }
  return <View style={styles.tlPh} />;
}

function LeagueTableOne({ rows, homeId, awayId, homeLogo, awayLogo }) {
  const N = rows.length;
  return (
    <View style={styles.tableCard}>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={styles.ltInner}>
          <View style={[styles.ltRow, styles.ltHead]}>
            <Text style={[styles.ltH, styles.lPos]}>Sıra</Text>
            <Text style={[styles.ltH, styles.lName]}>Takım</Text>
            <Text style={[styles.ltH, styles.lNum]}>O</Text>
            <Text style={[styles.ltH, styles.lNum, { color: colors.green }]}>G</Text>
            <Text style={[styles.ltH, styles.lNum, { color: colors.yellow }]}>B</Text>
            <Text style={[styles.ltH, styles.lNum, { color: colors.red }]}>M</Text>
            <Text style={[styles.ltH, styles.lNum]}>A</Text>
            <Text style={[styles.ltH, styles.lNum]}>Y</Text>
            <Text style={[styles.ltH, styles.lNum]}>AV</Text>
            <Text style={[styles.ltH, styles.lNum, { color: colors.primary }]}>P</Text>
            <Text style={[styles.ltH, styles.lForm]}>Son 5 maç</Text>
          </View>
          {rows.map((r, idx) => {
            const isHome = r.teamId === homeId;
            const isAway = r.teamId === awayId;
            const mine = isHome || isAway;
            const zone = r.position <= 3 ? styles.zoneTop : (r.position > N - 3 ? styles.zoneBot : null);
            return (
              <View key={r.teamId} style={[styles.ltRow, idx % 2 === 1 && styles.ltAlt, zone, isHome && styles.ltHiHome, isAway && styles.ltHiAway]}>
                <Text style={[styles.ltD, styles.lPos, styles.tMuted]}>{r.position}</Text>
                <View style={[styles.lName, styles.lNameCell]}>
                  <TableLogo logo={r.logo || (isHome ? homeLogo : isAway ? awayLogo : '')} />
                  <Text style={[styles.ltD, styles.lNameTxt, mine && styles.tBold]} numberOfLines={1}>{r.name}</Text>
                </View>
                <Text style={[styles.ltD, styles.lNum, styles.tMuted]}>{r.played}</Text>
                <Text style={[styles.ltD, styles.lNum, { color: colors.green }]}>{r.wins}</Text>
                <Text style={[styles.ltD, styles.lNum, { color: colors.yellow }]}>{r.draws}</Text>
                <Text style={[styles.ltD, styles.lNum, { color: colors.red }]}>{r.losses}</Text>
                <Text style={[styles.ltD, styles.lNum, styles.tMuted]}>{r.goalsFor}</Text>
                <Text style={[styles.ltD, styles.lNum, styles.tMuted]}>{r.goalsAgainst}</Text>
                <Text style={[styles.ltD, styles.lNum]}>{r.goalDiff >= 0 ? '+' : ''}{r.goalDiff}</Text>
                <Text style={[styles.ltD, styles.lNum, styles.ltPts]}>{r.points}</Text>
                <View style={styles.lForm}><FormStrip form={r.last5} size={14} /></View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// --- analiz metni: teknik terimleri anlaşılır Türkçeye çevir ---
const TERM_MAP = [
  [/beklenen gol \(xg\)/gi, 'gol beklentisi'],
  [/\bH2H\b/gi, 'karşılıklı maç geçmişi'],
  [/\bxG\b/gi, 'gol beklentisi'],
  [/\bedge\b/gi, 'avantaj'],
  [/model confidence/gi, 'model güveni'],
  [/raw probability/gi, 'kazanma ihtimali'],
];
function humanize(t) {
  let str = String(t || '');
  for (const [re, rep] of TERM_MAP) str = str.replace(re, rep);
  return str;
}
const capTr = (x) => (x ? x.charAt(0).toLocaleUpperCase('tr') + x.slice(1) : x);

// Tahmin gerekçesini madde madde "Güçlü Sinyaller" listesine çevirir.
function buildSinyaller(m) {
  return String(m.prediction?.reason || '')
    .split(/[;·]/)
    .map((x) => x.trim())
    .filter((x) => x && !/^oran yok/i.test(x))
    .map((x) => capTr(humanize(x)));
}

// Kupon yorumu — tahmin etiketiyle tutarlı, çelişkisiz cümle.
function buildKuponYorumu(p) {
  if (!p || p.symbol === '-') return '';
  const mean = p.meaning || '';
  if (p.label === 'BANKO') {
    return `${mean} seçeneği güçlü şekilde öne çıkıyor. Yine de geçmiş karşılaşmalardaki denge göz önünde bulundurularak kontrollü değerlendirilmeli.`;
  }
  if (p.label === 'NET' || p.label === 'TEMKİNLİ') {
    return `${mean} seçeneği öne çıkıyor; risk dengesi makul görünüyor.`;
  }
  return `Tek bir sonuç net değil; "${mean}" tercihiyle riski dağıtmak daha mantıklı.`;
}

// Risk notu — sürpriz puanından okunabilir seviye.
function buildRiskNotu(score) {
  if (score == null) return '';
  if (score < 25) return 'Risk seviyesi düşük — dengeli ve güçlü bir görünüm.';
  if (score <= 45) return 'Risk seviyesi orta — sonuç tartışmaya açık, kontrollü ilerleyin.';
  return 'Risk seviyesi yüksek — sürprize oldukça açık bir maç.';
}

// Sürpriz puanı → risk seviyesi (yazı + renk).
function riskOf(score) {
  if (score == null) return null;
  if (score <= 25) return { word: 'Düşük risk', color: colors.green };
  if (score <= 50) return { word: 'Orta risk', color: colors.yellow };
  if (score <= 75) return { word: 'Yüksek risk', color: colors.orange };
  return { word: 'Çok yüksek risk', color: colors.red };
}
const LABEL_EXPLAIN = {
  BANKO: 'Tahmin güçlü, risk düşük; güvenli görünen bir maç.',
  DİKKAT: 'Tahmin öne çıksa da bazı veriler risk oluşturuyor; kupon yaparken kontrollü değerlendirilmelidir.',
  'SÜRPRİZE AÇIK': 'Beklenmeyen sonuç ihtimali yüksek; sürprize oldukça açık bir maç.',
};
const SURPRISE_EXPLAIN = "Sürpriz Puanı, maçta beklenmeyen sonuç çıkma ihtimalini gösterir. 0'a yakın değer düşük sürpriz riski, 100'e yakın değer yüksek sürpriz riski anlamına gelir.";

// Kupon tipine göre güven/risk seviyesi ve vurgu rengi (görsel sunum).
const PRED_META = {
  BANKO: { guven: 'Yüksek', risk: 'Kontrollü', color: colors.green },
  NET: { guven: 'Yüksek', risk: 'Düşük', color: colors.primary },
  TEMKİNLİ: { guven: 'Orta', risk: 'Orta', color: colors.yellow },
  ÇİFTE: { guven: 'Orta', risk: 'Orta', color: colors.yellow },
  AÇIK: { guven: 'Düşük', risk: 'Yüksek', color: colors.red },
};
const SYM_WHO = {
  '1': 'Ev sahibi', '0': 'Beraberlik', '2': 'Deplasman',
  '10': 'Ev / Beraberlik', '02': 'Beraberlik / Dep.', '12': 'Ev / Deplasman', '102': 'Üç ihtimal',
};
function buildPickDesc(p) {
  if (!p || p.symbol === '-') return '';
  if (p.label === 'BANKO') return 'Mevcut tablo bu seçeneği güçlü gösteriyor. Risk tamamen sıfır değildir; kontrollü değerlendirilmelidir.';
  if (p.label === 'NET' || p.label === 'TEMKİNLİ') return 'Göstergeler bu yönü destekliyor; risk dengesi makul görünüyor.';
  return 'Sonuç net değil; bu seçenek riski daha dengeli dağıtıyor.';
}

// --- biçimleyiciler ---
const ord = (p) => (p ? `${p}.` : null);
const wdl = (s) => (s ? `${s.played} · ${s.wins}G ${s.draws}B ${s.losses}M` : null);
const gd = (s) => (s ? `${s.goalsFor}-${s.goalsAgainst} (${s.goalDiff >= 0 ? '+' : ''}${s.goalDiff})` : null);
const rec = (r) => (r ? `${r.wins}G ${r.draws}B ${r.losses}M` : null);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  league: { color: colors.textMuted, fontSize: 13 },
  teams: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 2 },
  score: { color: colors.primary, fontSize: 15, fontWeight: '700', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  scoreNum: { color: colors.textMuted, fontSize: 14, flexShrink: 1 },
  infoIcon: { fontSize: 15 },
  infoBox: { backgroundColor: colors.cardAlt, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm },
  infoLine: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18 },
  infoKey: { color: colors.text, fontWeight: '800' },
  scoreBig: { color: colors.text, fontSize: 18, fontWeight: '800' },

  predCard: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.md,
    backgroundColor: colors.cardAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    borderLeftWidth: 4, padding: spacing.lg, marginTop: spacing.lg,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  pcTop: { flex: 1, minWidth: 240, flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  pcLeft: { width: 60, alignItems: 'center', justifyContent: 'center' },
  pcSymbol: { width: 56, height: 56, borderRadius: radius.md, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  pcSymbolTxt: { fontSize: 24, fontWeight: '900', letterSpacing: 0.5 },
  pcWho: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 5, textAlign: 'center' },
  pcMid: { flex: 1, justifyContent: 'center' },
  pcKicker: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  pcMain: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 2 },
  pcDesc: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: 5 },
  pcBullet: { color: colors.text, fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  pcRight: { minWidth: 132, justifyContent: 'center', gap: 7, paddingLeft: spacing.sm },
  pcBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.sm, borderWidth: 1.5 },
  pcBadgeTxt: { fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  pcMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  pcMetaK: { color: colors.textMuted, fontSize: 12.5 },
  pcMetaV: { color: colors.text, fontSize: 12.5, fontWeight: '800' },

  commentCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.lg },
  commentLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  aiTag: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  comment: { color: colors.text, fontSize: 15, lineHeight: 22 },
  aSub: { color: colors.primary, fontSize: 13, fontWeight: '800', marginTop: spacing.md, marginBottom: 4 },
  aBullet: { color: colors.text, fontSize: 14, lineHeight: 21, marginBottom: 3 },

  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: spacing.xl, marginBottom: spacing.sm },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg },
  probCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg },
  pbWrap: { flexDirection: 'row', height: 46, borderRadius: 10, overflow: 'hidden', gap: 3 },
  pbSeg: { alignItems: 'center', justifyContent: 'center' },
  pbK: { color: colors.bg, fontSize: 12, fontWeight: '900' },
  pbV: { color: colors.bg, fontSize: 14, fontWeight: '800', marginTop: 1 },
  srRow: { marginVertical: 7 },
  srLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  srSub: { color: colors.textMuted, fontSize: 9, textAlign: 'center', marginBottom: 4 },
  srBars: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  srVal: { width: 46, color: colors.text, fontSize: 13, fontWeight: '700' },
  srHalf: { flex: 1, height: 8, backgroundColor: colors.track, borderRadius: 4, overflow: 'hidden' },
  srFill: { height: 8, borderRadius: 4 },
  srSide: { flex: 1, alignItems: 'flex-start' },
  // rozet satırı 3 kolon
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badgeSide: { flex: 1, alignItems: 'flex-start', justifyContent: 'center' },
  badgeRight: { alignItems: 'flex-end' },
  badgeMid: { alignItems: 'center', paddingHorizontal: 4 },
  estNote: { color: colors.textMuted, fontSize: 11, fontStyle: 'italic', marginTop: 8 },

  // puan durumu karşılaştırması
  cmpHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: spacing.sm, marginBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  cmpTeam: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '800' },
  cmpMid: { width: 96 },
  cmpRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  cmpVal: { flex: 1, color: colors.text, fontSize: 14 },
  cmpValBold: { fontWeight: '800', fontSize: 15 },
  cmpMidWrap: { width: 110, alignItems: 'center' },
  cmpLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  cmpSub: { color: colors.textMuted, fontSize: 9, textAlign: 'center', marginTop: 1 },

  // ortak tablo
  tableCard: { backgroundColor: colors.card, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  tRowHi: { backgroundColor: colors.primary + '24' },
  tMuted: { color: colors.textMuted },
  tBold: { fontWeight: '800', color: colors.text },
  legend: { color: colors.textMuted, fontSize: 11, marginTop: 6, paddingHorizontal: 2 },

  // kadro tablosu
  squadCard: { backgroundColor: colors.card, borderRadius: radius.md, marginBottom: spacing.sm, overflow: 'hidden' },
  squadHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  squadTitle: { color: colors.primary, fontSize: 14, fontWeight: '800', flex: 1 },
  squadChevron: { color: colors.textMuted, fontSize: 12, marginLeft: 8 },
  sqRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  sqHead: { borderTopWidth: 0 },
  sqAlt: { backgroundColor: colors.cardAlt + '66' },
  sqH: { color: colors.textMuted, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  sqD: { color: colors.text, fontSize: 12.5, textAlign: 'center' },
  sqName: { width: 150, textAlign: 'left' },
  sqNameCell: { width: 150, flexDirection: 'row', alignItems: 'center', gap: 5 },
  sqNameText: { flex: 1, color: colors.text, fontSize: 12.5 },
  sqFlag: { width: 18, height: 13, borderRadius: 2, backgroundColor: colors.cardAlt },
  sqPos: { width: 66 },
  sqCell: { width: 36 },
  sqDk: { width: 46 },

  // lig tablosu (tam)
  ltRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: spacing.sm, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  ltHead: { backgroundColor: colors.cardAlt, borderBottomWidth: 1, borderBottomColor: colors.border },
  ltAlt: { backgroundColor: colors.cardAlt + '40' },
  ltHiHome: { backgroundColor: colors.primary + '2e' },
  ltHiAway: { backgroundColor: colors.orange + '2e' },
  zoneTop: { borderLeftColor: colors.green },
  zoneBot: { borderLeftColor: colors.red },
  ltH: { color: colors.textMuted, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  ltD: { color: colors.text, fontSize: 12.5, textAlign: 'center' },
  ltPts: { color: colors.primary, fontWeight: '900', fontSize: 14 },
  ltGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, alignItems: 'flex-start' },
  ltSection: { flex: 1, minWidth: 320 },
  ltInner: { minWidth: '100%' },
  lPos: { width: 30 },
  lName: { flex: 1, minWidth: 116, textAlign: 'left', paddingRight: 4 },
  lNameCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lNameTxt: { flex: 1, textAlign: 'left' },
  tlImg: { width: 18, height: 18, borderRadius: 3 },
  tlPh: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.border },
  lNum: { width: 24 },
  lForm: { width: 90, alignItems: 'flex-start', paddingLeft: 6 },

  // iç/dış saha sekmeleri (segment kontrol)
  segWrap: { flexDirection: 'row', backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 3, marginBottom: spacing.sm },
  segTab: { flex: 1, paddingVertical: 7, borderRadius: radius.sm, alignItems: 'center' },
  segTabOn: { backgroundColor: colors.primary },
  segTxt: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  segTxtOn: { color: colors.bg, fontWeight: '800' },

  // oyuncular / eksikler
  playersWrap: { flexDirection: 'row', gap: spacing.md },
  playerCol: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md },
  playerColTitle: { color: colors.primary, fontSize: 13, fontWeight: '800', marginBottom: spacing.sm },
  playerRow: { paddingVertical: 5, borderTopWidth: 1, borderTopColor: colors.border },
  playerRole: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  playerName: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 1 },
  playerLine: { color: colors.textMuted, fontSize: 11, marginTop: 1 },

  // kart içi alt bölümler (H2H + Maç Beklentileri, Puan Durumu kartının içinde)
  cardDivider: { height: 1, backgroundColor: colors.border, marginTop: spacing.lg, marginBottom: spacing.md },
  subLabel: { color: colors.text, fontSize: 14, fontWeight: '800', marginBottom: spacing.sm },

  // mini analiz kartları (H2H + Maç Beklentileri)
  miniRow: { flexDirection: 'row', gap: spacing.sm },
  miniCard: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardAlt },
  miniIcon: { fontSize: 19, marginBottom: 4 },
  miniNum: { fontSize: 28, fontWeight: '900' },
  potValBig: { color: colors.text, fontSize: 24, fontWeight: '900' },
  miniLabel: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 3, lineHeight: 15 },

  // h2h (eski)
  h2hRow: { flexDirection: 'row' },
  h2hCell: { flex: 1, alignItems: 'center' },
  h2hNum: { fontSize: 26, fontWeight: '900' },
  h2hLabel: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 2 },

  // sezon kıyas
  cmpStatHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  cmpStatTeam: { flex: 1, fontSize: 13, fontWeight: '800' },
  // Puan Durumu başlığı — takım adları bar yarımlarının üstüne hizalı
  puanHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  puanSpacer: { width: 46 },
  puanTeam: { flex: 1, fontSize: 13.5, fontWeight: '800' },
  puanTeamR: { textAlign: 'right' },

  // potansiyel
  potRow: { flexDirection: 'row' },
  potCell: { flex: 1, alignItems: 'center' },
  potVal: { color: colors.text, fontSize: 20, fontWeight: '900' },
  potLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },

  // faktörler
  factorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  factorLabel: { color: colors.text, fontSize: 14, flex: 1 },
  factorPts: { color: colors.red, fontSize: 14, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm, lineHeight: 18 },
});
