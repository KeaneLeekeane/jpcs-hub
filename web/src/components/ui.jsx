import { useState } from 'react';

export function Modal({ title, onClose, children, width }) {
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={width ? { maxWidth: width } : undefined} role="dialog" aria-label={title}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function Confirm({ title = 'Are you sure?', message, confirmLabel = 'Delete', onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose} width={420}>
      <p className="muted" style={{ marginTop: 0 }}>{message}</p>
      <div className="modal-actions">
        <button className="btn light" onClick={onClose}>Cancel</button>
        <button
          className="btn danger"
          disabled={busy}
          onClick={async () => { setBusy(true); try { await onConfirm(); onClose(); } finally { setBusy(false); } }}
        >{busy ? 'Please wait…' : confirmLabel}</button>
      </div>
    </Modal>
  );
}

export function PageHead({ title, sub, children }) {
  return (
    <div className="page-head">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="row wrap">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, icon: Icon, tone }) {
  const tones = {
    blue: ['#e8efff', '#2d5fd4'], purple: ['#efe9fd', '#6b46c1'],
    amber: ['#fdf1dc', '#c27c0e'], green: ['#e3f6ea', '#15a05a'],
  };
  const [bg, fg] = tones[tone] || tones.blue;
  return (
    <div className="card stat">
      {Icon && <div className="stat-icon" style={{ background: bg, color: fg }}><Icon /></div>}
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

export function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

export function StatusBadge({ value }) {
  const v = String(value || '');
  const tone = {
    Active: 'green', Approved: 'green', active: 'green', Upcoming: 'blue', Completed: 'green',
    Pending: 'amber', 'For Review': 'amber', Draft: 'gray', Inactive: 'gray', inactive: 'red',
    Returned: 'red', Cancelled: 'red',
  }[v] || 'gray';
  const label = v === 'active' ? 'Active' : v === 'inactive' ? 'Deactivated' : v;
  return <span className={`badge ${tone}`}>{label}</span>;
}

export function Loading() {
  return <div className="empty">Loading…</div>;
}

export function initials(name = '') {
  return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?';
}
