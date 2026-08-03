import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { colors, spacing, radius } from './theme';
import { api } from './api';
import { useAuth } from './auth';
import { CommentAvatar } from './components';
import { BILDIRIM_SEBEPLERI, NOT_SINIRI, aciklamaZorunluMu } from './moderationReasons';

function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'az önce';
  if (s < 3600) return `${Math.floor(s / 60)} dk`;
  if (s < 86400) return `${Math.floor(s / 3600)} sa`;
  return `${Math.floor(s / 86400)} g`;
}

function LikeButton({ comment, canAct, onPress }) {
  return (
    <TouchableOpacity style={styles.metaBtn} onPress={onPress} disabled={!canAct} activeOpacity={canAct ? 0.6 : 1}>
      <Text style={[styles.likeIcon, comment.likedByMe && { color: colors.red }]}>{comment.likedByMe ? '♥' : '♡'}</Text>
      <Text style={styles.metaTxt}>{comment.likeCount}</Text>
    </TouchableOpacity>
  );
}

function CommentCard({ comment, depth, canAct, onLike, onReply, onEdit, onDelete, onReport, onBlock }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(comment.text);
  const save = async () => {
    const t = val.trim();
    if (t && t !== comment.text) await onEdit(comment, t);
    setEditing(false);
  };
  return (
    <View style={[styles.card, depth > 0 && styles.reply]}>
      <CommentAvatar size={depth > 0 ? 28 : 34} author={comment.author} />
      <View style={{ flex: 1 }}>
        <View style={styles.head}>
          <Text style={styles.user} numberOfLines={1}>{comment.author?.username || 'Kullanıcı'}</Text>
          <Text style={styles.time}>· {timeAgo(comment.createdAt)}{comment.editedAt ? ' · düzenlendi' : ''}</Text>
        </View>
        {editing ? (
          <View>
            <TextInput style={styles.editInput} value={val} onChangeText={setVal} multiline maxLength={500} />
            <View style={styles.row}>
              <TouchableOpacity style={styles.smallBtn} onPress={save}><Text style={styles.smallBtnTxt}>Kaydet</Text></TouchableOpacity>
              <TouchableOpacity style={styles.smallBtnGhost} onPress={() => { setVal(comment.text); setEditing(false); }}><Text style={styles.smallGhostTxt}>Vazgeç</Text></TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={styles.text}>{comment.text}</Text>
        )}

        {/* GİZLENMİŞ YORUM — sunucu bunu YALNIZ yazarına gönderir. Yazarına
            göstermek şart: yoksa yorumu "kayboldu" sanır, sebebini bilemez.
            Kaç kişinin bildirdiği burada da YAZMAZ (bildireni tahmin ettirir). */}
        {comment.hidden && (
          <View style={styles.hiddenBox}>
            <Text style={styles.hiddenTxt}>{comment.hiddenNote || 'Bu yorum gizlendi. Şu an yalnız sen görüyorsun.'}</Text>
          </View>
        )}

        <View style={styles.metaRow}>
          <LikeButton comment={comment} canAct={canAct} onPress={() => onLike(comment)} />
          <View style={styles.metaBtn}><Text style={styles.metaTxt}>👁 {comment.viewCount}</Text></View>
          {canAct && depth === 0 && (
            <TouchableOpacity style={styles.metaBtn} onPress={() => onReply(comment)}><Text style={styles.metaTxt}>Cevapla</Text></TouchableOpacity>
          )}
          {comment.mine && !editing && (
            <>
              <TouchableOpacity style={styles.metaBtn} onPress={() => setEditing(true)}><Text style={styles.metaTxt}>Düzenle</Text></TouchableOpacity>
              <TouchableOpacity style={styles.metaBtn} onPress={() => onDelete(comment)}><Text style={[styles.metaTxt, { color: colors.red }]}>Sil</Text></TouchableOpacity>
            </>
          )}
          {/* MODERASYON — yalnız BAŞKASININ yorumunda ve yalnız girişliyken.
              Kendi yorumunu bildirmek/kendini engellemek sunucuda da reddedilir;
              düğmeyi hiç göstermemek, reddedilecek bir yola sokmamaktır. */}
          {canAct && !comment.mine && (
            <>
              <TouchableOpacity style={styles.metaBtn} onPress={() => onReport(comment)}>
                <Text style={styles.metaTxt}>Bildir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.metaBtn} onPress={() => onBlock(comment)}>
                <Text style={styles.metaTxt}>Engelle</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// BİLDİRME PENCERESİ
// ---------------------------------------------------------------------------
// Sebep listesi KAPALIDIR (serbest metin sebep olamaz) ve anahtarlar
// `moderationReasons.js` üzerinden sunucuyla aynı tutulur.
//
// Pencere, bildirimin SONUCUNU söz vermez. "Bu yorum kaldırılacak" demek,
// tutamayacağımız bir söz olurdu: karar moderasyona aittir ve kullanıcıya
// gizlenip gizlenmediği bildirilmez (bildireni tahmin ettirmemek için).
function ReportModal({ comment, busy, onCancel, onSubmit }) {
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState(null);

  const zorunlu = aciklamaZorunluMu(reason);
  const eksik = !reason || (zorunlu && !note.trim());

  const gonder = async () => {
    setErr(null);
    try { await onSubmit(reason, note.trim()); }
    catch (e) { setErr(e.message); }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.mdBack}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onCancel} />
        <View style={styles.mdSheet}>
          <View style={styles.mdHead}>
            <Text style={styles.mdTitle}>Yorumu bildir</Text>
            <TouchableOpacity onPress={onCancel} accessibilityRole="button" accessibilityLabel="Kapat"><Text style={styles.mdX}>✕</Text></TouchableOpacity>
          </View>
          <Text style={styles.mdWho} numberOfLines={1}>
            {comment.author?.username || 'Kullanıcı'} · “{comment.text}”
          </Text>

          <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.mdLabel}>Sebep</Text>
            <View style={styles.reasonWrap}>
              {BILDIRIM_SEBEPLERI.map((s) => {
                const on = reason === s.key;
                return (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.reasonChip, on && styles.reasonChipOn]}
                    onPress={() => setReason(s.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.reasonTxt, on && styles.reasonTxtOn]}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {reason && (
              <Text style={styles.reasonHint}>
                {BILDIRIM_SEBEPLERI.find((s) => s.key === reason)?.hint}
              </Text>
            )}

            <Text style={styles.mdLabel}>
              Açıklama {zorunlu ? '(gerekli)' : '(isteğe bağlı)'}
            </Text>
            <TextInput
              style={styles.mdInput}
              value={note}
              onChangeText={setNote}
              placeholder={zorunlu ? 'Neyi bildirdiğini kısaca yaz.' : 'Eklemek istediğin bir şey varsa yaz.'}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={NOT_SINIRI}
            />
            <Text style={styles.mdCounter}>{note.length}/{NOT_SINIRI}</Text>

            {/* DÜRÜSTLÜK: ne olacağına dair söz verilmez, ne olduğu da geri
                bildirilmez. Kullanıcı bunu önceden bilmeli. */}
            <Text style={styles.mdNote}>
              Bildirimin kaydedilir ve incelenir. Sonucun ne olduğu — yorumun gizlenip
              gizlenmediği — sana bildirilmez. Bildirdiğin kişi seni göremez.
            </Text>
          </ScrollView>

          {err && <Text style={styles.err}>{err}</Text>}

          <View style={styles.mdBar}>
            <TouchableOpacity style={styles.smallBtnGhost} onPress={onCancel} disabled={busy}>
              <Text style={styles.smallGhostTxt}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mdSend, (eksik || busy) && { opacity: 0.5 }]}
              onPress={gonder}
              disabled={eksik || busy}
            >
              {busy ? <ActivityIndicator size="small" color={colors.bg} /> : <Text style={styles.mdSendTxt}>Bildir</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// ENGELLEME ONAYI
// ---------------------------------------------------------------------------
// Engel geri alınabilir ve nerede geri alınacağı BURADA yazar; yoksa kullanıcı
// engellediği kişiyi bir daha bulamaz. Karşı tarafa haber verilmediği de
// söylenir: insanlar çoğu zaman bunu bilmediği için engellemekten çekinir.
function BlockModal({ comment, busy, onCancel, onConfirm }) {
  const [err, setErr] = useState(null);
  const ad = comment.author?.username || 'Bu kullanıcı';
  const uygula = async () => {
    setErr(null);
    try { await onConfirm(); }
    catch (e) { setErr(e.message); }
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.mdCenter}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onCancel} />
        <View style={styles.mdBox}>
          <Text style={styles.mdTitle}>{ad} engellensin mi?</Text>
          <Text style={styles.mdNote}>
            Engellersen onun yorumlarını görmezsin, o da seninkileri göremez.
            Karşı tarafa bildirim gitmez. İstediğin zaman Profil → Engellenen
            Kullanıcılar ekranından geri alabilirsin.
          </Text>
          {err && <Text style={styles.err}>{err}</Text>}
          <View style={styles.mdBar}>
            <TouchableOpacity style={styles.smallBtnGhost} onPress={onCancel} disabled={busy}>
              <Text style={styles.smallGhostTxt}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.mdDanger, busy && { opacity: 0.5 }]} onPress={uygula} disabled={busy}>
              {busy ? <ActivityIndicator size="small" color={colors.bg} /> : <Text style={styles.mdSendTxt}>Engelle</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function CommentsSection({ matchId }) {
  const { token } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState('En Yeni');
  const viewed = useRef(new Set());
  // Moderasyon (E9): açık pencere + o pencerenin sürmekte olan isteği + sonuç notu.
  const [reportFor, setReportFor] = useState(null);
  const [blockFor, setBlockFor] = useState(null);
  const [modBusy, setModBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await api.comments(matchId);
      setComments(r.comments);
      // Görüntülenme: her yorum için mount başına bir kez (fire-and-forget)
      r.comments.forEach((c) => {
        if (!viewed.current.has(c.id)) { viewed.current.add(c.id); api.viewComment(c.id).catch(() => {}); }
      });
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }, [matchId]);

  useEffect(() => { load(); }, [load]);

  const post = async () => {
    const t = text.trim();
    if (!t) return;
    setPosting(true); setErr(null);
    try {
      await api.addComment({ matchId, text: t, parentId: replyTo ? (replyTo.parentId || replyTo.id) : undefined });
      setText(''); setReplyTo(null); await load();
    } catch (e) { setErr(e.message); } finally { setPosting(false); }
  };
  const onLike = async (c) => {
    try { if (c.likedByMe) await api.unlikeComment(c.id); else await api.likeComment(c.id); await load(); } catch {}
  };
  const onEdit = async (c, t) => { try { await api.editComment(c.id, t); await load(); } catch (e) { setErr(e.message); } };
  const onDelete = async (c) => { try { await api.deleteComment(c.id); await load(); } catch (e) { setErr(e.message); } };

  // --- MODERASYON ---------------------------------------------------------
  // Hata pencerenin İÇİNDE gösterilir (pencere kapanmaz): kullanıcı yazdığı
  // açıklamayı kaybetmeden tekrar deneyebilsin diye. Pencere yalnız BAŞARIDA
  // kapanır.
  const onReport = (c) => { setErr(null); setNotice(null); setReportFor(c); };
  const sendReport = async (reason, note) => {
    setModBusy(true);
    try {
      const r = await api.reportComment(reportFor.id, reason, note);
      setReportFor(null);
      setNotice(r?.already
        ? 'Bu yorumu zaten bildirmiştin; bildirimin duruyor.'
        : 'Bildirimin alındı ve incelenmek üzere kaydedildi.');
    } finally { setModBusy(false); }
  };

  const onBlock = (c) => { setErr(null); setNotice(null); setBlockFor(c); };
  const doBlock = async () => {
    setModBusy(true);
    try {
      const uid = blockFor.author?.id;
      // Kimlik yoksa istek GÖNDERİLMEZ: sunucuya boş userId yollamak "Kullanıcı
      // bulunamadı." gibi yanıltıcı bir hata döndürürdü.
      if (!uid) throw new Error('Bu yorumun sahibi belirlenemedi.');
      const r = await api.blockUser(uid);
      setBlockFor(null);
      setNotice(r?.already
        ? 'Bu kullanıcı zaten engelliydi.'
        : 'Kullanıcı engellendi. Yorumları artık sana görünmüyor.');
      await load();
    } finally { setModBusy(false); }
  };

  const tops = comments.filter((c) => !c.parentId);
  const replies = comments.filter((c) => c.parentId);
  const repliesOf = (id) => comments.filter((c) => c.parentId === id);
  const popularCount = tops.filter((c) => c.likeCount > 0).length;
  const FILTERS = [
    { key: 'En Yeni', count: tops.length },
    { key: 'En Popüler', count: popularCount },
    { key: 'Cevaplar', count: replies.length },
  ];
  let displayTops = [...tops];
  if (filter === 'En Popüler') displayTops.sort((a, b) => b.likeCount - a.likeCount || new Date(b.createdAt) - new Date(a.createdAt));
  else if (filter === 'Cevaplar') displayTops = displayTops.filter((c) => repliesOf(c.id).length > 0).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  else displayTops.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <View style={styles.wrap}>
      <Text style={styles.header}>Yorumlar ({comments.length})</Text>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <TouchableOpacity key={f.key} onPress={() => setFilter(f.key)} style={[styles.fChip, on && styles.fChipOn]} activeOpacity={0.8}>
              <Text style={[styles.fChipTxt, on && styles.fChipTxtOn]}>{f.key}</Text>
              <View style={[styles.fBadge, on && styles.fBadgeOn]}><Text style={[styles.fBadgeTxt, on && styles.fBadgeTxtOn]}>{f.count}</Text></View>
            </TouchableOpacity>
          );
        })}
      </View>

      {token ? (
        <View style={styles.composer}>
          {replyTo && (
            <View style={styles.replyTag}>
              <Text style={styles.replyTagTxt} numberOfLines={1}>↳ {replyTo.author?.username} kullanıcısına cevap</Text>
              <TouchableOpacity onPress={() => setReplyTo(null)} accessibilityRole="button" accessibilityLabel="Yanıtı iptal et"><Text style={styles.replyX}>✕</Text></TouchableOpacity>
            </View>
          )}
          <TextInput
            style={styles.composerInput}
            value={text}
            onChangeText={setText}
            placeholder="Bu maç hakkında ne düşünüyorsun?"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
          />
          <View style={styles.composerBar}>
            <Text style={styles.counter}>{text.length}/500</Text>
            <TouchableOpacity style={[styles.postBtn, (posting || !text.trim()) && { opacity: 0.5 }]} onPress={post} disabled={posting || !text.trim()}>
              <Text style={styles.postTxt}>{posting ? '...' : 'Gönder'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={styles.guest}>Yorum yazmak ve beğenmek için Profil sekmesinden giriş yap. Yorumları herkes görebilir.</Text>
      )}

      {err && <Text style={styles.err}>{err}</Text>}

      {/* Moderasyon sonucu — dokununca kapanır. */}
      {notice && (
        <TouchableOpacity style={styles.notice} onPress={() => setNotice(null)} activeOpacity={0.8}>
          <Text style={styles.noticeTxt}>{notice}</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
      ) : displayTops.length === 0 ? (
        <Text style={styles.empty}>{filter === 'Cevaplar' ? 'Henüz cevaplanan yorum yok.' : 'Henüz yorum yok. İlk yorumu sen yaz! 👀'}</Text>
      ) : (
        displayTops.map((c) => (
          <View key={c.id}>
            <CommentCard comment={c} depth={0} canAct={!!token} onLike={onLike} onReply={setReplyTo} onEdit={onEdit} onDelete={onDelete} onReport={onReport} onBlock={onBlock} />
            {repliesOf(c.id).map((r) => (
              <CommentCard key={r.id} comment={r} depth={1} canAct={!!token} onLike={onLike} onReply={setReplyTo} onEdit={onEdit} onDelete={onDelete} onReport={onReport} onBlock={onBlock} />
            ))}
          </View>
        ))
      )}

      {reportFor && (
        <ReportModal
          comment={reportFor}
          busy={modBusy}
          onCancel={() => setReportFor(null)}
          onSubmit={sendReport}
        />
      )}
      {blockFor && (
        <BlockModal
          comment={blockFor}
          busy={modBusy}
          onCancel={() => setBlockFor(null)}
          onConfirm={doBlock}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.lg },
  header: { color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: spacing.sm },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  fChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  fChipOn: { backgroundColor: colors.accent + '22', borderColor: colors.accent },
  fChipTxt: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700' },
  fChipTxtOn: { color: colors.accent, fontWeight: '800' },
  fBadge: { minWidth: 18, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 9, backgroundColor: colors.cardAlt, alignItems: 'center' },
  fBadgeOn: { backgroundColor: colors.accent },
  fBadgeTxt: { color: colors.textMuted, fontSize: 10.5, fontWeight: '800' },
  fBadgeTxtOn: { color: colors.bg },
  composer: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  composerInput: { color: colors.text, fontSize: 14, minHeight: 44, textAlignVertical: 'top' },
  composerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  counter: { color: colors.textMuted, fontSize: 11 },
  postBtn: { backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 8, borderRadius: radius.sm },
  postTxt: { color: colors.bg, fontWeight: '800', fontSize: 13.5 },
  replyTag: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.cardAlt, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8 },
  replyTagTxt: { color: colors.textMuted, fontSize: 12, flex: 1 },
  replyX: { color: colors.textMuted, fontSize: 14, fontWeight: '900', paddingHorizontal: 6 },
  guest: { color: colors.textMuted, fontSize: 13, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  empty: { color: colors.textMuted, fontSize: 13.5, textAlign: 'center', marginTop: spacing.lg },
  err: { color: colors.red, fontSize: 13, marginBottom: spacing.sm },
  card: { flexDirection: 'row', gap: 10, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  reply: { marginLeft: spacing.lg, backgroundColor: colors.cardAlt },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  user: { color: colors.text, fontSize: 13.5, fontWeight: '800', maxWidth: 160 },
  time: { color: colors.textMuted, fontSize: 11.5 },
  text: { color: colors.text, fontSize: 14, marginTop: 3, lineHeight: 19 },
  editInput: { color: colors.text, fontSize: 14, marginTop: 4, backgroundColor: colors.bg, borderRadius: radius.sm, padding: 8, minHeight: 40, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 8, marginTop: 6 },
  smallBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm },
  smallBtnTxt: { color: colors.bg, fontWeight: '800', fontSize: 12.5 },
  smallBtnGhost: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  smallGhostTxt: { color: colors.textMuted, fontWeight: '700', fontSize: 12.5 },
  // metaRow sarmalı: "Bildir"/"Engelle" eklenince dar ekranda tek satıra
  // sığmıyordu; flexWrap olmadan düğmeler kartın dışına taşıyordu.
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  metaBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTxt: { color: colors.textMuted, fontSize: 12.5, fontWeight: '600' },
  likeIcon: { color: colors.textMuted, fontSize: 15, fontWeight: '900' },

  // --- MODERASYON (E9) ---
  hiddenBox: { marginTop: 6, backgroundColor: colors.warningSoft, borderLeftWidth: 3, borderLeftColor: colors.warning, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 7 },
  hiddenTxt: { color: colors.textSoft, fontSize: 12, lineHeight: 17 },
  notice: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 9, marginBottom: spacing.sm },
  noticeTxt: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18 },
  mdBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  mdCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  mdSheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, padding: spacing.lg, paddingBottom: spacing.xl },
  mdBox: { width: '100%', maxWidth: 420, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg },
  mdHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mdTitle: { color: colors.text, fontSize: 16.5, fontWeight: '800' },
  mdX: { color: colors.textMuted, fontSize: 16, fontWeight: '900', paddingHorizontal: 6 },
  mdWho: { color: colors.textMuted, fontSize: 12, marginTop: 4, marginBottom: spacing.sm },
  mdLabel: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: spacing.sm, marginBottom: 6 },
  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  reasonChipOn: { backgroundColor: colors.accent + '22', borderColor: colors.accent },
  reasonTxt: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700' },
  reasonTxtOn: { color: colors.accent, fontWeight: '800' },
  reasonHint: { color: colors.textMuted, fontSize: 11.5, lineHeight: 16, marginTop: 8 },
  mdInput: { color: colors.text, fontSize: 13.5, backgroundColor: colors.bg, borderRadius: radius.sm, padding: 10, minHeight: 60, textAlignVertical: 'top' },
  mdCounter: { color: colors.textMuted, fontSize: 11, textAlign: 'right', marginTop: 4 },
  mdNote: { color: colors.textMuted, fontSize: 11.5, lineHeight: 17, marginTop: spacing.sm },
  mdBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: spacing.md },
  mdSend: { backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 9, borderRadius: radius.sm, minWidth: 84, alignItems: 'center' },
  mdSendTxt: { color: colors.bg, fontWeight: '800', fontSize: 13.5 },
  mdDanger: { backgroundColor: colors.red, paddingHorizontal: 18, paddingVertical: 9, borderRadius: radius.sm, minWidth: 84, alignItems: 'center' },
});
