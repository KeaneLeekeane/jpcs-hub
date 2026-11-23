// Announcements and Events. Admin/Officers can add, edit and delete; everyone
// else (Treasurer, Auditor, Students) reads them.
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCollection, useSession } from '../session';
import { add, remove, update, type Row } from '../firebase';
import { Page, Card, T, Btn, Field, Chips, Badge, Sheet, Empty, Loading } from '../kit';
import { IconButton } from '../ui';
import { canManage, fmtDate, today } from '../helpers';
import { colors } from '../theme';

const confirmDelete = (what: string, onYes: () => void) =>
  Alert.alert(`Delete ${what}?`, 'This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: onYes }]);

function AnnouncementForm({ item, onClose }: { item: Row | null; onClose: () => void }) {
  const { uid, user } = useSession();
  const [title, setTitle] = useState(item?.title || '');
  const [content, setContent] = useState(item?.content || '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!title.trim() || !content.trim()) return;
    setBusy(true);
    try {
      if (item?.id) await update(`announcements/${item.id}`, { title: title.trim(), content: content.trim() });
      else await add('announcements', { title: title.trim(), content: content.trim(), date_posted: Date.now(), posted_by: uid, posted_by_name: user.full_name || user.username });
      onClose();
    } finally { setBusy(false); }
  };
  return (
    <Sheet visible title={item?.id ? 'Edit Announcement' : 'Create Announcement'} onClose={onClose}>
      <Field label="Title" value={title} onChange={setTitle} />
      <Field label="Content" value={content} onChange={setContent} multiline />
      <Btn title={item?.id ? 'Save' : 'Post Announcement'} onPress={save} busy={busy} />
    </Sheet>
  );
}

export function AnnouncementsScreen({ onBack }: { onBack?: () => void }) {
  const { user } = useSession();
  const manage = canManage(user.role);
  const items = useCollection('announcements', { orderBy: ['date_posted', 'desc'] });
  const [editing, setEditing] = useState<Row | null | undefined>(undefined);
  return (
    <Page title="Announcements" subtitle="Updates for JPCS members" onBack={onBack}
      right={manage ? <IconButton name="add" label="Create announcement" onPress={() => setEditing(null)} /> : undefined}>
      {!items ? <Loading /> : items.length === 0 ? <Empty text="No announcements yet." /> : items.map((a) => (
        <Card key={a.id}>
          <T bold style={{ fontSize: 16 }}>{a.title}</T>
          <T small muted style={{ marginVertical: 4 }}>Posted {fmtDate(a.date_posted)}{a.posted_by_name ? ` · ${a.posted_by_name}` : ''}</T>
          <T style={{ color: '#4b5568' }}>{a.content}</T>
          {manage && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Btn title="Edit" kind="light" onPress={() => setEditing(a)} style={{ flex: 1, paddingVertical: 8 }} />
              <Btn title="Delete" kind="danger" onPress={() => confirmDelete('announcement', () => remove(`announcements/${a.id}`))} style={{ flex: 1, paddingVertical: 8 }} />
            </View>
          )}
        </Card>
      ))}
      {editing !== undefined && <AnnouncementForm item={editing} onClose={() => setEditing(undefined)} />}
    </Page>
  );
}

function EventForm({ item, onClose }: { item: Row | null; onClose: () => void }) {
  const { uid } = useSession();
  const [f, setF] = useState<Record<string, string>>({
    event_title: item?.event_title || '', description: item?.description || '', event_date: item?.event_date || today(),
    venue: item?.venue || '', status: item?.status || 'Upcoming',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const s = (key: string) => (v: string) => setF({ ...f, [key]: v });
  const save = async () => {
    setError('');
    if (!f.event_title.trim() || !f.venue.trim()) { setError('Title and venue are required.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.event_date)) { setError('Date must look like 2026-12-10.'); return; }
    setBusy(true);
    try {
      const data = { event_title: f.event_title.trim(), description: f.description.trim(), event_date: f.event_date, venue: f.venue.trim(), status: f.status };
      if (item?.id) await update(`events/${item.id}`, data);
      else await add('events', { ...data, created_by: uid });
      onClose();
    } finally { setBusy(false); }
  };
  return (
    <Sheet visible title={item?.id ? 'Edit Event' : 'Add Event'} onClose={onClose}>
      {!!error && <T style={{ color: '#c53030', marginBottom: 10 }}>{error}</T>}
      <Field label="Event Title" value={f.event_title} onChange={s('event_title')} />
      <Field label="Description" value={f.description} onChange={s('description')} multiline />
      <Field label="Date (YYYY-MM-DD)" value={f.event_date} onChange={s('event_date')} keyboard="numeric" />
      <Field label="Venue" value={f.venue} onChange={s('venue')} />
      <Chips label="Status" options={['Upcoming', 'Completed', 'Cancelled']} value={f.status} onChange={s('status')} />
      <Btn title="Save Event" onPress={save} busy={busy} />
    </Sheet>
  );
}

export function EventsScreen({ onBack }: { onBack?: () => void }) {
  const { user } = useSession();
  const manage = canManage(user.role);
  const events = useCollection('events', { orderBy: ['event_date', 'asc'] });
  const [editing, setEditing] = useState<Row | null | undefined>(undefined);
  const [show, setShow] = useState('upcoming');
  const list = (events || []).filter((e) => show === 'all' || ((e.event_date || '') >= today() && e.status !== 'Cancelled'));
  return (
    <Page title="Events" subtitle="JPCS activities" onBack={onBack}
      right={manage ? <IconButton name="add" label="Add event" onPress={() => setEditing(null)} /> : undefined}>
      <Chips options={[['upcoming', 'Upcoming'], ['all', 'All events']]} value={show} onChange={setShow} />
      {!events ? <Loading /> : list.length === 0 ? <Empty text="No events to show." /> : list.map((e) => (
        <Card key={e.id}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <T bold style={{ fontSize: 16, flex: 1 }}>{e.event_title}</T>
            <Badge value={e.status} />
          </View>
          {!!e.description && <T style={{ color: '#4b5568', marginVertical: 6 }}>{e.description}</T>}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Ionicons name="calendar-outline" size={14} color={colors.blue} />
            <T small muted style={{ marginLeft: 5 }}>{e.event_date}</T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Ionicons name="location-outline" size={14} color="#d9534f" />
            <T small muted style={{ marginLeft: 5 }}>{e.venue}</T>
          </View>
          {manage && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Btn title="Edit" kind="light" onPress={() => setEditing(e)} style={{ flex: 1, paddingVertical: 8 }} />
              <Btn title="Delete" kind="danger" onPress={() => confirmDelete('event', () => remove(`events/${e.id}`))} style={{ flex: 1, paddingVertical: 8 }} />
            </View>
          )}
        </Card>
      ))}
      {editing !== undefined && <EventForm item={editing} onClose={() => setEditing(undefined)} />}
    </Page>
  );
}
