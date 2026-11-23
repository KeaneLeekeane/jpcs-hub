import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePhoto } from './session';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './theme';

export const initials = (name = '') =>
  name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?';

export function Avatar({ name, online, size = 42, uid }: { name: string; online?: boolean; size?: number; uid?: string }) {
  const photo = usePhoto(uid);
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {photo
        ? <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        : <Text style={[s.avatarText, { fontSize: size * 0.36 }]}>{initials(name)}</Text>}
      {online !== undefined && <View style={[s.dot, { backgroundColor: online ? colors.green : '#b8c0cf' }]} />}
    </View>
  );
}

export function Header({ title, subtitle, onBack, right, online, avatar }: {
  title: string; subtitle?: string; onBack?: () => void; right?: ReactNode; online?: boolean; avatar?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: insets.top + 10 }]}>
      {onBack && (
        <Pressable onPress={onBack} hitSlop={12} style={{ marginRight: 8 }} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </Pressable>
      )}
      {avatar && <View style={{ marginRight: 10 }}>{avatar}</View>}
      <View style={{ flex: 1 }}>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        {!!subtitle && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            {online !== undefined && <View style={[s.smallDot, { backgroundColor: online ? '#4ade80' : '#94a3b8' }]} />}
            <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text>
          </View>
        )}
      </View>
      {right}
    </View>
  );
}

export function IconButton({ name, onPress, label }: { name: keyof typeof Ionicons.glyphMap; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityLabel={label} style={s.iconBtn}>
      <Ionicons name={name} size={22} color="#fff" />
    </Pressable>
  );
}

const s = StyleSheet.create({
  avatar: { backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.navy, fontWeight: '700' },
  dot: { position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff' },
  header: { backgroundColor: colors.navy, paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  subtitle: { color: '#c9d4ef', fontSize: 12.5 },
  smallDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  iconBtn: { marginLeft: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
});
