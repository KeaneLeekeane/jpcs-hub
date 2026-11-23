import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkle, UserRound, CalendarDays, Megaphone, PhilippinePeso } from 'lucide-react';
import { useCollection, useDoc, useSession } from '../data/hooks';
import { api, peso, fmtDate, can, isStaff } from '../data/api';
import { Stat, Loading, StatusBadge } from '../components/ui';

export default function Dashboard() {
  const { uid, user } = useSession();
  const staff = isStaff(user.role);
  // Students can't read every record, so staff dashboards keep a small
  // stats/summary document up to date and students read the totals from it.
  const summary = useDoc(staff ? null : 'stats/summary');
  const myRecord = useCollection(staff ? null : 'members', { where: [['uid', uid]] });
  const members = useCollection(staff ? 'members' : null);
  const events = useCollection('events', { orderBy: ['event_date', 'asc'] });
  const announcements = useCollection('announcements', { orderBy: ['date_posted', 'desc'] });
  const liquidations = useCollection(staff ? 'liquidations' : null);

  const expenses = staff ? (liquidations || []).reduce((s, l) => s + (Number(l.total_amount) || 0), 0) : Number(summary?.expenses || 0);
  const memberCount = staff ? members?.length : summary?.members;

  useEffect(() => {
    if (!staff || !members || !liquidations) return;
    api.set('stats/summary', {
      members: members.length, active_members: members.filter((m) => m.membership_status === 'Active').length,
      expenses, updated: Date.now(),
    }, { merge: true }).catch(() => {});
  }, [staff, members?.length, expenses]); // eslint-disable-line react-hooks/exhaustive-deps
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
        <Stat label="Total Members" value={memberCount ?? '…'} icon={UserRound} tone="blue" />
        <Stat label="Total Events" value={events ? events.length : '…'} icon={CalendarDays} tone="purple" />
        <Stat label="Announcements" value={announcements ? announcements.length : '…'} icon={Megaphone} tone="amber" />
        <Stat label="Recorded Expenses" value={staff && !liquidations ? '…' : peso(expenses)} icon={PhilippinePeso} tone="green" />
      </div>

      {!staff && (
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="card-title">My Membership <Link className="link" to="/membership">View</Link></div>
          {!myRecord ? <Loading /> : !myRecord[0] ? <div className="empty">No membership record is linked to this login yet.</div> : (
            <div className="row">
              <div style={{ flex: 1 }}>
                <b>{myRecord[0].first_name} {myRecord[0].last_name}</b>
                <div className="muted small">{myRecord[0].student_no} · {myRecord[0].course} · {myRecord[0].year_level}</div>
              </div>
              <StatusBadge value={myRecord[0].membership_status} />
            </div>
          )}
        </div>
      )}

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
