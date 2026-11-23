import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { isConfigured } from './src/firebaseConfig';
import { SessionProvider, useAuthState, useSession } from './src/session';
import { CallLayer } from './src/CallLayer';
import LoginScreen from './src/screens/LoginScreen';
import ConversationsScreen from './src/screens/ConversationsScreen';
import ChatScreen from './src/screens/ChatScreen';
import { Avatar } from './src/ui';
import { colors } from './src/theme';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin / Faculty Adviser', officer: 'JPCS Officer', treasurer: 'Treasurer', auditor: 'Auditor', student: 'Student Member',
};

function AccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user, signOut } = useSession();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.sheetBack} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <Avatar name={user.full_name || user.username} size={64} />
          <Text style={s.sheetName}>{user.full_name || user.username}</Text>
          <Text style={s.sheetRole}>{ROLE_LABEL[user.role] || user.role} · {user.username}</Text>
          <Pressable style={s.logout} onPress={() => { onClose(); signOut(); }}>
            <Text style={s.logoutText}>Log Out</Text>
          </Pressable>
          <Pressable onPress={onClose} style={{ padding: 10 }}><Text style={{ color: colors.muted }}>Close</Text></Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type Chat = { id: string; name: string; memberId: string };

function Home() {
  const { uid, user, isStudent } = useSession();
  const [chat, setChat] = useState<Chat | null>(null);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (!chat) return undefined;
    const h = BackHandler.addEventListener('hardwareBackPress', () => { setChat(null); return true; });
    return () => h.remove();
  }, [chat]);

  return (
    <CallLayer>
      {isStudent ? (
        // Students have one conversation with all JPCS Officers.
        <ChatScreen convoId={uid} title="JPCS Officers" memberId={user.member_id || ''} onMenu={() => setMenu(true)} />
      ) : chat ? (
        <ChatScreen key={chat.id} convoId={chat.id} title={chat.name} memberId={chat.memberId} onBack={() => setChat(null)} />
      ) : (
        <ConversationsScreen onOpen={setChat} onMenu={() => setMenu(true)} />
      )}
      <AccountSheet visible={menu} onClose={() => setMenu(false)} />
    </CallLayer>
  );
}

function Root() {
  const { uid, user, notice, setNotice } = useAuthState();
  if (uid === undefined || (uid && user === undefined)) {
    return <View style={s.loading}><ActivityIndicator color="#fff" size="large" /></View>;
  }
  if (!uid || !user) return <LoginScreen notice={notice} clearNotice={() => setNotice('')} />;
  return <SessionProvider uid={uid} user={user}><Home /></SessionProvider>;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {isConfigured ? <Root /> : (
        <View style={s.loading}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>JPCS HUB</Text>
          <Text style={{ color: '#c9d4ef', marginTop: 8, textAlign: 'center', paddingHorizontal: 30 }}>
            Firebase is not configured yet. Add the Firebase web config to mobile/src/firebaseConfig.ts (see README).
          </Text>
        </View>
      )}
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  sheetBack: { flex: 1, backgroundColor: 'rgba(13,21,48,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, alignItems: 'center' },
  sheetName: { fontSize: 19, fontWeight: '700', marginTop: 12, color: colors.text },
  sheetRole: { color: colors.muted, marginTop: 4 },
  logout: { marginTop: 22, alignSelf: 'stretch', backgroundColor: '#fde8e8', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  logoutText: { color: '#c53030', fontWeight: '700', fontSize: 15.5 },
});
