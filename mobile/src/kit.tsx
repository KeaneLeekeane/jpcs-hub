// Small UI kit for the management screens (matches the web portal's look).
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, View, type StyleProp, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from './ui';
import { colors } from './theme';

export function Page({ title, subtitle, onBack, right, children, scroll = true }: {
  title: string; subtitle?: string; onBack?: () => void; right?: ReactNode; children: ReactNode; scroll?: boolean;
}) {
  const [refreshing, setRefreshing] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={title} subtitle={subtitle} onBack={onBack} right={right} />
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingBottom: 40, gap: 12 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 600); }} />}
        >
          {children}
        </ScrollView>
      ) : children}
    </View>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) return <Pressable onPress={onPress} style={({ pressed }) => [k.card, style, pressed && { opacity: 0.8 }]}>{children}</Pressable>;
  return <View style={[k.card, style]}>{children}</View>;
}

export function H({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
      <Text style={[k.h, { flex: 1 }]}>{children}</Text>
      {right}
    </View>
  );
}

export const T = ({ children, muted, small, bold, style, lines }: {
  children: ReactNode; muted?: boolean; small?: boolean; bold?: boolean; style?: any; lines?: number;
}) => (
  <Text numberOfLines={lines} style={[{ color: muted ? colors.muted : colors.text, fontSize: small ? 12.5 : 14.5 }, bold && { fontWeight: '700' }, style]}>{children}</Text>
);

export function Btn({ title, onPress, kind = 'primary', icon, disabled, busy, style }: {
  title: string; onPress: () => void; kind?: 'primary' | 'light' | 'danger' | 'green'; icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean; busy?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const bg = { primary: colors.blue, light: '#eef2f8', danger: '#fde8e8', green: '#e3f6ea' }[kind];
  const fg = { primary: '#fff', light: colors.text, danger: '#c53030', green: '#137a3d' }[kind];
  return (
    <Pressable onPress={onPress} disabled={disabled || busy} style={({ pressed }) => [k.btn, { backgroundColor: bg }, (disabled || busy) && { opacity: 0.5 }, pressed && { opacity: 0.8 }, style]}>
      {busy ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Ionicons name={icon} size={17} color={fg} style={{ marginRight: 6 }} />}
          <Text style={{ color: fg, fontWeight: '700', fontSize: 14.5 }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({ label, value, onChange, placeholder, secure, multiline, keyboard, editable = true }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; secure?: boolean; multiline?: boolean;
  keyboard?: 'default' | 'numeric' | 'email-address' | 'decimal-pad'; editable?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={k.label}>{label}</Text>
      <TextInput
        style={[k.input, multiline && { minHeight: 90, textAlignVertical: 'top' }, !editable && { backgroundColor: '#f2f4f8', color: colors.muted }]}
        value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#9aa3b5"
        secureTextEntry={secure} multiline={multiline} keyboardType={keyboard || 'default'} editable={editable}
        autoCapitalize={secure || keyboard === 'email-address' ? 'none' : 'sentences'}
      />
    </View>
  );
}

export function Chips({ label, options, value, onChange }: {
  label?: string; options: (string | [string, string])[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      {label && <Text style={k.label}>{label}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const [v, t] = Array.isArray(o) ? o : [o, o];
          const on = v === value;
          return (
            <Pressable key={v} onPress={() => onChange(v)} style={[k.chip, on && { backgroundColor: colors.blue, borderColor: colors.blue }]}>
              <Text style={{ color: on ? '#fff' : colors.text, fontSize: 13.5, fontWeight: on ? '700' : '500' }}>{t}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const TONES: Record<string, [string, string]> = {
  green: ['#e3f6ea', '#137a3d'], amber: ['#fdf1dc', '#b7791f'], red: ['#fde8e8', '#c53030'],
  gray: ['#eef1f6', '#6b7487'], blue: ['#e8efff', '#1f4fc4'],
};
export function Badge({ value }: { value: string }) {
  const tone = ({
    Active: 'green', Approved: 'green', active: 'green', Upcoming: 'blue', Completed: 'green',
    Pending: 'amber', 'For Review': 'amber', Draft: 'gray', Inactive: 'gray', inactive: 'red',
    Returned: 'red', Cancelled: 'red',
  } as Record<string, string>)[value] || 'gray';
  const [bg, fg] = TONES[tone];
  const text = value === 'active' ? 'Active' : value === 'inactive' ? 'Deactivated' : value;
  return <View style={[k.badge, { backgroundColor: bg }]}><Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{text}</Text></View>;
}

export function Stat({ label, value, icon, tone = 'blue' }: { label: string; value: string | number; icon?: keyof typeof Ionicons.glyphMap; tone?: string }) {
  const [bg, fg] = ({ blue: ['#e8efff', '#2d5fd4'], purple: ['#efe9fd', '#6b46c1'], amber: ['#fdf1dc', '#c27c0e'], green: ['#e3f6ea', '#15a05a'] } as Record<string, string[]>)[tone];
  return (
    <View style={[k.card, { flex: 1, minWidth: '45%' }]}>
      {icon && <View style={[k.statIcon, { backgroundColor: bg }]}><Ionicons name={icon} size={18} color={fg} /></View>}
      <Text style={{ color: colors.muted, fontSize: 12.5 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 21, fontWeight: '800', marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header title={title} onBack={onClose} />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={{ color: colors.muted, textAlign: 'center', paddingVertical: 24 }}>{text}</Text>;
}

export function Loading() {
  return <ActivityIndicator style={{ marginTop: 30 }} color={colors.blue} />;
}

export function ErrorText({ text }: { text: string }) {
  if (!text) return null;
  return <Text style={k.error}>{text}</Text>;
}

export function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View style={k.search}>
      <Ionicons name="search" size={18} color={colors.muted} />
      <TextInput style={{ flex: 1, marginLeft: 8, fontSize: 15, color: colors.text, paddingVertical: 10 }} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#9aa3b5" />
    </View>
  );
}

export function RowLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f2f7' }}>
      <Text style={{ color: colors.muted, width: 130 }}>{label}</Text>
      <View style={{ flex: 1 }}>{typeof value === 'string' || typeof value === 'number' ? <Text style={{ color: colors.text, fontWeight: '600' }}>{value}</Text> : value}</View>
    </View>
  );
}

export const k = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 14 },
  h: { fontSize: 16, fontWeight: '800', color: colors.text },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16 },
  label: { fontWeight: '600', color: colors.text, marginBottom: 6, fontSize: 14 },
  input: { borderWidth: 1, borderColor: '#dbe1ec', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15.5, color: colors.text, backgroundColor: '#fff' },
  chip: { borderWidth: 1, borderColor: '#dbe1ec', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: '#fff' },
  badge: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 },
  statIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  error: { backgroundColor: '#fde8e8', color: '#c53030', padding: 10, borderRadius: 8, marginBottom: 12 },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12 },
});
