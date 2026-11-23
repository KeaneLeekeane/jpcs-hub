import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { isConfigured } from './src/firebaseConfig';
import { SessionProvider, useAuthState } from './src/session';
import { CallLayer } from './src/CallLayer';
import LoginScreen from './src/screens/LoginScreen';
import MainTabs from './src/MainTabs';
import { colors } from './src/theme';

function Home() {
  return (
    <CallLayer>
      <MainTabs />
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
});
