// Student: own report. No finances, expenses or receipt/proof photos —
// only the student's membership record, events and announcements.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useCollection, useSession } from '../session';
import { subDoc, type Row } from '../firebase';
import { Page, Card, H, T, Stat, Badge, Empty, Loading } from '../kit';
import { fmtDate, today } from '../helpers';

const line = { paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#f0f2f7' } as const;

export default function StudentReportsScreen() {
  const { uid } = useSession();
  const [summary, setSummary] = useState<Row | null>(null);
  useEffect(() => subDoc('stats/summary', setSummary), []);
  const mine = useCollection('members', { where: [['uid', uid]] });
  const events = useCollection('events', { orderBy: ['event_date', 'asc'] });
  const announcements = useCollection('announcements', { orderBy: ['date_posted', 'desc'] });
  if (!mine || !events || !announcements) return <Page title="Reports"><Loading /></Page>;
  const m = mine[0];
  const upcoming = events.filter((e) => (e.event_date || '') >= today() && e.status !== 'Cancelled');
  const done = events.filter((e) => e.status === 'Completed' || ((e.event_date || '') < today() && e.status !== 'Cancelled'));

  return (
    <Page title="Reports" subtitle="Your membership and JPCS activity report">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Stat label="JPCS Members" value={summary?.members ?? '…'} icon="person-outline" tone="blue" />
        <Stat label="Upcoming Events" value={upcoming.length} icon="calendar-outline" tone="purple" />
        <Stat label="Completed Events" value={done.length} icon="checkmark-done-outline" tone="green" />
        <Stat label="Announcements" value={announcements.length} icon="megaphone-outline" tone="amber" />
      </View>
      <Card>
        <H>My Membership</H>
        {!m ? <Empty text="No membership record is linked to this login yet." /> : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <T bold>{m.first_name} {m.last_name}</T>
              <T small muted>{m.student_no} · {m.course} · {m.year_level}</T>
              <T small muted>Registered {fmtDate(m.date_registered)}</T>
            </View>
            <Badge value={m.membership_status} />
          </View>
        )}
      </Card>
      <Card>
        <H>JPCS Events ({events.length})</H>
        {events.length === 0 ? <Empty text="No events yet." /> : events.map((e) => (
          <View key={e.id} style={[line, { flexDirection: 'row', alignItems: 'center' }]}>
            <View style={{ flex: 1 }}>
              <T bold>{e.event_title}</T>
              <T small muted>{e.event_date} · {e.venue}</T>
            </View>
            <Badge value={e.status} />
          </View>
        ))}
      </Card>
      <Card>
        <H>Announcements ({announcements.length})</H>
        {announcements.length === 0 ? <Empty text="No announcements yet." /> : announcements.map((a) => (
          <View key={a.id} style={line}>
            <T bold>{a.title}</T>
            <T small muted>{fmtDate(a.date_posted)}{a.posted_by_name ? ` · ${a.posted_by_name}` : ''}</T>
          </View>
        ))}
      </Card>
    </Page>
  );
}
