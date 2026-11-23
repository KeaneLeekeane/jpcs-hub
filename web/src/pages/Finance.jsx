import { useEffect, useMemo, useRef, useState } from 'react';
import { Printer } from 'lucide-react';
import { api, peso, fmtDate, fmtDateTime, authError } from '../data/api';
import { useCollection, useDoc, useSession } from '../data/hooks';
import { PageHead, Field, StatusBadge, Stat, Confirm, Loading } from '../components/ui';
import { Attachment } from '../components/FileLink';

const CATEGORIES = ['Food', 'Transportation', 'Papers & Printing', 'Materials & Supplies', 'Venue', 'Others'];
const LOCKED = ['For Review', 'Approved'];

function BudgetCard({ eventId, event, liq, canRecord }) {
  const { uid, user } = useSession();
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setBudget(liq?.allocated_budget ? String(liq.allocated_budget) : ''); }, [liq?.allocated_budget, eventId]);
  const locked = LOCKED.includes(liq?.status);

  const save = async (e) => {
    e.preventDefault();
    const amount = Number(budget);
    if (!(amount >= 0)) return;
    setBusy(true);
    try {
      if (liq) await api.update(`liquidations/${eventId}`, { allocated_budget: amount, event_title: event?.event_title || liq.event_title });
      else await api.set(`liquidations/${eventId}`, {
        event_id: eventId, event_title: event?.event_title || '', allocated_budget: amount, total_amount: 0,
        prepared_by: uid, prepared_by_name: user.full_name || user.username, verified_by: '', verified_by_name: '',
        date_submitted: 0, date_verified: 0, status: 'Draft', remarks: '',
      });
    } finally { setBusy(false); }
  };

  return (
    <form className="card" onSubmit={save}>
      <div className="card-title">Event Budget</div>
      <Field label="Event Name"><input className="input" value={event?.event_title || liq?.event_title || ''} disabled /></Field>
      <Field label="Allocated Budget (₱)">
        <input className="input" type="number" min="0" step="0.01" placeholder="Enter budget" value={budget}
          onChange={(e) => setBudget(e.target.value)} disabled={!canRecord || locked} required />
      </Field>
      {canRecord && <button className="btn" disabled={busy || locked}>{busy ? 'Saving…' : 'Save Budget'}</button>}
      {locked && <div className="small muted" style={{ marginTop: 10 }}>Locked while {liq.status === 'Approved' ? 'approved' : 'under review by the Auditor'}.</div>}
    </form>
  );
}

function ExpenseCard({ eventId, liq }) {
  const { uid } = useSession();
  const [form, setForm] = useState({ description: '', category: CATEGORIES[0], amount: '' });
  const [receipt, setReceipt] = useState(null);
  const [proof, setProof] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const r1 = useRef(null);
  const r2 = useRef(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const locked = !liq || LOCKED.includes(liq.status);

  const add = async (e) => {
    e.preventDefault();
    setError('');
    const amount = Number(form.amount);
    if (!(amount > 0)) { setError('Enter an amount greater than zero.'); return; }
    setBusy(true);
    try {
      const rec = receipt ? await api.upload(receipt, `receipts/${eventId}`) : null;
      const prf = proof ? await api.upload(proof, `proofs/${eventId}`) : null;
      await api.add('expense_items', {
        liquidation_id: eventId, event_id: eventId, description: form.description.trim(), category: form.category,
        amount, receipt_url: rec?.url || '', proof_url: prf?.url || '', date_recorded: Date.now(), recorded_by: uid,
      });
      await api.update(`liquidations/${eventId}`, { total_amount: api.inc(amount) });
      setForm({ description: '', category: CATEGORIES[0], amount: '' });
      setReceipt(null); setProof(null);
      if (r1.current) r1.current.value = '';
      if (r2.current) r2.current.value = '';
    } catch (err) {
      setError(authError(err));
    } finally { setBusy(false); }
  };

  return (
    <form className="card" onSubmit={add}>
      <div className="card-title">Record Expense</div>
      {error && <div className="error">{error}</div>}
      {!liq && <div className="note" style={{ marginBottom: 12 }}>Save the event budget first.</div>}
      <Field label="Expense Description">
        <input className="input" placeholder="Example: Food and materials" value={form.description} onChange={set('description')} required disabled={locked} />
      </Field>
      <div className="grid g2" style={{ gap: '0 16px' }}>
        <Field label="Category">
          <select className="input" value={form.category} onChange={set('category')} disabled={locked}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="Amount (₱)">
          <input className="input" type="number" min="0" step="0.01" placeholder="Enter amount" value={form.amount} onChange={set('amount')} required disabled={locked} />
        </Field>
      </div>
      <div className="grid g2" style={{ gap: '0 16px' }}>
        <Field label="Official Receipt">
          <div className="file-box"><input ref={r1} type="file" accept="image/*,application/pdf" onChange={(e) => setReceipt(e.target.files?.[0] || null)} disabled={locked} /></div>
        </Field>
        <Field label="Proof of Purchase (photo)">
          <div className="file-box"><input ref={r2} type="file" accept="image/*" onChange={(e) => setProof(e.target.files?.[0] || null)} disabled={locked} /></div>
        </Field>
      </div>
      <button className="btn" disabled={busy || locked}>{busy ? 'Saving…' : 'Add Expense'}</button>
    </form>
  );
}

export default function Finance() {
  const { uid, user } = useSession();
  const canRecord = ['admin', 'treasurer'].includes(user.role);
  const canVerify = ['admin', 'auditor'].includes(user.role);
  const events = useCollection('events', { orderBy: ['event_date', 'asc'] });
  const liquidations = useCollection('liquidations');
  const [selected, setSelected] = useState('');
  const [remarks, setRemarks] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');

  // Options: every event, plus liquidations whose event was deleted.
  const options = useMemo(() => {
    const list = (events || []).map((e) => ({ id: e.id, title: e.event_title, date: e.event_date }));
    for (const l of liquidations || []) if (!list.some((o) => o.id === l.id)) list.push({ id: l.id, title: `${l.event_title} (event removed)` });
    return list;
  }, [events, liquidations]);

  useEffect(() => {
    if (!selected && options.length) {
      const withLiq = options.find((o) => (liquidations || []).some((l) => l.id === o.id));
      setSelected((withLiq || options[0]).id);
    }
  }, [options, selected, liquidations]);

  const liq = useDoc(selected ? `liquidations/${selected}` : null);
  const items = useCollection(selected ? 'expense_items' : null, { where: [['liquidation_id', selected]], orderBy: ['date_recorded', 'asc'] });
  const event = (events || []).find((e) => e.id === selected);
  useEffect(() => { setRemarks(liq?.remarks || ''); }, [liq?.remarks, selected]);

  const total = (items || []).reduce((s, i) => s + Number(i.amount || 0), 0);
  const budget = Number(liq?.allocated_budget || 0);
  const status = liq?.status || 'Draft';
  const editable = canRecord && liq && !LOCKED.includes(status);

  const run = async (fn) => { setError(''); try { await fn(); } catch (e) { setError(authError(e)); } };

  const submitForReview = () => run(() => api.update(`liquidations/${selected}`, {
    status: 'For Review', date_submitted: Date.now(), total_amount: total,
    prepared_by: uid, prepared_by_name: user.full_name || user.username,
  }));
  const verify = (newStatus) => run(() => api.update(`liquidations/${selected}`, {
    status: newStatus, remarks: remarks.trim(), verified_by: uid,
    verified_by_name: user.full_name || user.username, date_verified: Date.now(),
  }));
  const removeItem = async (it) => {
    await api.remove(`expense_items/${it.id}`);
    await api.update(`liquidations/${selected}`, { total_amount: api.inc(-Number(it.amount || 0)) });
  };

  if (!events || !liquidations) return <Loading />;

  return (
    <>
      <PageHead title="Financial Management" sub="Record event budgets and expenses for liquidation monitoring.">
        <select className="input no-print" style={{ width: 260 }} value={selected} onChange={(e) => setSelected(e.target.value)}>
          {options.length === 0 && <option value="">No events yet</option>}
          {options.map((o) => <option key={o.id} value={o.id}>{o.title}{o.date ? ` · ${o.date}` : ''}</option>)}
        </select>
        <button className="btn light no-print" onClick={() => window.print()} disabled={!liq}><Printer /> Print Liquidation</button>
      </PageHead>

      {options.length === 0 ? (
        <div className="card empty">Create an event first (Events page), then record its budget and expenses here.</div>
      ) : (
        <>
          <div className="print-only" style={{ marginBottom: 16 }}>
            <h2>JPCS–PTC Event Liquidation Report</h2>
            <div>{event?.event_title || liq?.event_title} · {event?.event_date} · {event?.venue}</div>
            <div>Status: {status}{liq?.verified_by_name ? ` · Verified by ${liq.verified_by_name} on ${fmtDate(liq.date_verified)}` : ''}</div>
          </div>
          <div className="grid g4" style={{ marginBottom: 18 }}>
            <Stat label="Allocated Budget" value={peso(budget)} />
            <Stat label="Total Expenses" value={peso(total)} />
            <Stat label="Remaining Budget" value={<span style={{ color: budget - total < 0 ? 'var(--red)' : undefined }}>{peso(budget - total)}</span>} />
            <div className="card stat">
              <div className="stat-label">Liquidation Status</div>
              <div style={{ marginTop: 8 }}><StatusBadge value={status} /></div>
              {liq?.date_submitted > 0 && <div className="small muted" style={{ marginTop: 6 }}>Submitted {fmtDate(liq.date_submitted)}</div>}
            </div>
          </div>

          {canRecord && (
            <div className="grid g2 no-print" style={{ marginBottom: 18 }}>
              <BudgetCard eventId={selected} event={event} liq={liq} canRecord={canRecord} />
              <ExpenseCard eventId={selected} liq={liq} />
            </div>
          )}

          <div className="card">
            <div className="card-title">
              Expense Records
              <StatusBadge value={status} />
            </div>
            {error && <div className="error">{error}</div>}
            {!items ? <Loading /> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Description</th><th>Category</th><th>Amount</th><th>Receipt</th><th>Proof</th><th>Date Recorded</th>{editable && <th className="no-print" />}</tr></thead>
                  <tbody>
                    {items.length === 0 && <tr><td colSpan={7}>No expenses recorded yet.</td></tr>}
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td>{it.description}</td>
                        <td>{it.category}</td>
                        <td>{peso(it.amount)}</td>
                        <td><Attachment url={it.receipt_url} label="Official receipt" /></td>
                        <td><Attachment url={it.proof_url} label="Proof of purchase" /></td>
                        <td>{fmtDateTime(it.date_recorded)}</td>
                        {editable && <td className="no-print"><button className="chip-btn del" onClick={() => setDeleting(it)}>Delete</button></td>}
                      </tr>
                    ))}
                    {items.length > 0 && (
                      <tr><td><b>Total</b></td><td /><td><b>{peso(total)}</b></td><td colSpan={4} /></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: 18 }}>
              {canRecord && liq && ['Draft', 'Returned'].includes(status) && (
                <button className="btn no-print" disabled={!items?.length} onClick={submitForReview}>Submit for Auditor Review</button>
              )}
              {canVerify && status === 'For Review' && (
                <div className="no-print">
                  <Field label="Auditor Remarks">
                    <textarea className="input" rows={3} placeholder="Notes about the receipts and expenses…" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                  </Field>
                  <div className="row">
                    <button className="btn green" onClick={() => verify('Approved')}>Approve</button>
                    <button className="btn light" onClick={() => verify('Returned')} disabled={!remarks.trim()}>Return with Remarks</button>
                  </div>
                </div>
              )}
              {canVerify && status !== 'For Review' && user.role === 'auditor' && (
                <div className="small muted">{status === 'Approved' ? 'This liquidation is approved.' : 'Waiting for the Treasurer to submit this liquidation for review.'}</div>
              )}
              <div className="small" style={{ marginTop: 12, color: 'var(--muted)' }}>
                {liq?.remarks ? <><b>Auditor remarks:</b> {liq.remarks}{liq.verified_by_name ? ` — ${liq.verified_by_name}` : ''}</> : 'Auditor remarks will appear here.'}
              </div>
              {liq?.prepared_by_name && <div className="small muted" style={{ marginTop: 6 }}>Prepared by {liq.prepared_by_name}</div>}
            </div>
          </div>
        </>
      )}
      {deleting && (
        <Confirm title="Delete expense?" message={`${deleting.description} (${peso(deleting.amount)}) will be removed.`}
          onConfirm={() => removeItem(deleting)} onClose={() => setDeleting(null)} />
      )}
    </>
  );
}
