// Student: their own printable report. Different from the staff Reports page:
// it has no finances, expenses, liquidations or proof-of-purchase photos —
// only the student's membership record, events and announcements.
import { CalendarDays, Megaphone, UserRound, CalendarCheck } from 'lucide-react';
import { api, fmtDate } from '../data/api';
import { useCollection, useDoc, useSession } from '../data/hooks';
import { PageHead, Stat, StatusBadge, Loading } from '../components/ui';

export default function StudentReports() {
  const { uid, user } = useSession();
  const mine = useCollection('members', { where: [['uid', uid]] });
  const summary = useDoc('stats/summary');
  const events = useCollection('events', { orderBy: ['event_date', 'asc'] });
  const announcements = useCollection('announcements', { orderBy: ['date_posted', 'desc'] });
  if (!mine || !events || !announcements) return <Loading />;

  const m = mine[0];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => (e.event_date || '') >= today && e.status !== 'Cancelled');
  const done = events.filter((e) => e.status === 'Completed' || ((e.event_date || '') < today && e.status !== 'Cancelled'));

  return (
    <>
      <PageHead title="Reports" sub="Your membership and JPCS activity report.">
        <button className="btn no-print" onClick={() => window.print()}>Print Report</button>
      </PageHead>
      <div className="print-only" style={{ marginBottom: 14 }}>
        <h2>JPCS–PTC Member Report</h2>
        <div>{user.full_name || user.username} · Generated {new Date().toLocaleString('en-US')}{api.isDemo ? ' (demo data)' : ''}</div>
      </div>

      <div className="grid g4" style={{ marginBottom: 18 }}>
        <Stat label="JPCS Members" value={summary?.members ?? '…'} icon={UserRound} tone="blue" />
        <Stat label="Upcoming Events" value={upcoming.length} icon={CalendarDays} tone="purple" />
        <Stat label="Completed Events" value={done.length} icon={CalendarCheck} tone="green" />
        <Stat label="Announcements" value={announcements.length} icon={Megaphone} tone="amber" />
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">My Membership</div>
        {!m ? <div className="muted">No membership record is linked to this login yet.</div> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Student No.</th><th>Full Name</th><th>Course</th><th>Year</th><th>Date Registered</th><th>Status</th></tr></thead>
              <tbody>
                <tr>
                  <td>{m.student_no}</td><td>{m.first_name} {m.last_name}</td><td>{m.course}</td>
                  <td>{m.year_level}</td><td>{fmtDate(m.date_registered)}</td><td><StatusBadge value={m.membership_status} /></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">JPCS Events ({events.length})</div>
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

      <div className="card">
        <div className="card-title">Announcements ({announcements.length})</div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Title</th><th>Date Posted</th><th>Posted By</th></tr></thead>
            <tbody>
              {announcements.length === 0 && <tr><td colSpan={3} className="muted">No announcements yet.</td></tr>}
              {announcements.map((a) => (
                <tr key={a.id}><td>{a.title}</td><td>{fmtDate(a.date_posted)}</td><td>{a.posted_by_name || '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
