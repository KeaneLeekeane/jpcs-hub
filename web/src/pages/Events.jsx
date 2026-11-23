import { useState } from 'react';
import { CalendarDays, MapPin } from 'lucide-react';
import { api, can } from '../data/api';
import { useCollection, useSession } from '../data/hooks';
import { Modal, Confirm, PageHead, Field, StatusBadge, Loading } from '../components/ui';

const STATUSES = ['Upcoming', 'Completed', 'Cancelled'];

function EventForm({ item, onClose }) {
  const { uid } = useSession();
  const [form, setForm] = useState({ event_title: '', description: '', event_date: '', venue: '', status: 'Upcoming', ...item });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const data = {
        event_title: form.event_title.trim(), description: form.description.trim(),
        event_date: form.event_date, venue: form.venue.trim(), status: form.status,
      };
      if (item.id) {
        await api.update(`events/${item.id}`, data);
      } else {
        await api.add('events', { ...data, created_by: uid });
      }
      onClose();
    } finally { setBusy(false); }
  };

  return (
    <Modal title={item.id ? 'Edit Event' : 'Add Event'} onClose={onClose}>
      <form onSubmit={save}>
        <Field label="Event Title"><input className="input" value={form.event_title} onChange={set('event_title')} required /></Field>
        <Field label="Description"><textarea className="input" rows={3} value={form.description} onChange={set('description')} /></Field>
        <div className="grid g2" style={{ gap: '0 16px' }}>
          <Field label="Date"><input className="input" type="date" value={form.event_date} onChange={set('event_date')} required /></Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={set('status')}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          </Field>
        </div>
        <Field label="Venue"><input className="input" value={form.venue} onChange={set('venue')} required /></Field>
        <div className="modal-actions">
          <button type="button" className="btn light" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save Event'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Events() {
  const { user } = useSession();
  const editable = can(user.role, 'announcements'); // admin + officer manage events
  const events = useCollection('events', { orderBy: ['event_date', 'asc'] });
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  return (
    <>
      <PageHead title="Events Management" sub="Organize and view JPCS activities.">
        {editable && <button className="btn" onClick={() => setEditing({})}>+ Add Event</button>}
      </PageHead>
      {!events ? <Loading /> : events.length === 0 ? <div className="card empty">No events yet.</div> : (
        <div className="grid g2">
          {events.map((e) => (
            <div className="card item-card" key={e.id}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <h3 style={{ flex: 1 }}>{e.event_title}</h3>
                <StatusBadge value={e.status} />
              </div>
              <p>{e.description}</p>
              <div className="item-meta"><CalendarDays style={{ color: '#3b6fd8' }} /> {e.event_date}</div>
              <div className="item-meta"><MapPin /> {e.venue}</div>
              {editable && (
                <div style={{ marginTop: 12 }}>
                  <button className="chip-btn edit" onClick={() => setEditing(e)}>Edit</button>
                  <button className="chip-btn del" onClick={() => setDeleting(e)}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {editing && <EventForm item={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <Confirm title="Delete event?" message={`"${deleting.event_title}" will be removed. Its liquidation record (if any) is kept for audit.`}
          onConfirm={() => api.remove(`events/${deleting.id}`)} onClose={() => setDeleting(null)} />
      )}
    </>
  );
}
