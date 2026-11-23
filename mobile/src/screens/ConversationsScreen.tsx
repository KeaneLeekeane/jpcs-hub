// Chat list for everyone. Students: "JPCS Officers" + direct chats with officers.
// Staff: every student conversation + direct chats with anyone.
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isOnline, set, subDoc, type Row } from '../firebase';
import { useCollection, useNow, useSession } from '../session';
import { Avatar, Header, IconButton } from '../ui';
import { ROLES } from '../helpers';
import { pairId, isStaffRole, type Thread } from '../thread';
import { colors } from '../theme';

const fmtWhen = (ms: number) => {
  if (!ms || !Number.isFinite(ms)) return '';
  const d = new Date(ms);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

type Item = Thread & { last_time: number; sub: string; unread: number };

function NewMessage({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (u: Row) => void }) {
  const { uid, isStudent } = useSession();
  const users = useCollection(visible ? 'users' : null);
  const [q, setQ] = useState('');
  const rows = (users || []).filter((u) => u.id !== uid && u.status !== 'inactive' && (!isStudent || isStaffRole(u.role))
    && `${u.full_name} ${u.username} ${u.role}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || '')));
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Header title="New message" onBack={onClose} />
      <TextInput style={s.search} placeholder="Search name, username or role" value={q} onChangeText={setQ} placeholderTextColor="#9aa3b5" />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        ListEmptyComponent={<Text style={s.empty}>{users ? 'No people found.' : 'Loading…'}</Text>}
        renderItem={({ item }) => (
          <Pressable style={s.row} onPress={() => { onPick(item); onClose(); }}>
            <Avatar uid={item.id} name={item.full_name || item.username} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.name}>{item.full_name || item.username}</Text>
              <Text style={s.preview}>{ROLES[item.role] || item.role} · {item.username}</Text>
            </View>
          </Pressable>
        )}
      />
    </Modal>
  );
}

export default function ConversationsScreen({ onOpen }: { onOpen: (t: Thread) => void }) {
  useNow();
  const { uid, user, isStudent } = useSession();
  const convos = useCollection(isStudent ? null : 'conversations', { orderBy: ['last_time', 'desc'] });
  const dms = useCollection('dms', { where: [['members', uid, 'array-contains']] });
  const presence = useCollection('presence');
  const [myConvo, setMyConvo] = useState<Row | null>(null);
  useEffect(() => (isStudent ? subDoc(`conversations/${uid}`, setMyConvo) : undefined), [isStudent, uid]);
  const [picking, setPicking] = useState(false);
  const pres = (id?: string) => (presence || []).find((p: Row) => p.id === id);
  const officerOnline = (presence || []).some((p) => p.staff && p.id !== uid && isOnline(p));

  const items = useMemo(() => {
    const list: Item[] = [];
    if (isStudent) {
      list.push({ kind: 'student', id: uid, base: `conversations/${uid}`, title: 'JPCS Officers', last_time: Infinity, sub: myConvo?.last_message || 'Ask the JPCS officers', unread: myConvo?.student_unread || 0 });
    }
    for (const c of convos || []) list.push({ kind: 'student', id: c.id, base: `conversations/${c.id}`, title: c.student_name || 'Student', peerUid: c.id, memberId: c.member_id || '', last_time: c.last_time || 0, sub: c.last_message || '', unread: c.staff_unread || 0 });
    for (const d of dms || []) {
      const peer = (d.members || []).find((m: string) => m !== uid) || '';
      list.push({ kind: 'dm', id: d.id, base: `dms/${d.id}`, title: d.names?.[peer] || 'User', peerUid: peer, last_time: d.last_time || 0, sub: d.last_message || 'Direct message', unread: d[`unread_${uid}`] || 0 });
    }
    return list.sort((a, b) => b.last_time - a.last_time);
  }, [convos, dms, myConvo, isStudent, uid]);

  const pick = async (u: Row) => {
    if (!isStudent && u.role === 'student') {
      onOpen({ kind: 'student', id: u.id, base: `conversations/${u.id}`, title: u.full_name || u.username, peerUid: u.id, memberId: u.member_id || '' });
      return;
    }
    const id = pairId(uid, u.id);
    await set(`dms/${id}`, { members: [uid, u.id].sort(), names: { [uid]: user.full_name || user.username, [u.id]: u.full_name || u.username } }, true);
    onOpen({ kind: 'dm', id, base: `dms/${id}`, title: u.full_name || u.username, peerUid: u.id });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Header title="Messenger" subtitle="Chats and video calls"
        right={<IconButton name="create-outline" onPress={() => setPicking(true)} label="New message" />} />
      <FlatList
        data={items}
        keyExtractor={(c) => `${c.kind}:${c.id}`}
        ListEmptyComponent={<Text style={s.empty}>{dms ? 'No chats yet. Tap the pencil to start one.' : 'Loading…'}</Text>}
        renderItem={({ item: c }) => {
          const group = c.kind === 'student' && isStudent;
          const on = group ? officerOnline : isOnline(pres(c.peerUid));
          const unread = c.unread > 0;
          return (
            <Pressable style={s.row} onPress={() => onOpen(c)}>
              {group
                ? <View style={s.groupIcon}><Ionicons name="people" size={22} color={colors.navy} /><View style={[s.dot, { backgroundColor: on ? colors.green : '#b8c0cf' }]} /></View>
                : <Avatar uid={c.peerUid} name={c.title} online={on} />}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[s.name, { flex: 1 }]} numberOfLines={1}>{c.title}</Text>
                  <Text style={s.time}>{fmtWhen(c.last_time)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <Text style={[s.preview, unread && { color: colors.text, fontWeight: '600' }, { flex: 1 }]} numberOfLines={1}>{c.sub}</Text>
                  {unread && <View style={s.badge}><Text style={s.badgeText}>{c.unread}</Text></View>}
                </View>
                {on && <Text style={s.active}>{group ? 'An officer is active now' : 'Active now'}</Text>}
              </View>
            </Pressable>
          );
        }}
      />
      <Pressable style={s.fab} onPress={() => setPicking(true)} accessibilityLabel="New message">
        <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
      </Pressable>
      <NewMessage visible={picking} onClose={() => setPicking(false)} onPick={pick} />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f0f2f7' },
  name: { fontWeight: '700', fontSize: 15.5, color: colors.text },
  preview: { color: colors.muted, fontSize: 13.5 },
  time: { color: colors.muted, fontSize: 12, marginLeft: 8 },
  active: { color: colors.green, fontSize: 12, marginTop: 2 },
  badge: { backgroundColor: colors.blue, borderRadius: 10, minWidth: 20, paddingHorizontal: 6, height: 20, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  badgeText: { color: '#fff', fontSize: 11.5, fontWeight: '700' },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40, paddingHorizontal: 30 },
  search: { margin: 14, borderWidth: 1, borderColor: '#dbe1ec', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15.5, color: colors.text },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 58, height: 58, borderRadius: 29, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  groupIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff' },
});
