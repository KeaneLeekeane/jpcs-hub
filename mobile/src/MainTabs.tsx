// Bottom-tab navigation. Staff get the management modules (same access rules
// as the web portal; User Accounts is Admin-only). Students get Messenger,
// Announcements, Events and My Membership.
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCollection, useSession, usePhoto } from './session';
import { set } from './firebase';
import { can, ROLES } from './helpers';
import { colors } from './theme';
import { Avatar } from './ui';
import { Page, Card, T, Btn } from './kit';
import ChatScreen from './screens/ChatScreen';
import type { Thread } from './thread';
import ConversationsScreen from './screens/ConversationsScreen';
import DashboardScreen from './screens/DashboardScreen';
import MembersScreen from './screens/MembersScreen';
import AccountsScreen from './screens/AccountsScreen';
import { AnnouncementsScreen, EventsScreen } from './screens/NewsScreens';
import DocumentsScreen from './screens/DocumentsScreen';
import FinanceScreen from './screens/FinanceScreen';
import ReportsScreen from './screens/ReportsScreen';
import MyMembershipScreen from './screens/MyMembershipScreen';

type Icon = keyof typeof Ionicons.glyphMap;


const MODULES: { key: string; title: string; icon: Icon; sub: string }[] = [
  { key: 'members', title: 'Membership Records', icon: 'people-outline', sub: 'Add, edit and search members' },
  { key: 'accounts', title: 'User Accounts', icon: 'settings-outline', sub: 'Admin only · roles and access' },
  { key: 'announcements', title: 'Announcements', icon: 'megaphone-outline', sub: 'Post updates for members' },
  { key: 'events', title: 'Events', icon: 'calendar-outline', sub: 'Organize JPCS activities' },
  { key: 'documents', title: 'Documents', icon: 'document-text-outline', sub: 'Organizational files' },
  { key: 'finance', title: 'Financial Management', icon: 'cash-outline', sub: 'Event budget and liquidation' },
  { key: 'reports', title: 'Reports', icon: 'bar-chart-outline', sub: 'Membership and financial summary' },
];

async function choosePhoto(uid: string, camera: boolean) {
  const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Permission is needed to choose a picture.');
  const opts = { mediaTypes: ['images'] as ImagePicker.MediaType[], allowsEditing: true, aspect: [1, 1] as [number, number], quality: 0.9 };
  const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return;
  const out = await manipulateAsync(res.assets[0].uri, [{ resize: { width: 256, height: 256 } }], { compress: 0.75, format: SaveFormat.JPEG, base64: true });
  await set(`profiles/${uid}`, { photo: `data:image/jpeg;base64,${out.base64}`, updated: Date.now() });
}

function ProfileCard() {
  const { uid, user, signOut } = useSession();
  const photo = usePhoto(uid);
  const [busy, setBusy] = useState(false);
  const change = () => Alert.alert('Profile picture', 'Choose a picture for your profile.', [
    { text: 'Take Photo', onPress: () => run(true) },
    { text: 'Choose from Gallery', onPress: () => run(false) },
    ...(photo ? [{ text: 'Remove Picture', style: 'destructive' as const, onPress: () => { set(`profiles/${uid}`, { photo: '', updated: Date.now() }); } }] : []),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
  const run = async (camera: boolean) => {
    setBusy(true);
    try { await choosePhoto(uid, camera); } catch (e: any) { Alert.alert('Could not save picture', e?.message || ''); } finally { setBusy(false); }
  };
  return (
    <Card style={{ alignItems: 'center' }}>
      <Pressable onPress={change} accessibilityLabel="Change profile picture">
        <Avatar uid={uid} name={user.full_name || user.username} size={84} />
        <View style={s.camBadge}><Ionicons name="camera" size={15} color="#fff" /></View>
      </Pressable>
      <Btn title={busy ? 'Saving…' : photo ? 'Change Picture' : 'Add Profile Picture'} kind="light" icon="image-outline" onPress={change} busy={busy} style={{ marginTop: 10, paddingVertical: 8 }} />
      <T bold style={{ fontSize: 17, marginTop: 10 }}>{user.full_name || user.username}</T>
      <T small muted>{ROLES[user.role] || user.role} · {user.username}</T>
      <Btn title="Log Out" kind="danger" icon="log-out-outline" onPress={signOut} style={{ alignSelf: 'stretch', marginTop: 14 }} />
    </Card>
  );
}

function renderModule(key: string, onBack?: () => void): ReactNode {
  switch (key) {
    case 'members': return <MembersScreen onBack={onBack} />;
    case 'accounts': return <AccountsScreen onBack={onBack} />;
    case 'announcements': return <AnnouncementsScreen onBack={onBack} />;
    case 'events': return <EventsScreen onBack={onBack} />;
    case 'documents': return <DocumentsScreen onBack={onBack} />;
    case 'finance': return <FinanceScreen onBack={onBack} />;
    case 'reports': return <ReportsScreen onBack={onBack} />;
    default: return null;
  }
}

function TabBar({ tabs, active, onChange }: { tabs: { key: string; label: string; icon: Icon; badge?: number }[]; active: string; onChange: (k: string) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Pressable key={t.key} style={s.tab} onPress={() => onChange(t.key)} accessibilityLabel={t.label}>
            <View>
              <Ionicons name={(on ? String(t.icon).replace('-outline', '') : t.icon) as Icon} size={23} color={on ? colors.blue : '#8a93a6'} />
              {!!t.badge && <View style={s.badge}><Text style={s.badgeText}>{t.badge > 9 ? '9+' : t.badge}</Text></View>}
            </View>
            <Text style={[s.tabText, on && { color: colors.blue, fontWeight: '700' }]} numberOfLines={1}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function MainTabs() {
  const { uid, user, isStudent } = useSession();
  const role = user.role;
  const [tab, setTab] = useState('home');
  const [chat, setChat] = useState<Thread | null>(null);
  const [module, setModule] = useState<string | null>(null);

  const dms = useCollection('dms', { where: [['members', uid, 'array-contains']] });
  const unread = (dms || []).reduce((n, d) => n + (d[`unread_${uid}`] || 0), 0);

  // Android back button: close the open chat/module first.
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      if (chat) { setChat(null); return true; }
      if (module) { setModule(null); return true; }
      if (tab !== 'home') { setTab('home'); return true; }
      return false;
    });
    return () => h.remove();
  }, [chat, module, tab, isStudent]);

  const tabs = isStudent
    ? [
      { key: 'home', label: 'Dashboard', icon: 'grid-outline' as Icon },
      { key: 'messages', label: 'Messages', icon: 'chatbubbles-outline' as Icon, badge: unread },
      { key: 'announcements', label: 'News', icon: 'megaphone-outline' as Icon },
      { key: 'events', label: 'Events', icon: 'calendar-outline' as Icon },
      { key: 'profile', label: 'Me', icon: 'person-circle-outline' as Icon },
    ]
    : [
      { key: 'home', label: 'Dashboard', icon: 'grid-outline' as Icon },
      { key: 'messages', label: 'Messages', icon: 'chatbubbles-outline' as Icon, badge: unread },
      ...(can(role, 'members') ? [{ key: 'members', label: 'Members', icon: 'people-outline' as Icon }]
        : can(role, 'finance') ? [{ key: 'finance', label: 'Finance', icon: 'cash-outline' as Icon }] : []),
      { key: 'events', label: 'Events', icon: 'calendar-outline' as Icon },
      { key: 'more', label: 'More', icon: 'menu-outline' as Icon },
    ];

  const changeTab = (k: string) => { setTab(k); setChat(null); setModule(null); };

  let body: ReactNode;
  if (tab === 'messages') {
    body = chat
      ? <ChatScreen key={chat.id} thread={chat} onBack={() => setChat(null)} />
      : <ConversationsScreen onOpen={setChat} />;
  } else if (tab === 'home') {
    body = <DashboardScreen onOpen={(k) => {
      if (isStudent) { setTab(k === 'announcements' ? 'announcements' : k === 'membership' ? 'profile' : 'events'); return; }
      setTab('more'); setModule(k);
    }} />;
  } else if (tab === 'membership') {
    body = <MyMembershipScreen />;
  } else if (tab === 'profile') {
    body = (
      <View style={{ flex: 1 }}>
        <MyMembershipScreen footer={<ProfileCard />} />
      </View>
    );
  } else if (tab === 'more') {
    body = module ? renderModule(module, () => setModule(null)) : (
      <Page title="More" subtitle="JPCS HUB modules">
        {MODULES.filter((m) => can(role, m.key)).map((m) => (
          <Card key={m.key} onPress={() => setModule(m.key)}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={s.modIcon}><Ionicons name={m.icon} size={21} color={colors.blue} /></View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <T bold>{m.title}</T>
                <T small muted>{m.sub}</T>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#b8c0cf" />
            </View>
          </Card>
        ))}
        <ProfileCard />
      </Page>
    );
  } else {
    body = renderModule(tab);
  }

  // Officers' open chat uses the full screen; everything else shows the tab bar.
  const hideBar = tab === 'messages' && !!chat;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>{body}</View>
      {!hideBar && <TabBar tabs={tabs} active={tab} onChange={changeTab} />}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 7 },
  tab: { flex: 1, alignItems: 'center' },
  tabText: { fontSize: 11, color: '#8a93a6', marginTop: 2 },
  badge: { position: 'absolute', top: -4, right: -10, backgroundColor: '#ef4444', borderRadius: 9, minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  camBadge: { position: 'absolute', right: 0, bottom: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  modIcon: { width: 42, height: 42, borderRadius: 11, backgroundColor: '#e8efff', alignItems: 'center', justifyContent: 'center' },
});
