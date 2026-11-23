// Student: their own membership record (read-only).
import { useSession, useCollection } from '../session';
import { Page, Card, H, T, Badge, RowLine, Loading, Empty } from '../kit';
import { fmtDate } from '../helpers';

export default function MyMembershipScreen() {
  const { uid, user } = useSession();
  const mine = useCollection('members', { where: [['uid', uid]] });
  const m = mine?.[0];
  return (
    <Page title="My Membership" subtitle={user.full_name || user.username}>
      {!mine ? <Loading /> : !m ? <Empty text="No membership record is linked to this login yet. Please message the JPCS Officers." /> : (
        <>
          <Card>
            <H right={<Badge value={m.membership_status} />}>{m.first_name} {m.last_name}</H>
            <RowLine label="Student No." value={m.student_no} />
            <RowLine label="Course" value={m.course} />
            <RowLine label="Year Level" value={m.year_level} />
            <RowLine label="E-mail" value={m.email || '—'} />
            <RowLine label="Contact No." value={m.contact_no || '—'} />
            <RowLine label="Registered" value={fmtDate(m.date_registered)} />
            <RowLine label="App username" value={m.username || user.username} />
          </Card>
          <Card>
            <T small muted>
              {m.membership_status === 'Active' ? 'Your JPCS membership is active.'
                : m.membership_status === 'Pending' ? 'Your membership is pending. Message the JPCS Officers if you have questions about requirements.'
                  : 'Your membership is inactive. Message the JPCS Officers to renew it.'}
            </T>
            <T small muted style={{ marginTop: 6 }}>Need to correct your details? Send a message to the JPCS Officers.</T>
          </Card>
        </>
      )}
    </Page>
  );
}
