import { useState } from 'react';
import { api, fmtDate, canManage } from '../data/api';
import { useCollection, useSession } from '../data/hooks';
import { Modal, Confirm, PageHead, Field, Loading } from '../components/ui';

function AnnouncementForm({ item, onClose }) {
  const { uid, user } = useSession();
  const [title, setTitle] = useState(item.title || '');
  const [content, setContent] = useState(item.content || '');
  // New announcements are also posted to Events by default.
  const [toEvents, setToEvents] = useState(item.id ? !!item.event_id : true);
  const [eventDate, setEventDate] = useState(item.event_date || new Date().toISOString().slice(0, 10));
  const [venue, setVenue] = useState(item.venue || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const id = item.id || api.newId('announcements');
      const ann = { title: title.trim(), content: content.trim() };
      const ev = {
        event_title: ann.title, description: ann.content, event_date: eventDate,
        venue: venue.trim() || 'TBA', announcement_id: id,
      };
      let eventId = item.event_id || '';
      if (toEvents) {
        if (eventId) await api.update(`events/${eventId}`, ev);
        else {
          eventId = api.newId('events');
          await api.set(`events/${eventId}`, { ...ev, status: 'Upcoming', created_by: uid });
        }
      } else if (eventId) {
        await api.remove(`events/${eventId}`).catch(() => {});
        eventId = '';
      }
      const link = { event_id: eventId, event_date: toEvents ? eventDate : '', venue: toEvents ? ev.venue : '' };
      if (item.id) await api.update(`announcements/${id}`, { ...ann, ...link });
      else await api.set(`announcements/${id}`, {
        ...ann, ...link, date_posted: Date.now(), posted_by: uid, posted_by_name: user.full_name || user.username,
      });
      onClose();
    } catch (err) {
      setError(err.message || String(err));
    } finally { setBusy(false); }
  };

  return (
    <Modal title={item.id ? 'Edit Announcement' : 'Create Announcement'} onClose={onClose}>
      <form onSubmit={save}>
        {error && <div className="error">{error}</div>}
        <Field label="Title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
        <Field label="Content"><textarea className="input" rows={6} value={content} onChange={(e) => setContent(e.target.value)} required /></Field>
        <div className="card" style={{ padding: 14, marginBottom: 14, background: '#fafbfd' }}>
          <label className="row" style={{ fontWeight: 600, fontSize: 14 }}>
            <input type="checkbox" checked={toEvents} onChange={(e) => setToEvents(e.target.checked)} />
            Also show this in Events
          </label>
          {toEvents && (
            <div className="grid g2" style={{ gap: '0 16px', marginTop: 12 }}>
              <Field label="Event Date"><input className="input" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required /></Field>
              <Field label="Venue"><input className="input" placeholder="TBA" value={venue} onChange={(e) => setVenue(e.target.value)} /></Field>
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn light" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={busy}>{busy ? 'Posting…' : item.id ? 'Save' : 'Post Announcement'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Announcements() {
  const { user } = useSession();
  const manage = canManage(user.role);
  const items = useCollection('announcements', { orderBy: ['date_posted', 'desc'] });
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  return (
    <>
      <PageHead title="Announcements" sub="Post important updates for JPCS members.">
        {manage && <button className="btn" onClick={() => setEditing({})}>+ Create Announcement</button>}
      </PageHead>
      {!items ? <Loading /> : items.length === 0 ? <div className="card empty">No announcements yet.</div> : (
        <div className="grid g2">
          {items.map((a) => (
            <div className="card item-card" key={a.id}>
              <h3>{a.title}</h3>
              <p>{a.content}</p>
              {a.event_id && <div className="item-meta">Event: {a.event_date} · {a.venue}</div>}
              <div className="item-meta">Posted: {fmtDate(a.date_posted)}{a.posted_by_name ? ` · ${a.posted_by_name}` : ''}</div>
              {manage && (
                <div style={{ marginTop: 10 }}>
                  <button className="chip-btn edit" onClick={() => setEditing(a)}>Edit</button>
                  <button className="chip-btn del" onClick={() => setDeleting(a)}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {editing && <AnnouncementForm item={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <Confirm title="Delete announcement?" message={`"${deleting.title}" will be removed${deleting.event_id ? ', together with its entry in Events' : ''}.`}
          onConfirm={async () => {
            if (deleting.event_id) await api.remove(`events/${deleting.event_id}`).catch(() => {});
            await api.remove(`announcements/${deleting.id}`);
          }} onClose={() => setDeleting(null)} />
      )}
    </>
  );
}
