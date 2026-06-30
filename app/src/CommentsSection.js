import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing, radius } from './theme';
import { api } from './api';
import { useAuth } from './auth';
import { CommentAvatar } from './components';

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

function CommentCard({ comment, depth, canAct, onLike, onReply, onEdit, onDelete }) {
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
        </View>
      </View>
    </View>
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
              <TouchableOpacity onPress={() => setReplyTo(null)}><Text style={styles.replyX}>✕</Text></TouchableOpacity>
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

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
      ) : displayTops.length === 0 ? (
        <Text style={styles.empty}>{filter === 'Cevaplar' ? 'Henüz cevaplanan yorum yok.' : 'Henüz yorum yok. İlk yorumu sen yaz! 👀'}</Text>
      ) : (
        displayTops.map((c) => (
          <View key={c.id}>
            <CommentCard comment={c} depth={0} canAct={!!token} onLike={onLike} onReply={setReplyTo} onEdit={onEdit} onDelete={onDelete} />
            {repliesOf(c.id).map((r) => (
              <CommentCard key={r.id} comment={r} depth={1} canAct={!!token} onLike={onLike} onReply={setReplyTo} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </View>
        ))
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
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 },
  metaBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTxt: { color: colors.textMuted, fontSize: 12.5, fontWeight: '600' },
  likeIcon: { color: colors.textMuted, fontSize: 15, fontWeight: '900' },
});
