import { useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { api, fmtDate, authError } from '../data/api';
import { useCollection, useSession } from '../data/hooks';
import { Confirm, PageHead, Field, Loading } from '../components/ui';
import { FileLink } from '../components/FileLink';

const CATEGORIES = ['Minutes of Meeting', 'Constitution & By-Laws', 'Letters & Memos', 'Event Proposal', 'Reports', 'Forms', 'Others'];

export default function Documents() {
  const { uid, user } = useSession();
  const canEdit = ['admin', 'officer'].includes(user.role);
  const docs = useCollection('documents', { orderBy: ['date_uploaded', 'desc'] });
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [q, setQ] = useState('');
  const fileRef = useRef(null);

  const add = async (e) => {
    e.preventDefault();
    setError('');
    if (!file) { setError('Please choose a file.'); return; }
    setBusy(true);
    try {
      const up = await api.upload(file, 'documents');
      await api.add('documents', {
        title: title.trim() || file.name, category, file_path: up.url, file_name: up.name,
        date_uploaded: Date.now(), uploaded_by: uid, uploaded_by_name: user.full_name || user.username,
      });
      setTitle(''); setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setError(authError(err));
    } finally { setBusy(false); }
  };

  const term = q.trim().toLowerCase();
  const rows = (docs || []).filter((d) => !term || `${d.title} ${d.category} ${d.file_name}`.toLowerCase().includes(term));

  return (
    <>
      <PageHead title="Document Management" sub="Upload, store and retrieve important organizational files." />
      {canEdit && (
        <form className="card" style={{ marginBottom: 18 }} onSubmit={add}>
          {error && <div className="error">{error}</div>}
          <div className="grid g2" style={{ gap: '0 16px' }}>
            <Field label="Document Title"><input className="input" placeholder="Enter document title" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Category">
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            </Field>
          </div>
          <Field label="Select File">
            <div className="file-box"><input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
          </Field>
          <button className="btn" disabled={busy}>{busy ? 'Uploading…' : 'Add Document'}</button>
        </form>
      )}
      <div className="card">
        <div className="card-title">
          Available Documents
          <input className="input" style={{ maxWidth: 260, fontWeight: 400 }} placeholder="Search documents..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {!docs ? <Loading /> : rows.length === 0 ? <div className="empty">No documents added yet.</div> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Title</th><th>Category</th><th>Uploaded</th><th>By</th><th>File</th>{canEdit && <th />}</tr></thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td><span className="row"><FileText size={16} color="#3b6fd8" />{d.title}</span></td>
                    <td>{d.category}</td>
                    <td>{fmtDate(d.date_uploaded)}</td>
                    <td>{d.uploaded_by_name}</td>
                    <td><FileLink url={d.file_path} name={d.file_name} /></td>
                    {canEdit && <td><button className="chip-btn del" onClick={() => setDeleting(d)}>Delete</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {deleting && (
        <Confirm title="Delete document?" message={`"${deleting.title}" will be removed from the list.`}
          onConfirm={() => api.remove(`documents/${deleting.id}`)} onClose={() => setDeleting(null)} />
      )}
    </>
  );
}
