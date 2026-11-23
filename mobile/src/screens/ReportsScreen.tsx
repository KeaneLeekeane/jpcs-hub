import { View } from 'react-native';
import { useCollection } from '../session';
import { Page, Card, H, T, Stat, Badge, Empty, Loading } from '../kit';
import { peso } from '../helpers';

export default function ReportsScreen({ onBack }: { onBack?: () => void }) {
  const members = useCollection('members');
  const events = useCollection('events', { orderBy: ['event_date', 'asc'] });
  const liquidations = useCollection('liquidations');
  if (!members || !events || !liquidations) return <Page title="Reports" onBack={onBack}><Loading /></Page>;
  const count = (s: string) => members.filter((m) => m.membership_status === s).length;
  const totalExpenses = liquidations.reduce((s, l) => s + Number(l.total_amount || 0), 0);
  return (
    <Page title="Reports" subtitle="Membership and event financial summary" onBack={onBack}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Stat label="All Members" value={members.length} />
        <Stat label="Active Members" value={count('Active')} />
        <Stat label="Total Events" value={events.length} />
        <Stat label="Total Expenses" value={peso(totalExpenses)} />
      </View>
      <Card>
        <H>Membership Summary</H>
        {['Active', 'Pending', 'Inactive'].map((s) => (
          <View key={s} style={{ flexDirection: 'row', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f0f2f7' }}>
            <T style={{ flex: 1 }}>{s} Members</T><T bold>{count(s)}</T>
          </View>
        ))}
      </Card>
      <Card>
        <H>Members by Year Level</H>
        {['1st Year', '2nd Year', '3rd Year', '4th Year'].map((y) => (
          <View key={y} style={{ flexDirection: 'row', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f0f2f7' }}>
            <T style={{ flex: 1 }}>{y}</T><T bold>{members.filter((m) => m.year_level === y).length}</T>
          </View>
        ))}
      </Card>
      <Card>
        <H>Event Liquidation Summary</H>
        {liquidations.length === 0 ? <Empty text="No liquidation records yet." /> : liquidations.map((l) => (
          <View key={l.id} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f0f2f7' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <T bold style={{ flex: 1 }}>{l.event_title}</T>
              <Badge value={l.status} />
            </View>
            <T small muted>Budget {peso(l.allocated_budget)} · Spent {peso(l.total_amount)} · Left {peso(Number(l.allocated_budget || 0) - Number(l.total_amount || 0))}</T>
            {!!l.verified_by_name && <T small muted>Verified by {l.verified_by_name}</T>}
          </View>
        ))}
      </Card>
      <T small muted>To print reports, use Reports → Print Report on the web portal or laptop app.</T>
    </Page>
  );
}
