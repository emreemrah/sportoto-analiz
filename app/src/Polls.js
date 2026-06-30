import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing, radius } from './theme';
import { api } from './api';
import { useAuth } from './auth';
import LineupBuilder from './LineupBuilder';

// ---------- ortak parçalar ----------
function Sheet({ onClose, title, children, footer }) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={st.sheet}>
          <View style={st.sheetHead}>
            <Text style={st.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Text style={st.sheetX}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ padding: spacing.lg }}>{children}</ScrollView>
          {footer ? <View style={st.sheetFooter}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

function SaveBtn({ busy, disabled, onPress, label = 'Kaydet' }) {
  return (
    <TouchableOpacity style={[st.saveBtn, (busy || disabled) && { opacity: 0.5 }]} onPress={onPress} disabled={busy || disabled}>
      {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={st.saveTxt}>{label}</Text>}
    </TouchableOpacity>
  );
}

function Stepper({ label, value, onChange }) {
  return (
    <View style={st.stepRow}>
      <Text style={st.stepLabel}>{label}</Text>
      <View style={st.stepCtrl}>
        <TouchableOpacity style={st.stepBtn} onPress={() => onChange(Math.max(0, value - 1))}><Text style={st.stepBtnTxt}>−</Text></TouchableOpacity>
        <Text style={st.stepVal}>{value}</Text>
        <TouchableOpacity style={st.stepBtn} onPress={() => onChange(Math.min(20, value + 1))}><Text style={st.stepBtnTxt}>+</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const POS_LBL = { K: 'Kaleci', D: 'Defans', O: 'Orta Saha', F: 'Forvet' };
const mockSquad = (prefix) => {
  let n = 0;
  const mk = (pos, count) => Array.from({ length: count }, (_, i) => { n++; return { name: `${POS_LBL[pos]} ${i + 1}`, pos, no: n, minutes: (count - i) * 200, apps: count - i }; });
  return [...mk('K', 2), ...mk('D', 6), ...mk('O', 6), ...mk('F', 4)];
};

// ---------- 1) Skor Tahmini ----------
function ScoreModal({ matchId, initial, onClose, onSaved }) {
  const [fhH, setFhH] = useState(initial?.fh_home ?? 0);
  const [fhA, setFhA] = useState(initial?.fh_away ?? 0);
  const [ftH, setFtH] = useState(initial?.ft_home ?? 0);
  const [ftA, setFtA] = useState(initial?.ft_away ?? 0);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await api.saveScore({ matchId, fhHome: fhH, fhAway: fhA, ftHome: ftH, ftAway: ftA }); onSaved('Tahminin kaydedildi'); }
    catch (e) { onSaved(null, e.message); } finally { setBusy(false); }
  };
  return (
    <Sheet onClose={onClose} title="🔢 Skor Tahmini" footer={<SaveBtn busy={busy} onPress={save} />}>
      <Text style={st.section}>İlk Yarı</Text>
      <Stepper label="Ev sahibi" value={fhH} onChange={setFhH} />
      <Stepper label="Deplasman" value={fhA} onChange={setFhA} />
      <Text style={st.section}>Maç Sonu</Text>
      <Stepper label="Ev sahibi" value={ftH} onChange={setFtH} />
      <Stepper label="Deplasman" value={ftA} onChange={setFtA} />
      <Text style={st.previewBig}>İY {fhH}-{fhA}   ·   MS {ftH}-{ftA}</Text>
    </Sheet>
  );
}

// ---------- 2) Maçın Oyuncusu ----------
function PlayerModal({ matchId, match, homeName, awayName, initial, onClose, onSaved }) {
  const homeList = (match.stats?.home?.squad?.length ? match.stats.home.squad : mockSquad(homeName));
  const awayList = (match.stats?.away?.squad?.length ? match.stats.away.squad : mockSquad(awayName));
  const [sel, setSel] = useState(initial ? { teamName: initial.team_name, playerName: initial.player_name } : null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!sel) return;
    setBusy(true);
    try { await api.savePlayerVote({ matchId, teamName: sel.teamName, playerName: sel.playerName }); onSaved('Oyuncu seçimin kaydedildi'); }
    catch (e) { onSaved(null, e.message); } finally { setBusy(false); }
  };
  const col = (team, list) => (
    <View>
      <Text style={st.section}>{team}</Text>
      {list.map((p, i) => {
        const on = sel && sel.teamName === team && sel.playerName === p.name;
        return (
          <TouchableOpacity key={i} style={[st.pvRow, on && st.pvRowOn]} onPress={() => setSel({ teamName: team, playerName: p.name })}>
            <View style={st.pvJerseyBox}><Text style={st.pvJersey}>{p.no != null ? p.no : '⚽'}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={[st.pvName, on && { color: colors.accent, fontWeight: '800' }]} numberOfLines={1}>{p.name}</Text>
              <Text style={st.pvMeta} numberOfLines={1}>{POS_LBL[p.pos] || p.pos || ''}{p.apps ? `  ·  ${p.apps} maç` : ''}</Text>
            </View>
            {on ? <Text style={st.pvCheck}>✓</Text> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
  return (
    <Sheet onClose={onClose} title="⭐ Maçın Oyuncusu" footer={<SaveBtn busy={busy} disabled={!sel} onPress={save} label="Seçimi Kaydet" />}>
      {col(homeName, homeList)}
      {col(awayName, awayList)}
    </Sheet>
  );
}

// ---------- 3) Kadro Tahmini → ayrı dosyada (LineupBuilder: saha + diziliş) ----------

// ---------- 4) Topluluk Anketi ----------
const POLLS = (homeName, awayName) => [
  { key: 'ms', q: 'Maçı kim kazanır?', options: [{ k: 'home', l: homeName }, { k: 'draw', l: 'Beraberlik' }, { k: 'away', l: awayName }] },
  { key: 'over25', q: 'Maçta 2.5 üst olur mu?', options: [{ k: 'yes', l: 'Evet' }, { k: 'no', l: 'Hayır' }] },
  { key: 'btts', q: 'Karşılıklı gol olur mu?', options: [{ k: 'yes', l: 'Evet' }, { k: 'no', l: 'Hayır' }] },
  { key: 'surprise', q: 'Sürpriz sonuç çıkar mı?', options: [{ k: 'yes', l: 'Evet' }, { k: 'no', l: 'Hayır' }] },
];
function CommunityPollModal({ matchId, homeName, awayName, onClose, onSaved }) {
  const polls = POLLS(homeName, awayName);
  const [results, setResults] = useState({});
  const [mine, setMine] = useState({});
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try { const r = await api.getPoll(matchId); setResults(r.results || {}); setMine(r.mine || {}); } catch {} finally { setLoading(false); }
  }, [matchId]);
  useEffect(() => { load(); }, [load]);
  const vote = async (pollKey, optKey) => {
    setMine((m) => ({ ...m, [pollKey]: optKey }));
    try { await api.savePoll({ matchId, pollKey, selectedOption: optKey }); await load(); } catch (e) { onSaved(null, e.message); }
  };
  return (
    <Sheet onClose={onClose} title="💬 Topluluk Anketi" footer={<SaveBtn onPress={() => onSaved('Oyun kaydedildi')} label="Kapat" />}>
      {loading ? <ActivityIndicator color={colors.accent} /> : polls.map((p) => {
        const res = results[p.key] || { total: 0, options: {} };
        return (
          <View key={p.key} style={{ marginBottom: spacing.lg }}>
            <Text style={st.pollQ}>{p.q}</Text>
            {p.options.map((o) => {
              const count = res.options[o.k] || 0;
              const pct = res.total ? Math.round((count / res.total) * 100) : 0;
              const on = mine[p.key] === o.k;
              return (
                <TouchableOpacity key={o.k} style={[st.optRow, on && st.optRowOn]} onPress={() => vote(p.key, o.k)} activeOpacity={0.8}>
                  <View style={[st.optFill, { width: `${pct}%`, backgroundColor: on ? colors.accent + '33' : colors.cardAlt }]} />
                  <Text style={[st.optTxt, on && { color: colors.accent, fontWeight: '800' }]}>{o.l}{on ? '  ✓' : ''}</Text>
                  <Text style={st.optPct}>%{pct}</Text>
                </TouchableOpacity>
              );
            })}
            <Text style={st.pollTotal}>{res.total} oy</Text>
          </View>
        );
      })}
    </Sheet>
  );
}

// ---------- Kart + bölüm ----------
function PollCard({ icon, title, desc, button, color, status, onPress }) {
  return (
    <View style={[st.card, { borderTopColor: color }]}>
      <Text style={st.cardTitle}>{icon} {title}</Text>
      <Text style={st.cardDesc}>{desc}</Text>
      {status ? <Text style={[st.cardStatus, { color }]}>✓ {status}</Text> : null}
      <TouchableOpacity style={[st.cardBtn, { backgroundColor: color }]} onPress={onPress} activeOpacity={0.85}>
        <Text style={st.cardBtnTxt}>{status ? 'Düzenle' : button}</Text>
      </TouchableOpacity>
    </View>
  );
}

function CommRow({ k, pct, color }) {
  return (
    <View style={st.commRow}>
      <Text style={st.commK} numberOfLines={1}>{k}</Text>
      <View style={st.commBar}><View style={[st.commFill, { width: `${pct}%`, backgroundColor: color }]} /></View>
      <Text style={st.commPct}>%{pct}</Text>
    </View>
  );
}

export default function PollsSection({ matchId, match, homeName, awayName, navigation }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(null);
  const [status, setStatus] = useState({});
  const [toast, setToast] = useState(null);
  const [loginPrompt, setLoginPrompt] = useState(false);
  const [community, setCommunity] = useState(null);

  const loadStatus = useCallback(async () => {
    api.community(matchId).then(setCommunity).catch(() => {});
    if (!token) { setStatus({}); return; }
    try {
      const [sc, pl, ln, po] = await Promise.all([
        api.getScore(matchId).catch(() => ({})), api.getPlayerVote(matchId).catch(() => ({})),
        api.getLineup(matchId).catch(() => ({})), api.getPoll(matchId).catch(() => ({})),
      ]);
      setStatus({ score: sc.prediction, player: pl.vote, lineup: ln, poll: po.mine });
    } catch {}
  }, [matchId, token]);
  useEffect(() => { loadStatus(); }, [loadStatus]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); };
  const onSaved = (okMsg, errMsg) => { setOpen(null); if (errMsg) showToast('Hata: ' + errMsg); else { showToast(okMsg); loadStatus(); } };
  const press = (key) => { if (!token) { setLoginPrompt(true); return; } setOpen(key); };

  const sc = status.score, pl = status.player, ln = status.lineup, po = status.poll;
  const scLabel = sc ? `Tahminin: İY ${sc.fh_home}-${sc.fh_away} / MS ${sc.ft_home}-${sc.ft_away}` : null;
  const allSquad = [...(match.stats?.home?.squad || []), ...(match.stats?.away?.squad || [])];
  const plJersey = pl ? (allSquad.find((x) => x.name === pl.player_name) || {}).no : null;
  const plLabel = pl ? `Seçimin: ${plJersey != null ? '#' + plJersey + ' ' : ''}${pl.player_name}` : null;
  const lnCount = ((ln?.home?.selected_players?.length) || 0) + ((ln?.away?.selected_players?.length) || 0);
  const lnLabel = lnCount ? `${lnCount} oyuncu seçildi` : null;
  const poLabel = po && Object.keys(po).length ? `${Object.keys(po).length} soruda oy kullandın` : null;

  return (
    <View>
      {toast ? <View style={st.toast}><Text style={st.toastTxt}>{toast}</Text></View> : null}

      <PollCard icon="🔢" title="Skor Tahmini" desc="İlk yarı ve maç sonu tahminini toplulukla paylaş." button="Tahminini Paylaş" color={colors.accent} status={scLabel} onPress={() => press('score')} />
      <PollCard icon="⭐" title="Maçın Oyuncusu" desc="Maçın öne çıkabilecek oyuncusunu seç." button="Oyuncunu Seç" color="#a855f7" status={plLabel} onPress={() => press('player')} />
      <PollCard icon="📋" title="Kadro Tahmini" desc="Takımların muhtemel 11'ini tahmin et." button="Tahminini Paylaş" color={colors.field} status={lnLabel} onPress={() => press('lineup')} />
      <PollCard icon="💬" title="Topluluk Anketi" desc="Maçla ilgili sorulara katıl, topluluk yüzdelerini gör." button="Ankete Katıl" color="#3b82f6" status={poLabel} onPress={() => press('poll')} />

      {community && (community.players.total > 0 || community.formations.total > 0 || community.scores.total > 0) ? (
        <View style={st.commCard}>
          <Text style={st.commTitle}>📊 Topluluk Sonuçları</Text>
          {community.scores.total > 0 && (
            <View style={st.commBlock}>
              <Text style={st.commLabel}>En çok tahmin edilen skor · {community.scores.total} kişi</Text>
              {community.scores.top.slice(0, 5).map((s) => <CommRow key={s.key} k={s.key} pct={s.pct} color={colors.accent} />)}
            </View>
          )}
          {community.players.total > 0 && (
            <View style={st.commBlock}>
              <Text style={st.commLabel}>Maçın oyuncusu · {community.players.total} kişi</Text>
              {community.players.top.slice(0, 5).map((p) => <CommRow key={p.key} k={p.key} pct={p.pct} color="#a855f7" />)}
            </View>
          )}
          {community.formations.total > 0 && (
            <View style={st.commBlock}>
              <Text style={st.commLabel}>En popüler diziliş · {community.formations.total} kişi</Text>
              {community.formations.top.slice(0, 3).map((f) => <CommRow key={f.key} k={f.key} pct={f.pct} color={colors.field} />)}
            </View>
          )}
        </View>
      ) : null}

      {open === 'score' && <ScoreModal matchId={matchId} initial={sc} onClose={() => setOpen(null)} onSaved={onSaved} />}
      {open === 'player' && <PlayerModal matchId={matchId} match={match} homeName={homeName} awayName={awayName} initial={pl} onClose={() => setOpen(null)} onSaved={onSaved} />}
      {open === 'lineup' && <LineupBuilder matchId={matchId} match={match} homeName={homeName} awayName={awayName} initial={ln} onClose={() => setOpen(null)} onSaved={onSaved} />}
      {open === 'poll' && <CommunityPollModal matchId={matchId} homeName={homeName} awayName={awayName} onClose={() => setOpen(null)} onSaved={onSaved} />}

      {loginPrompt && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setLoginPrompt(false)}>
          <View style={st.loginWrap}>
            <View style={st.loginBox}>
              <Text style={st.loginEmoji}>🔒</Text>
              <Text style={st.loginTitle}>Giriş gerekli</Text>
              <Text style={st.loginDesc}>Tahmin paylaşmak ve ankete katılmak için giriş yapmalısın.</Text>
              <TouchableOpacity style={st.loginBtn} onPress={() => { setLoginPrompt(false); navigation?.navigate('ProfileTab', { screen: 'Login' }); }}>
                <Text style={st.loginBtnTxt}>Giriş Yap</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setLoginPrompt(false)}><Text style={st.loginCancel}>Vazgeç</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm, borderTopWidth: 3 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  cardDesc: { color: colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: 10, lineHeight: 18 },
  cardStatus: { fontSize: 12.5, fontWeight: '700', marginBottom: 10 },
  cardBtn: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.sm },
  cardBtnTxt: { color: colors.bg, fontSize: 13.5, fontWeight: '800' },
  commCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.sm },
  commTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: 10 },
  commBlock: { marginBottom: 12 },
  commLabel: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700', marginBottom: 6 },
  commRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  commK: { color: colors.text, fontSize: 12.5, fontWeight: '700', width: 90 },
  commBar: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' },
  commFill: { height: 8, borderRadius: 4 },
  commPct: { color: colors.textMuted, fontSize: 12, fontWeight: '800', width: 38, textAlign: 'right' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { backgroundColor: colors.bgAlt, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: colors.border },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  sheetTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sheetX: { color: colors.textMuted, fontSize: 18, fontWeight: '900' },
  sheetFooter: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  saveBtn: { backgroundColor: colors.accent, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center' },
  saveTxt: { color: colors.bg, fontSize: 15, fontWeight: '800' },

  section: { color: colors.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginTop: spacing.md, marginBottom: spacing.sm },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  stepLabel: { color: colors.text, fontSize: 14.5, fontWeight: '700' },
  stepCtrl: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  stepBtnTxt: { color: colors.text, fontSize: 20, fontWeight: '900' },
  stepVal: { color: colors.text, fontSize: 20, fontWeight: '900', width: 28, textAlign: 'center' },
  previewBig: { color: colors.accent, fontSize: 17, fontWeight: '900', textAlign: 'center', marginTop: spacing.lg },

  pickRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: colors.card, marginBottom: 6 },
  pickRowOn: { backgroundColor: colors.accent + '18', borderWidth: 1, borderColor: colors.accent },
  pickTxt: { color: colors.text, fontSize: 14, flex: 1 },
  pickCheck: { fontSize: 16, fontWeight: '900', color: colors.accent, marginLeft: 8 },
  pvRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 10, borderRadius: radius.sm, backgroundColor: colors.card, marginBottom: 6 },
  pvRowOn: { backgroundColor: colors.accent + '18', borderWidth: 1, borderColor: colors.accent },
  pvJerseyBox: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.field + '22', borderWidth: 1, borderColor: colors.field, alignItems: 'center', justifyContent: 'center' },
  pvJersey: { color: colors.field, fontSize: 13, fontWeight: '900' },
  pvName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  pvMeta: { color: colors.textMuted, fontSize: 11.5, marginTop: 1 },
  pvCheck: { fontSize: 16, fontWeight: '900', color: colors.accent, marginLeft: 4 },

  pollQ: { color: colors.text, fontSize: 14.5, fontWeight: '800', marginBottom: 8 },
  optRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: colors.card, marginBottom: 6, overflow: 'hidden' },
  optRowOn: { borderWidth: 1, borderColor: colors.accent },
  optFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.sm },
  optTxt: { color: colors.text, fontSize: 14, flex: 1, fontWeight: '600' },
  optPct: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  pollTotal: { color: colors.textMuted, fontSize: 11, marginTop: 2 },

  toast: { backgroundColor: colors.field, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 14, marginBottom: spacing.sm },
  toastTxt: { color: colors.bg, fontSize: 13.5, fontWeight: '800', textAlign: 'center' },

  loginWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  loginBox: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', width: '100%', maxWidth: 340 },
  loginEmoji: { fontSize: 40 },
  loginTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 8 },
  loginDesc: { color: colors.textMuted, fontSize: 13.5, textAlign: 'center', marginTop: 6, marginBottom: spacing.lg, lineHeight: 19 },
  loginBtn: { backgroundColor: colors.accent, paddingVertical: 12, paddingHorizontal: 28, borderRadius: radius.md, width: '100%', alignItems: 'center' },
  loginBtnTxt: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  loginCancel: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginTop: 14 },
});
