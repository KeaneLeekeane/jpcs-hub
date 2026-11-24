// Private 1-on-1 chat (dms/{pairId}) — like Messenger.
import { useEffect, useRef, useState } from 'react';
import {
  Alert, AppState, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { add, inc, isOnline, subDoc, update, type Row } from '../firebase';
import { useCollection, useNow, useSession } from '../session';
import { useCalls } from '../CallLayer';
import { Avatar, Header, IconButton } from '../ui';
import { colors } from '../theme';
import type { Thread } from '../thread';

const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const fmtSeen = (ms: number) => new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function ChatScreen({ thread, onBack, aboveTabs }: { thread: Thread; onBack?: () => void; aboveTabs?: boolean }) {
  useNow();
  const { uid, user, isStudent } = useSession();
  const { startCall } = useCalls();
  const insets = useSafeAreaInsets();
  const base = `dms/${thread.id}`;
  const all = useCollection(`${base}/messages`, { orderBy: ['date_sent', 'desc'] });
  // Messages from before "Delete conversation" stay hidden for this user only.
  const [chatDoc, setChatDoc] = useState<Row | null>(null);
  useEffect(() => subDoc(base, setChatDoc), [base]);
  const cleared = Number(chatDoc?.[`cleared_${uid}`] || 0);
  const messages = all && all.filter((m) => (m.date_sent || 0) > cleared);
  const presence = useCollection('presence');
  const [text, setText] = useState('');
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [selected, setSelected] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    const s = AppState.addEventListener('change', (st) => setAppActive(st === 'active'));
    return () => s.remove();
  }, []);

  const p = (presence || []).find((r) => r.id === thread.peerUid);
  const online = isOnline(p);
  const status = online ? 'Active now' : p?.last_active ? `Last active ${fmtSeen(p.last_active)}` : 'Offline';

  // Read indicators while this chat is open.
  useEffect(() => {
    if (!messages || !appActive) return;
    const unread = messages.filter((m) => m.sender_uid !== uid && m.status !== 'read');
    if (!unread.length) return;
    unread.forEach((m) => update(`${base}/messages/${m.id}`, { status: 'read' }).catch(() => {}));
    update(base, { [`unread_${uid}`]: 0 }).catch(() => {});
  }, [messages, appActive, base, uid]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    const now = Date.now();
    await add(`${base}/messages`, {
      sender_uid: uid, sender_name: user.full_name || user.username,
      sender_type: isStudent ? 'student' : 'officer',
      message_text: body, date_sent: now, status: 'sent',
    });
    await update(base, {
      last_message: body, last_time: now, last_sender_uid: uid, [`unread_${thread.peerUid}`]: inc(1),
      [`hidden_${uid}`]: false, [`hidden_${thread.peerUid}`]: false,
    });
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const askDelete = (m: any) => Alert.alert('Delete message?', 'It will be removed for both of you.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete', style: 'destructive', onPress: () => {
        setSelected(null);
        update(`${base}/messages/${m.id}`, { deleted: true, message_text: '' })
          .catch((e) => Alert.alert('Could not delete', e?.message || 'Check your internet connection and try again.'));
      },
    },
  ]);

  // Delete the whole conversation for me (like Messenger); the other person keeps theirs.
  const deleteChat = () => Alert.alert('Delete conversation?', `Your whole chat with ${thread.title} will be deleted. ${thread.title} will still have their copy.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      try {
        await update(base, { [`hidden_${uid}`]: true, [`cleared_${uid}`]: Date.now(), [`unread_${uid}`]: 0 });
        onBack?.();
      } catch (e: any) { Alert.alert('Could not delete', e?.message || String(e)); }
    } },
  ]);

  const call = () => startCall({
    calleeType: 'user', calleeUid: thread.peerUid || '', conversationId: thread.id, memberId: '', name: thread.title || 'User',
  });

  return (
    <View style={s.page}>
      <Header
        title={thread.title} subtitle={status} online={online} onBack={onBack}
        avatar={<Avatar uid={thread.peerUid} name={thread.title} size={38} />}
        right={(
          <View style={{ flexDirection: 'row' }}>
            <IconButton name="videocam" onPress={call} label="Video call" />
            <IconButton name="trash-outline" onPress={deleteChat} label="Delete conversation" />
          </View>
        )}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <FlatList
          ref={listRef}
          style={{ flex: 1 }}
          inverted
          data={messages || []}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 12, gap: 4 }}
          renderItem={({ item: m, index }) => {
            // Inverted list: index - 1 is the newer message.
            const list = messages || [];
            const mine = m.sender_uid === uid;
            const newer = list[index - 1];
            const lastOfGroup = !newer || newer.sender_uid !== m.sender_uid;
            return (
              <View style={[s.row, mine ? { justifyContent: 'flex-end' } : null]}>
                {!mine && (lastOfGroup ? <Avatar uid={m.sender_uid} name={m.sender_name || '?'} size={30} /> : <View style={{ width: 30 }} />)}
                <View style={{ maxWidth: '78%' }}>
                  <Pressable
                    onPress={mine && !m.deleted ? () => setSelected(selected === m.id ? null : m.id) : undefined}
                    onLongPress={mine && !m.deleted ? () => askDelete(m) : undefined} delayLongPress={400}
                    style={[s.bubble, mine ? s.mine : s.theirs, m.deleted && s.deleted, selected === m.id && { opacity: 0.85 }]}>
                    <Text style={[s.msg, mine && !m.deleted && { color: '#fff' }, m.deleted && s.deletedText]}>
                      {m.deleted ? (mine ? 'You unsent a message' : 'Message deleted') : m.message_text}
                    </Text>
                    {(lastOfGroup || mine) && (
                      <Text style={[s.meta, mine && !m.deleted && { color: '#dbe7ff' }]}>
                        {fmtTime(m.date_sent)}{mine && !m.deleted ? ` · ${m.status === 'read' ? 'Seen' : 'Sent'}` : ''}
                      </Text>
                    )}
                  </Pressable>
                  {selected === m.id && (
                    <Pressable onPress={() => askDelete(m)} style={s.delBtn} accessibilityLabel="Delete message">
                      <Ionicons name="trash-outline" size={15} color="#c53030" />
                      <Text style={{ color: '#c53030', fontWeight: '700', marginLeft: 5 }}>Delete</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          }}
        />
        {messages && messages.length === 0 && (
          <View style={s.emptyWrap} pointerEvents="none">
            <Text style={s.empty}>No messages yet. Say hello!</Text>
          </View>
        )}
        {!!messages?.some((m) => m.sender_uid === uid && !m.deleted) && (
          <Text style={s.hint}>Tip: tap your message to delete it.</Text>
        )}
        <View style={[s.inputRow, { paddingBottom: aboveTabs ? 10 : Math.max(insets.bottom, 10) }]}>
          <TextInput
            style={s.input} value={text} onChangeText={setText} placeholder="Type your message..."
            placeholderTextColor="#9aa3b5" multiline maxLength={2000}
          />
          <Pressable style={[s.send, !text.trim() && { opacity: 0.5 }]} onPress={send} accessibilityLabel="Send">
            <Ionicons name="send" size={19} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f8fafd' },
  emptyWrap: { position: 'absolute', top: 30, left: 0, right: 0 },
  empty: { textAlign: 'center', color: colors.muted, paddingHorizontal: 30 },
  hint: { textAlign: 'center', color: '#a0a8b8', fontSize: 11, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginTop: 4 },
  bubble: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 18, borderWidth: 1 },
  mine: { backgroundColor: '#1f6feb', borderColor: '#1f6feb', borderBottomRightRadius: 5 },
  theirs: { backgroundColor: '#fff', borderColor: colors.line, borderBottomLeftRadius: 5 },
  deleted: { backgroundColor: 'transparent', borderColor: '#cfd6e4', borderStyle: 'dashed' },
  deletedText: { color: colors.muted, fontStyle: 'italic' },
  delBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', backgroundColor: '#fde8e8', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  msg: { fontSize: 15.5, color: colors.text },
  meta: { fontSize: 11, color: colors.muted, marginTop: 5 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.line, gap: 10 },
  input: { flex: 1, borderWidth: 1, borderColor: '#dbe1ec', borderRadius: 22, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, fontSize: 15.5, maxHeight: 120, color: colors.text },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
});
