import { useEffect, useRef, useState } from 'react';
import {
  AppState, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { add, inc, isOnline, set, update } from '../firebase';
import { useCollection, useNow, useSession } from '../session';
import { useCalls } from '../CallLayer';
import { Avatar, Header, IconButton } from '../ui';
import { colors } from '../theme';

const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const fmtSeen = (ms: number) => new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

type Props = {
  convoId: string; // = the student's uid
  title: string;
  memberId: string;
  onBack?: () => void;
  onMenu?: () => void;
  aboveTabs?: boolean; // a tab bar sits below, so no extra bottom inset
};

export default function ChatScreen({ convoId, title, memberId, onBack, onMenu, aboveTabs }: Props) {
  useNow();
  const { uid, user, isStudent } = useSession();
  const { startCall } = useCalls();
  const insets = useSafeAreaInsets();
  const mySide = isStudent ? 'student' : 'officer';
  const messages = useCollection(`conversations/${convoId}/messages`, { orderBy: ['date_sent', 'desc'] });
  // Presence: a student sees whether any officer is active; an officer sees the student.
  const staffPresence = useCollection(isStudent ? 'presence' : null, { where: [['staff', true]] });
  const studentPresence = useCollection(isStudent ? null : 'presence');
  const [text, setText] = useState('');
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    const s = AppState.addEventListener('change', (st) => setAppActive(st === 'active'));
    return () => s.remove();
  }, []);

  let online = false;
  let status = 'Offline';
  if (isStudent) {
    online = (staffPresence || []).some(isOnline);
    status = online ? 'An officer is active now' : 'Officers will reply soon';
  } else {
    const p = (studentPresence || []).find((r) => r.id === convoId);
    online = isOnline(p);
    status = online ? 'Active now' : p?.last_active ? `Last active ${fmtSeen(p.last_active)}` : 'Offline';
  }

  // Read indicators: mark the other side's messages as read while this chat is open.
  useEffect(() => {
    if (!messages || !appActive) return;
    const unread = messages.filter((m) => m.sender_uid !== uid && m.status !== 'read');
    if (!unread.length) return;
    unread.forEach((m) => update(`conversations/${convoId}/messages/${m.id}`, { status: 'read' }).catch(() => {}));
    update(`conversations/${convoId}`, isStudent ? { student_unread: 0 } : { staff_unread: 0 }).catch(() => {});
  }, [messages, appActive, convoId, uid, isStudent]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    const now = Date.now();
    const name = user.full_name || user.username;
    await add(`conversations/${convoId}/messages`, {
      member_id: memberId || '', user_id: isStudent ? '' : uid, sender_uid: uid, sender_name: name,
      sender_type: mySide, message_text: body, date_sent: now, status: 'sent',
    });
    const convo: Record<string, any> = {
      last_message: body, last_time: now, last_sender_type: mySide,
      [isStudent ? 'staff_unread' : 'student_unread']: inc(1),
    };
    if (isStudent) Object.assign(convo, { student_uid: uid, student_name: name, member_id: user.member_id || '' });
    else Object.assign(convo, { student_uid: convoId, student_name: title || 'Student', member_id: memberId || '' });
    await set(`conversations/${convoId}`, convo, true);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const call = () => startCall(isStudent
    ? { calleeType: 'staff', calleeUid: '', conversationId: uid, memberId: user.member_id || '', name: 'JPCS Officers' }
    : { calleeType: 'student', calleeUid: convoId, conversationId: convoId, memberId: memberId || '', name: title || 'Student' });

  return (
    <View style={s.page}>
      <Header
        title={title} subtitle={status} online={online} onBack={onBack}
        avatar={<Avatar uid={isStudent ? undefined : convoId} name={title} size={38} />}
        right={(
          <>
            <IconButton name="videocam" onPress={call} label="Video call" />
            {onMenu && <IconButton name="person-circle-outline" onPress={onMenu} label="Account" />}
          </>
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
                  {!mine && firstOfGroup && <Text style={s.name}>{who}</Text>}
                  <View style={[s.bubble, mine ? s.mine : s.theirs]}>
                    <Text style={[s.msg, mine && { color: '#fff' }]}>{m.message_text}</Text>
                    {(lastOfGroup || mine) && (
                      <Text style={[s.meta, mine && { color: '#dbe7ff' }]}>
                        {fmtTime(m.date_sent)}{mine ? ` · ${m.status === 'read' ? 'Seen' : 'Sent'}` : ''}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
        {messages && messages.length === 0 && (
          <View style={s.emptyWrap} pointerEvents="none">
            <Text style={s.empty}>{isStudent ? 'Ask the JPCS Officers about membership, events or other concerns.' : 'No messages yet. Say hello!'}</Text>
          </View>
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
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginTop: 4 },
  name: { fontSize: 11.5, fontWeight: '700', color: '#4c5568', marginBottom: 3, marginLeft: 4 },
  bubble: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 18, borderWidth: 1 },
  mine: { backgroundColor: '#1f6feb', borderColor: '#1f6feb', borderBottomRightRadius: 5 },
  theirs: { backgroundColor: '#fff', borderColor: colors.line, borderBottomLeftRadius: 5 },
  msg: { fontSize: 15.5, color: colors.text },
  meta: { fontSize: 11, color: colors.muted, marginTop: 5 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.line, gap: 10 },
  input: { flex: 1, borderWidth: 1, borderColor: '#dbe1ec', borderRadius: 22, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, fontSize: 15.5, maxHeight: 120, color: colors.text },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
});
