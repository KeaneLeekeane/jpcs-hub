// Chat list: private 1-on-1 conversations, like Messenger.
import { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isOnline, set, update, type Row } from '../firebase';
import { useCollection, useNow, useSession } from '../session';
import { Avatar, Header, IconButton } from '../ui';
import { ROLES } from '../helpers';
import { pairId, isStaffRole, type Thread } from '../thread';
import { colors } from '../theme';

const fmtWhen = (ms: number) => {
  if (!ms) return '';
  const d = new Date(ms);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

type Item = Thread & { last_time: number; sub: string; unread: number };

// Students can message the officers and staff; staff can message anyone.
function NewMessage({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (u: Row) => void }) {
  const { uid, isStudent } = useSession();
  const users = useCollection(visible ? 'users' : null);
  const presence = useCollection(visible ? 'presence' : null);
  const [q, setQ] = useState('');
  const rows = (users || []).filter((u) => u.id !== uid && u.status !== 'inactive' && (!isStudent || isStaffRole(u.role))
    && `${u.full_name} ${u.username} ${u.role}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || '')));
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Header title="New message" subtitle="Choose a person to chat with" onBack={onClose} />
      <TextInput style={s.search} placeholder="Search name, username or role" value={q} onChangeText={setQ} placeholderTextColor="#9aa3b5" />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        ListEmptyComponent={<Text style={s.empty}>{users ? 'No people found.' : 'Loading…'}</Text>}
        renderItem={({ item }) => (
          <Pressable style={s.row} onPress={() => { onPick(item); onClose(); }}>
            <Avatar uid={item.id} name={item.full_name || item.username} online={isOnline((presence || []).find((p) => p.id === item.id))} />
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
  const dms = useCollection('dms', { where: [['members', uid, 'array-contains']] });
  const presence = useCollection('presence');
  const [picking, setPicking] = useState(false);
  const pres = (id?: string) => (presence || []).find((p: Row) => p.id === id);

  const items = useMemo(() => (dms || []).filter((d) => !d[`hidden_${uid}`]).map((d) => {
    const peer = (d.members || []).find((m: string) => m !== uid) || '';
    return {
      id: d.id, peerUid: peer, title: d.names?.[peer] || 'User',
      last_time: d.last_time || 0, unread: d[`unread_${uid}`] || 0,
      sub: (d.last_time || 0) > (d[`cleared_${uid}`] || 0) ? (d.last_message || 'New conversation') : 'New conversation',
    } as Item;
  }).sort((a, b) => b.last_time - a.last_time), [dms, uid]);

  const pick = async (u: Row) => {
    const id = pairId(uid, u.id);
    await set(`dms/${id}`, {
      members: [uid, u.id].sort(),
      names: { [uid]: user.full_name || user.username, [u.id]: u.full_name || u.username },
      [`hidden_${uid}`]: false,
    }, true);
    onOpen({ id, title: u.full_name || u.username, peerUid: u.id });
  };

  // Delete the whole conversation for me (like Messenger); the other person keeps theirs.
  const deleteChat = (c: Item) => Alert.alert('Delete conversation?', `Your whole chat with ${c.title} will be deleted. ${c.title} will still have their copy.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => {
      update(`dms/${c.id}`, { [`hidden_${uid}`]: true, [`cleared_${uid}`]: Date.now(), [`unread_${uid}`]: 0 })
        .catch((e) => Alert.alert('Could not delete', e?.message || String(e)));
    } },
  ]);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Header title="Messenger" subtitle={isStudent ? 'Chat with the JPCS officers' : 'Chats and video calls'}
        right={<IconButton name="create-outline" onPress={() => setPicking(true)} label="New message" />} />
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        ListEmptyComponent={<Text style={s.empty}>{dms ? 'No chats yet. Tap the pencil and choose a person.' : 'Loading…'}</Text>}
        renderItem={({ item: c }) => {
          const on = isOnline(pres(c.peerUid));
          const unread = c.unread > 0;
          return (
            <Pressable style={s.row} onPress={() => onOpen(c)}>
              <Avatar uid={c.peerUid} name={c.title} online={on} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[s.name, { flex: 1 }]} numberOfLines={1}>{c.title}</Text>
                  <Text style={s.time}>{fmtWhen(c.last_time)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <Text style={[s.preview, unread && { color: colors.text, fontWeight: '600' }, { flex: 1 }]} numberOfLines={1}>{c.sub}</Text>
                  {unread && <View style={s.badge}><Text style={s.badgeText}>{c.unread}</Text></View>}
                </View>
                {on && <Text style={s.active}>Active now</Text>}
              </View>
              <Pressable onPress={() => deleteChat(c)} hitSlop={10} style={{ padding: 8, marginLeft: 4 }} accessibilityLabel="Delete conversation">
                <Ionicons name="trash-outline" size={19} color="#d64545" />
              </Pressable>
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
});
