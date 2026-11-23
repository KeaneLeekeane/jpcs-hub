import { Link } from 'react-router-dom';
import { Sparkle, UserRound, CalendarDays, Megaphone, PhilippinePeso } from 'lucide-react';
import { useCollection, useSession } from '../data/hooks';
import { peso, fmtDate, can } from '../data/api';
import { Stat, Loading } from '../components/ui';

export default function Dashboard() {
  const { user } = useSession();
  const members = useCollection('members');
  const events = useCollection('events', { orderBy: ['event_date', 'asc'] });
  const announcements = useCollection('announcements', { orderBy: ['date_posted', 'desc'] });
  const liquidations = useCollection(can(user.role, 'finance') || user.role === 'officer' ? 'liquidations' : null);

  const expenses = (liquidations || []).reduce((s, l) => s + (Number(l.total_amount) || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (events || []).filter((e) => (e.event_date || '') >= today && e.status !== 'Cancelled').slice(0, 3);

  return (
    <>
      <div className="banner">
        <h2>Welcome to JPCS HUB!</h2>
        <p>Manage membership records and organizational activities in one place.</p>
        <Sparkle fill="#fff" stroke="none" />
      </div>

      <div className="grid g4" style={{ marginBottom: 22 }}>
        <Stat label="Total Members" value={members ? members.length : '…'} icon={UserRound} tone="blue" />
        <Stat label="Total Events" value={events ? events.length : '…'} icon={CalendarDays} tone="purple" />
        <Stat label="Announcements" value={announcements ? announcements.length : '…'} icon={Megaphone} tone="amber" />
        <Stat label="Recorded Expenses" value={liquidations ? peso(expenses) : '…'} icon={PhilippinePeso} tone="green" />
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-title">
            Recent Announcements
            {can(user.role, 'announcements') && <Link className="link" to="/announcements">View All</Link>}
          </div>
          {!announcements ? <Loading /> : announcements.length === 0 ? <div className="empty">No announcements yet.</div>
            : announcements.slice(0, 3).map((a) => (
              <div className="list-item" key={a.id}>
                <h4>{a.title}</h4>
                <div className="meta">{fmtDate(a.date_posted)}</div>
                <p>{a.content}</p>
              </div>
            ))}
        </div>
        <div className="card">
          <div className="card-title">
            Upcoming Events
            {can(user.role, 'events') && <Link className="link" to="/events">View All</Link>}
          </div>
          {!events ? <Loading /> : upcoming.length === 0 ? <div className="empty">No upcoming events.</div>
            : upcoming.map((e) => (
              <div className="list-item" key={e.id}>
                <h4>{e.event_title}</h4>
                <div className="meta">{e.event_date} · {e.venue}</div>
                <p>{e.description}</p>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
