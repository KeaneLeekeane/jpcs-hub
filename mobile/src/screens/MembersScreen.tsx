import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useCollection, useSession } from '../session';
import { authError, createAccount, newId, remove, set, update, type Row } from '../firebase';
import { Page, Card, T, Btn, Field, Chips, Badge, Sheet, Search, Empty, Loading, ErrorText } from '../kit';
import { IconButton } from '../ui';

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const STATUSES = ['Active', 'Pending', 'Inactive'];

function MemberForm({ member, onClose }: { member: Row | null; onClose: () => void }) {
  const { uid } = useSession();
  const isNew = !member?.id;
  const [f, setF] = useState<Record<string, string>>({
    student_no: member?.student_no || '', first_name: member?.first_name || '', last_name: member?.last_name || '',
    course: member?.course || 'BSIT', year_level: member?.year_level || '1st Year', email: member?.email || '',
    contact_no: member?.contact_no || '', membership_status: member?.membership_status || 'Pending',
  });
  const [withLogin, setWithLogin] = useState(!member?.uid);
  const [loginUser, setLoginUser] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const s = (key: string) => (v: string) => setF({ ...f, [key]: v });
  const needsLogin = withLogin && !member?.uid;

  const save = async () => {
    setError('');
    if (!f.student_no.trim() || !f.first_name.trim() || !f.last_name.trim()) { setError('Student No., first name and last name are required.'); return; }
    if (needsLogin && password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setBusy(true);
    try {
      const id = member?.id || newId('members');
      const data: Record<string, any> = {
        student_no: f.student_no.trim(), first_name: f.first_name.trim(), last_name: f.last_name.trim(), course: f.course.trim(),
        year_level: f.year_level, email: f.email.trim(), contact_no: f.contact_no.trim(), membership_status: f.membership_status, updated_by: uid,
      };
      const fullName = `${data.first_name} ${data.last_name}`;
      if (needsLogin) {
        const username = (loginUser || data.student_no).trim().toLowerCase();
        const sUid = await createAccount(username, password);
        await set(`users/${sUid}`, {
          full_name: fullName, username, email: data.email, role: 'student', status: 'active', member_id: id, date_created: Date.now(), last_active: 0,
        });
        data.uid = sUid;
        data.username = username;
      } else if (member?.uid) {
        await update(`users/${member.uid}`, { full_name: fullName, email: data.email, status: data.membership_status === 'Inactive' ? 'inactive' : 'active' });
      }
      if (isNew) await set(`members/${id}`, { uid: '', username: '', ...data, date_registered: Date.now() });
      else await update(`members/${id}`, data);
      onClose();
    } catch (e) {
      setError(authError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible title={isNew ? 'Add Member' : 'Edit Member'} onClose={onClose}>
      <ErrorText text={error} />
      <Field label="Student No." value={f.student_no} onChange={s('student_no')} />
      <Field label="First Name" value={f.first_name} onChange={s('first_name')} />
      <Field label="Last Name" value={f.last_name} onChange={s('last_name')} />
      <Field label="Course" value={f.course} onChange={s('course')} />
      <Chips label="Year Level" options={YEARS} value={f.year_level} onChange={s('year_level')} />
      <Chips label="Membership Status" options={STATUSES} value={f.membership_status} onChange={s('membership_status')} />
      <Field label="E-mail" value={f.email} onChange={s('email')} keyboard="email-address" />
      <Field label="Contact No." value={f.contact_no} onChange={s('contact_no')} keyboard="numeric" />
      {member?.uid ? (
        <Card style={{ marginBottom: 12 }}><T small muted>Mobile app login: <T small bold>{member.username}</T></T></Card>
      ) : (
        <Card style={{ marginBottom: 12, backgroundColor: '#fafbfd' }}>
          <Chips label="Mobile app login (Messenger and Video Call)" options={[['yes', 'Create login'], ['no', 'No login']]} value={withLogin ? 'yes' : 'no'} onChange={(v) => setWithLogin(v === 'yes')} />
          {withLogin && (
            <>
              <Field label="Username" value={loginUser} onChange={setLoginUser} placeholder={f.student_no || 'Student No.'} keyboard="email-address" />
              <Field label="Password" value={password} onChange={setPassword} secure />
            </>
          )}
        </Card>
      )}
      <Btn title="Save Member" onPress={save} busy={busy} />
    </Sheet>
  );
}

export default function MembersScreen({ onBack }: { onBack?: () => void }) {
  const members = useCollection('members', { orderBy: ['student_no', 'asc'] });
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Row | null | undefined>(undefined);
  const term = q.trim().toLowerCase();
  const rows = (members || []).filter((m) => !term || [m.student_no, m.first_name, m.last_name, m.email, m.course, m.membership_status].join(' ').toLowerCase().includes(term));

  const confirmDelete = (m: Row) => Alert.alert('Delete member?', `${m.first_name} ${m.last_name} (${m.student_no}) will be removed${m.uid ? ' and their app login deactivated' : ''}.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await remove(`members/${m.id}`); if (m.uid) await update(`users/${m.uid}`, { status: 'inactive' }).catch(() => {}); } },
  ]);

  return (
    <Page title="Membership Records" subtitle={`${rows.length} member${rows.length === 1 ? '' : 's'}`} onBack={onBack}
      right={<IconButton name="person-add" label="Add member" onPress={() => setEditing(null)} />}>
      <Search value={q} onChange={setQ} placeholder="Search member..." />
      {!members ? <Loading /> : rows.length === 0 ? <Empty text="No members found." /> : rows.map((m) => (
        <Card key={m.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <T bold>{m.first_name} {m.last_name}</T>
              <T small muted>{m.student_no} · {m.course} · {m.year_level}</T>
              {!!m.email && <T small muted>{m.email}</T>}
              {!!m.username && <T small muted>App login: {m.username}</T>}
            </View>
            <Badge value={m.membership_status} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Btn title="Edit" kind="light" onPress={() => setEditing(m)} style={{ flex: 1, paddingVertical: 8 }} />
            <Btn title="Delete" kind="danger" onPress={() => confirmDelete(m)} style={{ flex: 1, paddingVertical: 8 }} />
          </View>
        </Card>
      ))}
      {editing !== undefined && <MemberForm member={editing} onClose={() => setEditing(undefined)} />}
    </Page>
  );
}
