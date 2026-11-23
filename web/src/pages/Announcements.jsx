import { useState } from 'react';
import { api, fmtDate, canManage } from '../data/api';
import { useCollection, useSession } from '../data/hooks';
import { Modal, Confirm, PageHead, Field, Loading } from '../components/ui';

function AnnouncementForm({ item, onClose }) {
  const { uid, user } = useSession();
  const [title, setTitle] = useState(item.title || '');
  const [content, setContent] = useState(item.content || '');
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (item.id) await api.update(`announcements/${item.id}`, { title: title.trim(), content: content.trim() });
      else await api.add('announcements', {
        title: title.trim(), content: content.trim(), date_posted: Date.now(),
        posted_by: uid, posted_by_name: user.full_name || user.username,
      });
      onClose();
    } finally { setBusy(false); }
  };

  return (
    <Modal title={item.id ? 'Edit Announcement' : 'Create Announcement'} onClose={onClose}>
      <form onSubmit={save}>
        <Field label="Title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
        <Field label="Content"><textarea className="input" rows={6} value={content} onChange={(e) => setContent(e.target.value)} required /></Field>
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
        <Confirm title="Delete announcement?" message={`"${deleting.title}" will be removed.`}
          onConfirm={() => api.remove(`announcements/${deleting.id}`)} onClose={() => setDeleting(null)} />
      )}
    </>
  );
}
