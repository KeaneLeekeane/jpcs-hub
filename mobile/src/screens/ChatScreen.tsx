import { useEffect, useRef, useState } from 'react';
import {
  Alert, AppState, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { add, inc, isOnline, set, update } from '../firebase';
import { useCollection, useNow, useSession } from '../session';
import { useCalls } from '../CallLayer';
import { Avatar, Header, IconButton } from '../ui';
import { colors } from '../theme';
import type { Thread } from '../thread';

const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const fmtSeen = (ms: number) => new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

type Props = {
  thread: Thread;
  onBack?: () => void;
  aboveTabs?: boolean; // a tab bar sits below, so no extra bottom inset
};

export default function ChatScreen({ thread, onBack, aboveTabs }: Props) {
  useNow();
  const { uid, user, isStudent } = useSession();
  const { startCall } = useCalls();
  const insets = useSafeAreaInsets();
  const groupForStudent = thread.kind === 'student' && isStudent; // "JPCS Officers"
  const canModerate = user.role === 'admin' && thread.kind === 'student'; // Admin can remove any message
  const messages = useCollection(`${thread.base}/messages`, { orderBy: ['date_sent', 'desc'] });
  const presence = useCollection('presence');
  const [text, setText] = useState('');
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const listRef = useRef<FlatList>(null);
  const [selected, setSelected] = useState<string | null>(null); // message showing the Delete button

  useEffect(() => {
    const s = AppState.addEventListener('change', (st) => setAppActive(st === 'active'));
    return () => s.remove();
  }, []);

  let online = false;
  let status = 'Offline';
  if (groupForStudent) {
    online = (presence || []).some((p) => p.staff && p.id !== uid && isOnline(p));
    status = online ? 'An officer is active now' : 'Officers will reply soon';
  } else {
    const p = (presence || []).find((r) => r.id === thread.peerUid);
    online = isOnline(p);
    status = online ? 'Active now' : p?.last_active ? `Last active ${fmtSeen(p.last_active)}` : 'Offline';
  }

  // Read indicators: mark messages from others as read while this chat is open.
  useEffect(() => {
    if (!messages || !appActive) return;
    const unread = messages.filter((m) => m.sender_uid !== uid && m.status !== 'read');
    if (!unread.length) return;
    unread.forEach((m) => update(`${thread.base}/messages/${m.id}`, { status: 'read' }).catch(() => {}));
    const reset = thread.kind === 'dm' ? { [`unread_${uid}`]: 0 } : isStudent ? { student_unread: 0 } : { staff_unread: 0 };
    update(thread.base, reset).catch(() => {});
  }, [messages, appActive, thread.base, thread.kind, uid, isStudent]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    const now = Date.now();
    const name = user.full_name || user.username;
    await add(`${thread.base}/messages`, {
      member_id: thread.kind === 'student' ? (thread.memberId || user.member_id || '') : '',
      user_id: isStudent ? '' : uid, sender_uid: uid, sender_name: name,
      sender_type: isStudent ? 'student' : 'officer', message_text: body, date_sent: now, status: 'sent',
    });
    const meta: Record<string, any> = { last_message: body, last_time: now, last_sender_uid: uid };
    if (thread.kind === 'dm') {
      await update(thread.base, { ...meta, [`unread_${thread.peerUid}`]: inc(1) });
    } else {
      Object.assign(meta, { last_sender_type: isStudent ? 'student' : 'officer', [isStudent ? 'staff_unread' : 'student_unread']: inc(1) });
      if (isStudent) Object.assign(meta, { student_uid: uid, student_name: name, member_id: user.member_id || '' });
      else Object.assign(meta, { student_uid: thread.id, student_name: thread.title || 'Student', member_id: thread.memberId || '' });
      await set(thread.base, meta, true);
    }
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  // Tap (or press and hold) your own message to show Delete; it is removed for everyone.
  const askDelete = (m: any) => Alert.alert('Delete message?', 'It will be removed for everyone in this chat.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete', style: 'destructive', onPress: () => {
        setSelected(null);
        update(`${thread.base}/messages/${m.id}`, { deleted: true, message_text: '' })
          .catch((e) => Alert.alert('Could not delete', e?.message || 'Please check your internet connection and try again.'));
      },
    },
  ]);

  const call = () => startCall(groupForStudent
    ? { calleeType: 'staff', calleeUid: '', conversationId: uid, memberId: user.member_id || '', name: 'JPCS Officers' }
    : { calleeType: thread.kind === 'dm' ? 'user' : 'student', calleeUid: thread.peerUid || '', conversationId: thread.id, memberId: thread.memberId || '', name: thread.title || 'User' });

  return (
    <View style={s.page}>
      <Header
        title={thread.title} subtitle={status} online={online} onBack={onBack}
        avatar={groupForStudent
          ? <View style={s.groupIcon}><Ionicons name="people" size={20} color={colors.navy} /></View>
          : <Avatar uid={thread.peerUid} name={thread.title} size={38} />}
        right={<IconButton name="videocam" onPress={call} label="Video call" />}
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
            // Like Messenger: mine on the right (blue), others on the left with photo.
            // The list is inverted, so index - 1 is the NEXT (newer) message.
            const list = messages || [];
            const mine = m.sender_uid === uid;
            const newer = list[index - 1];
            const older = list[index + 1];
            const lastOfGroup = !newer || newer.sender_uid !== m.sender_uid;
            const firstOfGroup = !older || older.sender_uid !== m.sender_uid;
            const who = m.sender_type === 'student' ? (m.sender_name || 'Student') : `${m.sender_name || 'Officer'} · Officer`;
            return (
              <View style={[s.row, mine ? { justifyContent: 'flex-end' } : null]}>
                {!mine && (lastOfGroup ? <Avatar uid={m.sender_uid} name={m.sender_name || '?'} size={30} /> : <View style={{ width: 30 }} />)}
                <View style={{ maxWidth: '78%' }}>
                  {!mine && firstOfGroup && thread.kind === 'student' && <Text style={s.name}>{who}</Text>}
                  <Pressable
                    onPress={(mine || canModerate) && !m.deleted ? () => setSelected(selected === m.id ? null : m.id) : undefined}
                    onLongPress={(mine || canModerate) && !m.deleted ? () => askDelete(m) : undefined} delayLongPress={400}
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
                    <Pressable onPress={() => askDelete(m)} style={[s.delBtn, !mine && { alignSelf: 'flex-start' }]} accessibilityLabel="Delete message">
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
            <Text style={s.empty}>{groupForStudent ? 'Ask the JPCS Officers about membership, events or other concerns.' : 'No messages yet. Say hello!'}</Text>
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
  groupIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginTop: 4 },
  name: { fontSize: 11.5, fontWeight: '700', color: '#4c5568', marginBottom: 3, marginLeft: 4 },
  bubble: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 18, borderWidth: 1 },
  mine: { backgroundColor: '#1f6feb', borderColor: '#1f6feb', borderBottomRightRadius: 5 },
  theirs: { backgroundColor: '#fff', borderColor: colors.line, borderBottomLeftRadius: 5 },
  delBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', backgroundColor: '#fde8e8', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  deleted: { backgroundColor: 'transparent', borderColor: '#cfd6e4', borderStyle: 'dashed' },
  deletedText: { color: colors.muted, fontStyle: 'italic' },
  msg: { fontSize: 15.5, color: colors.text },
  meta: { fontSize: 11, color: colors.muted, marginTop: 5 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.line, gap: 10 },
  input: { flex: 1, borderWidth: 1, borderColor: '#dbe1ec', borderRadius: 22, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, fontSize: 15.5, maxHeight: 120, color: colors.text },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
});
