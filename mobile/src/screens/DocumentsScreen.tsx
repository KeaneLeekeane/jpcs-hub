import { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCollection, useSession } from '../session';
import { add, remove, type Row } from '../firebase';
import { Page, Card, T, Btn, Field, Chips, Sheet, Search, Empty, Loading, ErrorText } from '../kit';
import { IconButton } from '../ui';
import { fmtDate } from '../helpers';
import { useFileOpener, pickAndSavePhoto } from './AttachmentView';
import { colors } from '../theme';
import { Alert } from 'react-native';

const CATEGORIES = ['Minutes of Meeting', 'Constitution & By-Laws', 'Letters & Memos', 'Event Proposal', 'Reports', 'Forms', 'Others'];

function AddPhotoDoc({ onClose }: { onClose: () => void }) {
  const { uid, user } = useSession();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const go = async (camera: boolean) => {
    setError('');
    if (!title.trim()) { setError('Enter a document title first.'); return; }
    setBusy(true);
    try {
      const url = await pickAndSavePhoto('documents', camera);
      if (!url) return;
      await add('documents', {
        title: title.trim(), category, file_path: url, file_name: `${title.trim()}.jpg`, date_uploaded: Date.now(),
        uploaded_by: uid, uploaded_by_name: user.full_name || user.username,
      });
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Upload failed.');
    } finally { setBusy(false); }
  };
  return (
    <Sheet visible title="Add Document (photo)" onClose={onClose}>
      <ErrorText text={error} />
      <Field label="Document Title" value={title} onChange={setTitle} />
      <Chips label="Category" options={CATEGORIES} value={category} onChange={setCategory} />
      <T small muted style={{ marginBottom: 12 }}>Take a photo of the document or choose one from the gallery. PDF and Word files can be uploaded from the web portal or laptop app.</T>
      <View style={{ gap: 10 }}>
        <Btn title="Take Photo" icon="camera" onPress={() => go(true)} busy={busy} />
        <Btn title="Choose from Gallery" icon="images" kind="light" onPress={() => go(false)} disabled={busy} />
      </View>
    </Sheet>
  );
}

export default function DocumentsScreen({ onBack }: { onBack?: () => void }) {
  const { user } = useSession();
  const canEdit = ['admin', 'officer'].includes(user.role);
  const docs = useCollection('documents', { orderBy: ['date_uploaded', 'desc'] });
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const { open, viewer } = useFileOpener();
  const term = q.trim().toLowerCase();
  const rows = (docs || []).filter((d) => !term || `${d.title} ${d.category}`.toLowerCase().includes(term));

  return (
    <Page title="Documents" subtitle="Organizational files" onBack={onBack}
      right={canEdit ? <IconButton name="add" label="Add document" onPress={() => setAdding(true)} /> : undefined}>
      <Search value={q} onChange={setQ} placeholder="Search documents..." />
      {viewer}
      {!docs ? <Loading /> : rows.length === 0 ? <Empty text="No documents added yet." /> : rows.map((d: Row) => (
        <Card key={d.id} onPress={() => open(d.file_path)}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="document-text-outline" size={26} color={colors.blue} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <T bold>{d.title}</T>
              <T small muted>{d.category} · {fmtDate(d.date_uploaded)} · {d.uploaded_by_name}</T>
            </View>
            {canEdit && (
              <Ionicons name="trash-outline" size={20} color="#c53030" style={{ padding: 6 }}
                onPress={() => Alert.alert('Delete document?', `"${d.title}" will be removed.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => remove(`documents/${d.id}`) }])} />
            )}
          </View>
        </Card>
      ))}
      {adding && <AddPhotoDoc onClose={() => setAdding(false)} />}
    </Page>
  );
}
