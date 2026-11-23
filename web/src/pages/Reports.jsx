import { api, peso, fmtDate } from '../data/api';
import { useCollection } from '../data/hooks';
import { PageHead, Stat, StatusBadge, Loading } from '../components/ui';

export default function Reports() {
  const members = useCollection('members');
  const events = useCollection('events', { orderBy: ['event_date', 'asc'] });
  const liquidations = useCollection('liquidations');
  const announcements = useCollection('announcements');
  if (!members || !events || !liquidations || !announcements) return <Loading />;

  const count = (s) => members.filter((m) => m.membership_status === s).length;
  const totalExpenses = liquidations.reduce((s, l) => s + Number(l.total_amount || 0), 0);
  const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

  return (
    <>
      <PageHead title="Reports" sub="Summary of membership and event financial records.">
        <button className="btn no-print" onClick={() => window.print()}>Print Report</button>
      </PageHead>
      <div className="print-only" style={{ marginBottom: 14 }}>
        <h2>JPCS–PTC Summary Report</h2>
        <div>Generated {new Date().toLocaleString('en-US')}{api.isDemo ? ' (demo data)' : ''}</div>
      </div>

      <div className="grid g4" style={{ marginBottom: 18 }}>
        <Stat label="All Members" value={members.length} />
        <Stat label="Active Members" value={count('Active')} />
        <Stat label="Total Events" value={events.length} />
        <Stat label="Total Expenses" value={peso(totalExpenses)} />
      </div>

      <div className="grid g2" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card-title">Membership Summary</div>
          {['Active', 'Pending', 'Inactive'].map((s) => (
            <div className="list-item" key={s}>
              <h4>{s} Members</h4>
              <p>{count(s)} member(s)</p>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-title">Members by Year Level</div>
          {years.map((y) => (
            <div className="list-item" key={y}>
              <h4>{y}</h4>
              <p>{members.filter((m) => m.year_level === y).length} member(s)</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Event Liquidation Summary</div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Event</th><th>Allocated Budget</th><th>Total Expenses</th><th>Remaining</th><th>Status</th><th>Verified By</th></tr></thead>
            <tbody>
              {liquidations.length === 0 && <tr><td colSpan={6} className="muted">No liquidation records yet.</td></tr>}
              {liquidations.map((l) => (
                <tr key={l.id}>
                  <td>{l.event_title}</td>
                  <td>{peso(l.allocated_budget)}</td>
                  <td>{peso(l.total_amount)}</td>
                  <td>{peso(Number(l.allocated_budget || 0) - Number(l.total_amount || 0))}</td>
                  <td><StatusBadge value={l.status} /></td>
                  <td>{l.verified_by_name ? `${l.verified_by_name} (${fmtDate(l.date_verified)})` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Events ({events.length}) · Announcements ({announcements.length})</div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Event</th><th>Date</th><th>Venue</th><th>Status</th></tr></thead>
            <tbody>
              {events.length === 0 && <tr><td colSpan={4} className="muted">No events yet.</td></tr>}
              {events.map((e) => (
                <tr key={e.id}><td>{e.event_title}</td><td>{e.event_date}</td><td>{e.venue}</td><td><StatusBadge value={e.status} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
