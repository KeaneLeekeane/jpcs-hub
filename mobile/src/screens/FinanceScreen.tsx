// Event Fund and Liquidation: Treasurer records budget and expenses (with
// receipt / proof photos) and submits; Auditor approves or returns with remarks.
import { useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { useCollection, useSession } from '../session';
import { add, inc, remove, set, update, subDoc, type Row } from '../firebase';
import { Page, Card, H, T, Btn, Field, Chips, Badge, Stat, Sheet, Empty, Loading, ErrorText } from '../kit';
import { peso, fmtDate } from '../helpers';
import { useFileOpener, Thumb, pickAndSavePhoto } from './AttachmentView';

const CATEGORIES = ['Food', 'Transportation', 'Papers & Printing', 'Materials & Supplies', 'Venue', 'Others'];
const LOCKED = ['For Review', 'Approved'];

function useLiquidation(id: string) {
  const [row, setRow] = useState<Row | null | undefined>(undefined);
  useEffect(() => { if (!id) { setRow(null); return undefined; } setRow(undefined); return subDoc(`liquidations/${id}`, setRow); }, [id]);
  return row;
}

function ExpenseForm({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const { uid } = useSession();
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [receipt, setReceipt] = useState('');
  const [proof, setProof] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const attach = async (which: 'receipt' | 'proof', camera: boolean) => {
    setError('');
    setBusy(true);
    try {
      const url = await pickAndSavePhoto(which === 'receipt' ? `receipts/${eventId}` : `proofs/${eventId}`, camera);
      if (url) (which === 'receipt' ? setReceipt : setProof)(url);
    } catch (e: any) { setError(e?.message || 'Could not attach photo.'); } finally { setBusy(false); }
  };

  const save = async () => {
    setError('');
    const value = Number(amount);
    if (!description.trim()) { setError('Enter a description.'); return; }
    if (!(value > 0)) { setError('Enter an amount greater than zero.'); return; }
    setBusy(true);
    try {
      await add('expense_items', {
        liquidation_id: eventId, event_id: eventId, description: description.trim(), category, amount: value,
        receipt_url: receipt, proof_url: proof, date_recorded: Date.now(), recorded_by: uid,
      });
      await update(`liquidations/${eventId}`, { total_amount: inc(value) });
      onClose();
    } catch (e: any) { setError(e?.message || 'Could not save.'); } finally { setBusy(false); }
  };

  return (
    <Sheet visible title="Record Expense" onClose={onClose}>
      <ErrorText text={error} />
      <Field label="Expense Description" value={description} onChange={setDescription} placeholder="Example: Food and materials" />
      <Chips label="Category" options={CATEGORIES} value={category} onChange={setCategory} />
      <Field label="Amount (₱)" value={amount} onChange={setAmount} keyboard="decimal-pad" placeholder="Enter amount" />
      <T bold style={{ marginBottom: 6 }}>Official Receipt {receipt ? '✓ attached' : '(optional)'}</T>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <Btn title="Camera" icon="camera" kind="light" onPress={() => attach('receipt', true)} disabled={busy} style={{ flex: 1 }} />
        <Btn title="Gallery" icon="images" kind="light" onPress={() => attach('receipt', false)} disabled={busy} style={{ flex: 1 }} />
      </View>
      <T bold style={{ marginBottom: 6 }}>Proof of Purchase {proof ? '✓ attached' : '(optional)'}</T>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <Btn title="Camera" icon="camera" kind="light" onPress={() => attach('proof', true)} disabled={busy} style={{ flex: 1 }} />
        <Btn title="Gallery" icon="images" kind="light" onPress={() => attach('proof', false)} disabled={busy} style={{ flex: 1 }} />
      </View>
      <Btn title="Add Expense" onPress={save} busy={busy} />
    </Sheet>
  );
}

export default function FinanceScreen({ onBack }: { onBack?: () => void }) {
  const { uid, user } = useSession();
  const canRecord = ['admin', 'treasurer'].includes(user.role);
  const canVerify = ['admin', 'auditor'].includes(user.role);
  const events = useCollection('events', { orderBy: ['event_date', 'asc'] });
  const liquidations = useCollection('liquidations');
  const [selected, setSelected] = useState('');
  const [budget, setBudget] = useState('');
  const [remarks, setRemarks] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { open, viewer } = useFileOpener();

  const options = useMemo(() => {
    const list: [string, string][] = (events || []).map((e) => [e.id, e.event_title]);
    for (const l of liquidations || []) if (!list.some(([id]) => id === l.id)) list.push([l.id, `${l.event_title} (removed)`]);
    return list;
  }, [events, liquidations]);
  useEffect(() => {
    if (!selected && options.length) setSelected(((options.find(([id]) => (liquidations || []).some((l) => l.id === id))) || options[0])[0]);
  }, [options, selected, liquidations]);

  const liq = useLiquidation(selected);
  const items = useCollection(selected ? 'expense_items' : null, { where: [['liquidation_id', selected]], orderBy: ['date_recorded', 'asc'] });
  const event = (events || []).find((e) => e.id === selected);
  useEffect(() => { setBudget(liq?.allocated_budget ? String(liq.allocated_budget) : ''); setRemarks(liq?.remarks || ''); }, [liq?.allocated_budget, liq?.remarks, selected]);

  const total = (items || []).reduce((s, i) => s + Number(i.amount || 0), 0);
  const allocated = Number(liq?.allocated_budget || 0);
  const status = liq?.status || 'Draft';
  const locked = LOCKED.includes(status);
  const name = user.full_name || user.username;

  const run = async (fn: () => Promise<any>) => { setError(''); setBusy(true); try { await fn(); } catch (e: any) { setError(e?.message || 'Something went wrong.'); } finally { setBusy(false); } };

  const saveBudget = () => run(async () => {
    const amount = Number(budget);
    if (!(amount >= 0)) throw new Error('Enter a valid budget.');
    if (liq) await update(`liquidations/${selected}`, { allocated_budget: amount, event_title: event?.event_title || liq.event_title });
    else await set(`liquidations/${selected}`, {
      event_id: selected, event_title: event?.event_title || '', allocated_budget: amount, total_amount: 0, prepared_by: uid, prepared_by_name: name,
      verified_by: '', verified_by_name: '', date_submitted: 0, date_verified: 0, status: 'Draft', remarks: '',
    });
  });
  const submit = () => run(() => update(`liquidations/${selected}`, { status: 'For Review', date_submitted: Date.now(), total_amount: total, prepared_by: uid, prepared_by_name: name }));
  const verify = (s: string) => run(() => update(`liquidations/${selected}`, { status: s, remarks: remarks.trim(), verified_by: uid, verified_by_name: name, date_verified: Date.now() }));
  const deleteItem = (it: Row) => Alert.alert('Delete expense?', `${it.description} (${peso(it.amount)})`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => run(async () => { await remove(`expense_items/${it.id}`); await update(`liquidations/${selected}`, { total_amount: inc(-Number(it.amount || 0)) }); }) },
  ]);

  if (!events || !liquidations) return <Page title="Financial Management" onBack={onBack}><Loading /></Page>;

  return (
    <Page title="Financial Management" subtitle="Event budget and liquidation" onBack={onBack}>
      {viewer}
      {options.length === 0 ? <Empty text="Create an event first, then record its budget and expenses here." /> : (
        <>
          <Chips label="Event" options={options} value={selected} onChange={setSelected} />
          <ErrorText text={error} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <Stat label="Allocated Budget" value={peso(allocated)} />
            <Stat label="Total Expenses" value={peso(total)} />
            <Stat label="Remaining Budget" value={peso(allocated - total)} />
            <View style={{ flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e4e8f1', padding: 14 }}>
              <T small muted>Liquidation Status</T>
              <View style={{ marginTop: 8 }}><Badge value={status} /></View>
              {liq?.date_submitted > 0 && <T small muted style={{ marginTop: 6 }}>Submitted {fmtDate(liq?.date_submitted)}</T>}
            </View>
          </View>

          {canRecord && (
            <Card>
              <H>Event Budget</H>
              <Field label="Allocated Budget (₱)" value={budget} onChange={setBudget} keyboard="decimal-pad" editable={!locked} />
              <Btn title="Save Budget" onPress={saveBudget} busy={busy} disabled={locked} />
              {locked && <T small muted style={{ marginTop: 8 }}>Locked while {status === 'Approved' ? 'approved' : 'under review by the Auditor'}.</T>}
            </Card>
          )}

          <Card>
            <H right={<Badge value={status} />}>Expense Records</H>
            {!items ? <Loading /> : items.length === 0 ? <Empty text="No expenses recorded yet." /> : items.map((it) => (
              <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f0f2f7', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <T bold>{it.description}</T>
                  <T small muted>{it.category} · {fmtDate(it.date_recorded)}</T>
                  <T bold style={{ marginTop: 2 }}>{peso(it.amount)}</T>
                </View>
                <Thumb url={it.receipt_url} label="Official receipt" onPress={() => open(it.receipt_url)} />
                <Thumb url={it.proof_url} label="Proof of purchase" onPress={() => open(it.proof_url)} />
                {canRecord && !locked && <Btn title="✕" kind="danger" onPress={() => deleteItem(it)} style={{ paddingHorizontal: 10, paddingVertical: 6 }} />}
              </View>
            ))}
            {!!items?.length && <T bold style={{ marginTop: 8 }}>Total: {peso(total)}</T>}
            {canRecord && liq && !locked && (
              <View style={{ gap: 8, marginTop: 12 }}>
                <Btn title="+ Record Expense" kind="light" onPress={() => setAdding(true)} />
                {['Draft', 'Returned'].includes(status) && <Btn title="Submit for Auditor Review" onPress={submit} busy={busy} disabled={!items?.length} />}
              </View>
            )}
            {canRecord && !liq && <T small muted style={{ marginTop: 8 }}>Save the event budget first to record expenses.</T>}
          </Card>

          {canVerify && status === 'For Review' && (
            <Card>
              <H>Auditor Review</H>
              <Field label="Auditor Remarks" value={remarks} onChange={setRemarks} multiline placeholder="Notes about the receipts and expenses…" />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Btn title="Approve" kind="green" onPress={() => verify('Approved')} busy={busy} style={{ flex: 1 }} />
                <Btn title="Return" kind="danger" onPress={() => verify('Returned')} disabled={!remarks.trim() || busy} style={{ flex: 1 }} />
              </View>
            </Card>
          )}
          <Card>
            <T small muted>{liq?.remarks ? `Auditor remarks: ${liq.remarks}${liq.verified_by_name ? ` — ${liq.verified_by_name}` : ''}` : 'Auditor remarks will appear here.'}</T>
            {!!liq?.prepared_by_name && <T small muted style={{ marginTop: 4 }}>Prepared by {liq.prepared_by_name}</T>}
          </Card>
        </>
      )}
      {adding && <ExpenseForm eventId={selected} onClose={() => setAdding(false)} />}
    </Page>
  );
}
