// Student: their own membership record. Read-only — students cannot change
// their details, status or role (only the Admin/Officers can, in Membership Records).
import { fmtDate } from '../data/api';
import { useCollection, useSession } from '../data/hooks';
import { PageHead, StatusBadge, Loading } from '../components/ui';
import { Avatar } from '../components/Avatar';

function Row({ label, value }) {
  return (
    <tr><td className="muted" style={{ width: 200 }}>{label}</td><td style={{ fontWeight: 600 }}>{value || '—'}</td></tr>
  );
}

export default function MyMembership() {
  const { uid, user } = useSession();
  const mine = useCollection('members', { where: [['uid', uid]] });
  const m = mine?.[0];
  return (
    <>
      <PageHead title="My Membership" sub="Your JPCS–PTC membership record (view only)." />
      {!mine ? <Loading /> : !m ? (
        <div className="card empty">No membership record is linked to this login yet. Please message the JPCS Officers.</div>
      ) : (
        <div className="grid g2">
          <div className="card">
            <div className="row" style={{ marginBottom: 16 }}>
              <Avatar uid={uid} name={`${m.first_name} ${m.last_name}`} size={56} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{m.first_name} {m.last_name}</div>
                <div className="muted small">{m.student_no} · Student</div>
              </div>
              <StatusBadge value={m.membership_status} />
            </div>
            <table className="table">
              <tbody>
                <Row label="Student No." value={m.student_no} />
                <Row label="Course" value={m.course} />
                <Row label="Year Level" value={m.year_level} />
                <Row label="E-mail" value={m.email} />
                <Row label="Contact No." value={m.contact_no} />
                <Row label="Date Registered" value={fmtDate(m.date_registered)} />
                <Row label="App Username" value={m.username || user.username} />
                <Row label="Role" value="Student" />
              </tbody>
            </table>
          </div>
          <div className="card">
            <div className="card-title">Membership Status</div>
            <p className="muted" style={{ marginTop: 0 }}>
              {m.membership_status === 'Active' ? 'Your JPCS membership is active.'
                : m.membership_status === 'Pending' ? 'Your membership is pending. Message the JPCS Officers if you have questions about the requirements.'
                  : 'Your membership is inactive. Message the JPCS Officers to renew it.'}
            </p>
            <div className="note">These details can only be changed by the JPCS Officers. If something is wrong, send them a message in Messenger.</div>
          </div>
        </div>
      )}
    </>
  );
}
