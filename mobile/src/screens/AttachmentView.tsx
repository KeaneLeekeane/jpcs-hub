import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveFile, savePhoto } from '../helpers';
import { colors } from '../theme';

const isImage = (u: string) => u.startsWith('data:image') || /\.(png|jpe?g|gif|webp|heic)(\?|$)/i.test(u) || u.includes('/image/upload/');

// Opens a saved file: photos in a full-screen viewer, web links in the browser.
export function useFileOpener() {
  const [viewing, setViewing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const insets = useSafeAreaInsets();

  const open = async (url: string) => {
    if (!url) return;
    setLoading(true);
    setNote('');
    try {
      const src = await resolveFile(url);
      if (!src) setNote('File not found.');
      else if (isImage(src)) setViewing(src);
      else if (src.startsWith('http')) Linking.openURL(src);
      else setNote('This file type opens on the web portal or the laptop app.');
    } finally {
      setLoading(false);
    }
  };

  const viewer = (
    <>
      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' }}>
          {viewing && <Image source={{ uri: viewing }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />}
          <Pressable onPress={() => setViewing(null)} style={{ position: 'absolute', top: insets.top + 12, right: 16, padding: 8 }} accessibilityLabel="Close">
            <Ionicons name="close" size={30} color="#fff" />
          </Pressable>
        </View>
      </Modal>
      {loading && <ActivityIndicator color={colors.blue} />}
      {!!note && <Text style={{ color: colors.muted, textAlign: 'center' }}>{note}</Text>}
    </>
  );
  return { open, viewer };
}

export function Thumb({ url, onPress, label }: { url: string; onPress: () => void; label: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => { let live = true; if (url) resolveFile(url).then((d) => live && setSrc(d)).catch(() => {}); return () => { live = false; }; }, [url]);
  if (!url) return <Text style={{ color: colors.muted }}>—</Text>;
  return (
    <Pressable onPress={onPress} accessibilityLabel={label}>
      {src && isImage(src)
        ? <Image source={{ uri: src }} style={{ width: 46, height: 46, borderRadius: 6, borderWidth: 1, borderColor: colors.line }} />
        : <Text style={{ color: colors.blue, fontWeight: '700' }}>View</Text>}
    </Pressable>
  );
}

// Pick a photo (camera or gallery) and save it to the free file storage.
export async function pickAndSavePhoto(folder: string, fromCamera: boolean) {
  const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error(fromCamera ? 'Camera permission is needed.' : 'Photo permission is needed.');
  const res = fromCamera
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
  if (res.canceled || !res.assets?.[0]) return null;
  return savePhoto(res.assets[0].uri, folder);
}
