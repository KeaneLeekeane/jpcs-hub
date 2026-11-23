import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isOnline, type Row } from '../firebase';
import { useCollection, useNow } from '../session';
import { Avatar, Header, IconButton } from '../ui';
import { colors } from '../theme';

const fmtWhen = (ms: number) => {
  if (!ms) return '';
  const d = new Date(ms);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

type Open = (c: { id: string; name: string; memberId: string }) => void;

function NewMessage({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: Open }) {
  const students = useCollection(visible ? 'users' : null, { where: [['role', 'student']] });
  const [q, setQ] = useState('');
  const rows = (students || []).filter((s) => s.status !== 'inactive'
    && `${s.full_name} ${s.username}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Header title="Message a student" onBack={onClose} />
      <TextInput style={s.search} placeholder="Search name or student no." value={q} onChangeText={setQ} placeholderTextColor="#9aa3b5" />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        ListEmptyComponent={<Text style={s.empty}>{students ? 'No students with an app login.' : 'Loading…'}</Text>}
        renderItem={({ item }) => (
          <Pressable style={s.row} onPress={() => { onPick({ id: item.id, name: item.full_name, memberId: item.member_id || '' }); onClose(); }}>
            <Avatar name={item.full_name} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.name}>{item.full_name}</Text>
              <Text style={s.preview}>{item.username}</Text>
            </View>
          </Pressable>
        )}
      />
    </Modal>
  );
}

export default function ConversationsScreen({ onOpen, onMenu }: { onOpen: Open; onMenu: () => void }) {
  useNow();
  const convos = useCollection('conversations', { orderBy: ['last_time', 'desc'] });
  const presence = useCollection('presence');
  const [picking, setPicking] = useState(false);
  const pres = (id: string) => (presence || []).find((p: Row) => p.id === id);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Header
        title="Messenger" subtitle="JPCS HUB · Student inquiries"
        right={(
          <>
            <IconButton name="create-outline" onPress={() => setPicking(true)} label="New message" />
            <IconButton name="person-circle-outline" onPress={onMenu} label="Account" />
          </>
        )}
      />
      <FlatList
        data={convos || []}
        keyExtractor={(c) => c.id}
        ListEmptyComponent={<Text style={s.empty}>{convos ? 'No conversations yet. Students can message you from the app.' : 'Loading…'}</Text>}
        renderItem={({ item: c }) => {
          const on = isOnline(pres(c.id));
          const unread = c.staff_unread > 0;
          return (
            <Pressable style={s.row} onPress={() => onOpen({ id: c.id, name: c.student_name, memberId: c.member_id || '' })}>
              <Avatar name={c.student_name} online={on} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[s.name, { flex: 1 }]} numberOfLines={1}>{c.student_name}</Text>
                  <Text style={s.time}>{fmtWhen(c.last_time)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <Text style={[s.preview, unread && { color: colors.text, fontWeight: '600' }, { flex: 1 }]} numberOfLines={1}>
                    {c.last_sender_type === 'officer' ? 'You: ' : ''}{c.last_message}
                  </Text>
                  {unread && <View style={s.badge}><Text style={s.badgeText}>{c.staff_unread}</Text></View>}
                </View>
                {on && <Text style={s.active}>Active now</Text>}
              </View>
            </Pressable>
          );
        }}
      />
      <Pressable style={s.fab} onPress={() => setPicking(true)} accessibilityLabel="New message">
        <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
      </Pressable>
      <NewMessage visible={picking} onClose={() => setPicking(false)} onPick={onOpen} />
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
  fab: { position: 'absolute', right: 20, bottom: 30, width: 58, height: 58, borderRadius: 29, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', elevation: 4 },
});
