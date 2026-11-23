import { View } from 'react-native';
import { useCollection, useSession } from '../session';
import { Page, Card, H, T, Stat, Empty, Loading } from '../kit';
import { peso, fmtDate, today } from '../helpers';
import { colors } from '../theme';

export default function DashboardScreen({ onOpen }: { onOpen: (screen: string) => void }) {
  const { user } = useSession();
  const members = useCollection('members');
  const events = useCollection('events', { orderBy: ['event_date', 'asc'] });
  const announcements = useCollection('announcements', { orderBy: ['date_posted', 'desc'] });
  const liquidations = useCollection('liquidations');
  const expenses = (liquidations || []).reduce((s, l) => s + Number(l.total_amount || 0), 0);
  const upcoming = (events || []).filter((e) => (e.event_date || '') >= today() && e.status !== 'Cancelled').slice(0, 3);

  return (
    <Page title="Dashboard" subtitle={`Welcome, ${user.full_name || user.username}`}>
      <Card style={{ backgroundColor: '#2d63d4', borderColor: '#2d63d4' }}>
        <T bold style={{ color: '#fff', fontSize: 19 }}>Welcome to JPCS HUB!</T>
        <T style={{ color: '#e3ebff', marginTop: 4 }}>Manage membership records and organizational activities in one place.</T>
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Stat label="Total Members" value={members ? members.length : '…'} icon="person-outline" tone="blue" />
        <Stat label="Total Events" value={events ? events.length : '…'} icon="calendar-outline" tone="purple" />
        <Stat label="Announcements" value={announcements ? announcements.length : '…'} icon="megaphone-outline" tone="amber" />
        <Stat label="Recorded Expenses" value={liquidations ? peso(expenses) : '…'} icon="cash-outline" tone="green" />
      </View>
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
