import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { authError, signIn } from '../firebase';
import { colors } from '../theme';

export default function LoginScreen({ notice, clearNotice }: { notice: string; clearNotice: () => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!login.trim() || !password) return;
    setError('');
    clearNotice();
    setBusy(true);
    try {
      await signIn(login, password);
    } catch (e) {
      setError(authError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.center} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <View style={s.logo}><Text style={s.logoText}>JH</Text></View>
          <Text style={s.h1}>JPCS HUB</Text>
          <Text style={s.sub}>Messenger and Video Call with JPCS–PTC Officers</Text>
          {!!(error || notice) && <Text style={s.error}>{error || notice}</Text>}
          <Text style={s.label}>Username or Student No.</Text>
          <TextInput
            style={s.input} value={login} onChangeText={setLogin} autoCapitalize="none" autoCorrect={false}
            placeholder="e.g. 2026-001" placeholderTextColor="#9aa3b5" returnKeyType="next" textContentType="username"
          />
          <Text style={s.label}>Password</Text>
          <TextInput
            style={s.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Password"
            placeholderTextColor="#9aa3b5" returnKeyType="go" onSubmitEditing={submit} textContentType="password"
          />
          <Pressable style={[s.btn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Log In</Text>}
          </Pressable>
          <Text style={s.hint}>Your login is given by the JPCS officers when your membership is recorded.</Text>
        </View>
        <Text style={s.footer}>Pateros Technological College</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.navy },
  center: { flexGrow: 1, justifyContent: 'center', padding: 22 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 24 },
  logo: { width: 54, height: 54, borderRadius: 12, backgroundColor: '#2d6ae0', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  logoText: { color: '#fff', fontWeight: '800', fontSize: 19 },
  h1: { fontSize: 23, fontWeight: '800', color: colors.text },
  sub: { color: colors.muted, marginTop: 4, marginBottom: 20, fontSize: 13.5 },
  label: { fontWeight: '600', color: colors.text, marginBottom: 6, fontSize: 14 },
  input: { borderWidth: 1, borderColor: '#dbe1ec', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 14, color: colors.text },
  btn: { backgroundColor: colors.blue, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  error: { backgroundColor: '#fde8e8', color: '#c53030', padding: 10, borderRadius: 8, marginBottom: 14, fontSize: 13.5 },
  hint: { color: colors.muted, fontSize: 12.5, marginTop: 16, textAlign: 'center' },
  footer: { color: '#c9d4ef', textAlign: 'center', marginTop: 18, fontSize: 12 },
});
