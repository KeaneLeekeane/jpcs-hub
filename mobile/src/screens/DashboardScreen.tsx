import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useCollection, useSession } from '../session';
import { set, subDoc, type Row } from '../firebase';
import { Page, Card, H, T, Stat, Empty, Loading, Badge } from '../kit';
import { peso, fmtDate, today } from '../helpers';
import { colors } from '../theme';

export default function DashboardScreen({ onOpen }: { onOpen: (screen: string) => void }) {
  const { uid, user, isStudent } = useSession();
  // Students read totals from stats/summary (kept up to date by staff).
  const [summary, setSummary] = useState<Row | null>(null);
  useEffect(() => (isStudent ? subDoc('stats/summary', setSummary) : undefined), [isStudent]);
  const myRecord = useCollection(isStudent ? 'members' : null, { where: [['uid', uid]] });
  const members = useCollection(isStudent ? null : 'members');
  const events = useCollection('events', { orderBy: ['event_date', 'asc'] });
  const announcements = useCollection('announcements', { orderBy: ['date_posted', 'desc'] });
  const liquidations = useCollection(isStudent ? null : 'liquidations');
  const expenses = isStudent ? Number(summary?.expenses || 0) : (liquidations || []).reduce((s, l) => s + Number(l.total_amount || 0), 0);
  const memberCount = isStudent ? (summary?.members ?? '…') : (members ? members.length : '…');
  useEffect(() => {
    if (isStudent || !members || !liquidations) return;
    set('stats/summary', { members: members.length, active_members: members.filter((m) => m.membership_status === 'Active').length, expenses, updated: Date.now() }, true).catch(() => {});
  }, [isStudent, members?.length, expenses]); // eslint-disable-line react-hooks/exhaustive-deps
  const upcoming = (events || []).filter((e) => (e.event_date || '') >= today() && e.status !== 'Cancelled').slice(0, 3);

  return (
    <Page title="Dashboard" subtitle={`Welcome, ${user.full_name || user.username}`}>
      <Card style={{ backgroundColor: '#2d63d4', borderColor: '#2d63d4' }}>
        <T bold style={{ color: '#fff', fontSize: 19 }}>Welcome to JPCS HUB!</T>
        <T style={{ color: '#e3ebff', marginTop: 4 }}>Manage membership records and organizational activities in one place.</T>
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Stat label="Total Members" value={memberCount} icon="person-outline" tone="blue" />
        <Stat label="Total Events" value={events ? events.length : '…'} icon="calendar-outline" tone="purple" />
        <Stat label="Announcements" value={announcements ? announcements.length : '…'} icon="megaphone-outline" tone="amber" />
        <Stat label="Recorded Expenses" value={!isStudent && !liquidations ? '…' : peso(expenses)} icon="cash-outline" tone="green" />
      </View>
      {isStudent && (
        <Card onPress={() => onOpen('membership')}>
          <H right={<T small style={{ color: colors.blue, fontWeight: '700' }}>View</T>}>My Membership</H>
          {!myRecord ? <Loading /> : !myRecord[0] ? <Empty text="No membership record is linked to this login yet." /> : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <T bold>{myRecord[0].first_name} {myRecord[0].last_name}</T>
                <T small muted>{myRecord[0].student_no} · {myRecord[0].course} · {myRecord[0].year_level}</T>
              </View>
              <Badge value={myRecord[0].membership_status} />
            </View>
          )}
        </Card>
      )}
      <Card onPress={() => onOpen('announcements')}>
        <H right={<T small style={{ color: colors.blue, fontWeight: '700' }}>View All</T>}>Recent Announcements</H>
        {!announcements ? <Loading /> : announcements.length === 0 ? <Empty text="No announcements yet." /> : announcements.slice(0, 2).map((a) => (
          <View key={a.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f0f2f7' }}>
            <T bold>{a.title}</T>
            <T small muted>{fmtDate(a.date_posted)}</T>
            <T muted lines={2}>{a.content}</T>
          </View>
        ))}
      </Card>
      <Card onPress={() => onOpen('events')}>
        <H right={<T small style={{ color: colors.blue, fontWeight: '700' }}>View All</T>}>Upcoming Events</H>
        {!events ? <Loading /> : upcoming.length === 0 ? <Empty text="No upcoming events." /> : upcoming.map((e) => (
          <View key={e.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f0f2f7' }}>
            <T bold>{e.event_title}</T>
            <T small muted>{e.event_date} · {e.venue}</T>
            <T muted lines={2}>{e.description}</T>
          </View>
        ))}
      </Card>
    </Page>
  );
}
