// User Accounts: ADMIN ONLY (the tab is hidden for every other role, and
// Firestore rules also reject changes from non-admins).
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useCollection, useNow, useSession } from '../session';
import { authError, batch, createAccount, isOnline, set, update, type Row } from '../firebase';
import { Page, Card, T, Btn, Field, Chips, Badge, Sheet, Empty, Loading, ErrorText } from '../kit';
import { Avatar, IconButton } from '../ui';
import { ROLES, fmtDate } from '../helpers';
import { colors } from '../theme';

const STAFF_ROLES: [string, string][] = [['admin', 'Admin'], ['officer', 'Officer'], ['treasurer', 'Treasurer'], ['auditor', 'Auditor']];

function AccountForm({ account, onClose }: { account: Row | null; onClose: () => void }) {
  const { uid } = useSession();
  const isNew = !account?.id;
  const self = account?.id === uid;
  const [full, setFull] = useState(account?.full_name || '');
  const [username, setUsername] = useState(account?.username || '');
  const [email, setEmail] = useState(account?.email || '');
  const [role, setRole] = useState(account?.role || 'officer');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setError('');
    if (!full.trim() || !username.trim()) { setError('Full name and username are required.'); return; }
    setBusy(true);
    try {
      if (isNew) {
        if (password.length < 6) throw Object.assign(new Error(), { code: 'auth/weak-password' });
        const u = username.trim().toLowerCase();
        const newUid = await createAccount(u, password);
        await set(`users/${newUid}`, { full_name: full.trim(), username: u, email: email.trim(), role, status: 'active', date_created: Date.now(), last_active: 0 });
      } else {
        const data: Record<string, any> = { full_name: full.trim(), email: email.trim() };
        // Student accounts keep their role (they belong to Membership Records).
        if (!self && account!.role !== 'student') data.role = role;
        await update(`users/${account!.id}`, data);
      }
      onClose();
    } catch (e) {
      setError(authError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible title={isNew ? 'Add User Account' : 'Edit User Account'} onClose={onClose}>
      <ErrorText text={error} />
      <Field label="Full Name" value={full} onChange={setFull} />
      <Field label="Username" value={username} onChange={setUsername} editable={isNew} keyboard="email-address" />
      <Field label="E-mail (optional)" value={email} onChange={setEmail} keyboard="email-address" />
      {account?.role === 'student'
        ? <T small muted style={{ marginBottom: 12 }}>Role: Student (managed in Membership Records)</T>
        : self ? <T small muted style={{ marginBottom: 12 }}>Role: {ROLES[role]} (you can't change your own role)</T>
          : <Chips label="Role" options={STAFF_ROLES} value={role} onChange={setRole} />}
      {isNew && <T small muted style={{ marginBottom: 12 }}>Student logins are created in Membership Records.</T>}
      {isNew && <Field label="Temporary Password" value={password} onChange={setPassword} secure />}
      <Btn title="Save Account" onPress={save} busy={busy} />
    </Sheet>
  );
}

export default function AccountsScreen({ onBack }: { onBack?: () => void }) {
  useNow();
  const { uid, user } = useSession();
  const users = useCollection('users', { orderBy: ['date_created', 'asc'] });
  const presence = useCollection('presence');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState<Row | null | undefined>(undefined);
  if (user.role !== 'admin') return <Page title="User Accounts" onBack={onBack}><Empty text="Only the Admin can manage user accounts." /></Page>;

  const rows = (users || []).filter((u) => (filter === 'all' ? true : filter === 'staff' ? u.role !== 'student' : u.role === 'student'));
  const online = (id: string) => isOnline((presence || []).find((p) => p.id === id));
  const toggle = (u: Row) => Alert.alert(u.status === 'inactive' ? 'Activate account?' : 'Deactivate account?',
    u.status === 'inactive' ? `${u.username} will be able to sign in again.` : `${u.username} will no longer be able to sign in to the portal or the app.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: u.status === 'inactive' ? 'Activate' : 'Deactivate', style: u.status === 'inactive' ? 'default' : 'destructive', onPress: () => update(`users/${u.id}`, { status: u.status === 'inactive' ? 'active' : 'inactive' }) },
    ]);

  const del = (u: Row) => Alert.alert('Delete account?', `${u.full_name || u.username} (${u.username}) will be removed and can no longer log in. Their chat messages stay. This cannot be undone.`, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete', style: 'destructive', onPress: async () => {
        const ops: { op: 'set' | 'update' | 'delete'; path: string; data?: any }[] = [
          { op: 'set', path: `deleted_users/${u.id}`, data: { username: u.username, deleted_by: uid, date_deleted: Date.now() } },
          { op: 'delete', path: `users/${u.id}` },
          { op: 'delete', path: `presence/${u.id}` },
          { op: 'delete', path: `profiles/${u.id}` },
        ];
        if (u.member_id) ops.push({ op: 'update', path: `members/${u.member_id}`, data: { uid: '', username: '' } });
        try { await batch(ops); } catch {
          try { await batch(ops.filter((o) => !o.path.startsWith('members/'))); } catch (e: any) { Alert.alert('Could not delete', e?.message || ''); }
        }
      },
    },
  ]);

  return (
    <Page title="User Accounts" subtitle="Admin only" onBack={onBack}
      right={<IconButton name="person-add" label="Add account" onPress={() => setEditing(null)} />}>
      <Chips options={[['staff', 'Officers & staff'], ['students', 'Students'], ['all', 'All']]} value={filter} onChange={setFilter} />
      {!users ? <Loading /> : rows.length === 0 ? <Empty text="No accounts." /> : rows.map((u) => (
        <Card key={u.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar uid={u.id} name={u.full_name || u.username} size={40} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <T bold>{u.full_name}</T>
              <T small muted>{u.username} · {ROLES[u.role] || u.role} · since {fmtDate(u.date_created)}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, marginRight: 5, backgroundColor: online(u.id) ? colors.green : '#b8c0cf' }} />
                <T small muted>{online(u.id) ? 'Active now' : 'Offline'}</T>
              </View>
            </View>
            <Badge value={u.status} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Btn title="Edit" kind="light" onPress={() => setEditing(u)} style={{ flex: 1, paddingVertical: 8 }} />
            {u.id !== uid && <Btn title={u.status === 'inactive' ? 'Activate' : 'Deactivate'} kind={u.status === 'inactive' ? 'green' : 'light'} onPress={() => toggle(u)} style={{ flex: 1, paddingVertical: 8 }} />}
            {u.id !== uid && <Btn title="Delete" kind="danger" icon="trash-outline" onPress={() => del(u)} style={{ flex: 1, paddingVertical: 8 }} />}
          </View>
        </Card>
      ))}
      <T small muted>Student logins are created from Membership Records.</T>
      {editing !== undefined && <AccountForm account={editing} onClose={() => setEditing(undefined)} />}
    </Page>
  );
}
