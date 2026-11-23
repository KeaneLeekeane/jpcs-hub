// Messenger. Two kinds of chats:
//  - Student ↔ JPCS Officers: conversations/{studentUid} (every officer can answer)
//  - Direct chats between any two people: dms/{uidA_uidB}
// Your messages are on the right; you can delete (unsend) your own messages.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Video, Trash2, Users } from 'lucide-react';
import { api, isOnline, isStaff, fmtDateTime, fmtTime, ROLES } from '../data/api';
import { useCollection, useNow, useSession } from '../data/hooks';
import { useCalls } from '../components/Calls';
import { PageHead, Loading, Modal, Confirm } from '../components/ui';
import { Avatar } from '../components/Avatar';

export const pairId = (a, b) => [a, b].sort().join('_');

function lastSeen(p) {
  if (!p?.last_active) return 'Offline';
  if (isOnline(p)) return 'Active now';
  return `Last active ${fmtDateTime(p.last_active)}`;
}

// thread: { kind: 'student' | 'dm', id, base, title, peerUid, memberId }
function ChatPane({ thread, peerOnline, peerStatus, onCall }) {
  const { uid, user } = useSession();
  const staff = isStaff(user.role);
  const messages = useCollection(`${thread.base}/messages`, { orderBy: ['date_sent', 'asc'] });
  const [text, setText] = useState('');
  const [deleting, setDeleting] = useState(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages?.length]);

  // Read indicators: mark messages from others as read while the chat is open.
  useEffect(() => {
    if (!messages || document.visibilityState !== 'visible') return;
    const unread = messages.filter((m) => m.sender_uid !== uid && m.status !== 'read');
    if (!unread.length) return;
    unread.forEach((m) => api.update(`${thread.base}/messages/${m.id}`, { status: 'read' }).catch(() => {}));
    const reset = thread.kind === 'dm' ? { [`unread_${uid}`]: 0 } : staff ? { staff_unread: 0 } : { student_unread: 0 };
    api.update(thread.base, reset).catch(() => {});
  }, [messages, thread.base, thread.kind, uid, staff]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText('');
    const now = Date.now();
    const name = user.full_name || user.username;
    await api.add(`${thread.base}/messages`, {
      member_id: thread.kind === 'student' ? (thread.memberId || user.member_id || '') : '',
      user_id: staff ? uid : '', sender_uid: uid, sender_name: name,
      sender_type: staff ? 'officer' : 'student', message_text: body, date_sent: now, status: 'sent',
    });
    const meta = { last_message: body, last_time: now, last_sender_uid: uid };
    if (thread.kind === 'dm') {
      await api.update(thread.base, { ...meta, [`unread_${thread.peerUid}`]: api.inc(1) });
    } else {
      Object.assign(meta, { last_sender_type: staff ? 'officer' : 'student', [staff ? 'student_unread' : 'staff_unread']: api.inc(1) });
      if (staff) Object.assign(meta, { student_uid: thread.id, student_name: thread.title || 'Student', member_id: thread.memberId || '' });
      else Object.assign(meta, { student_uid: uid, student_name: name, member_id: user.member_id || '' });
      await api.set(thread.base, meta, { merge: true });
    }
  };

  const unsend = (m) => api.update(`${thread.base}/messages/${m.id}`, { deleted: true, message_text: '' });

  return (
    <div className="card chat">
      <div className="chat-head">
        <div className="row">
          {thread.kind === 'student' && !staff
            ? <div className="avatar" style={{ width: 40, height: 40 }}><Users size={18} /></div>
            : <Avatar uid={thread.peerUid} name={thread.title} size={40} online={peerOnline} />}
          <div>
            <h3>{thread.title}</h3>
            <div className="convo-status"><span className={`status-dot${peerOnline ? ' on' : ''}`} />{peerStatus}</div>
          </div>
        </div>
        <button className="btn light" onClick={onCall}><Video /> Video Call</button>
      </div>
      <div className="chat-body" ref={bodyRef}>
        {!messages ? <Loading /> : messages.length === 0 ? <div className="empty" style={{ margin: 'auto' }}>No messages yet. Say hello!</div> : messages.map((m, i) => {
          const mine = m.sender_uid === uid;
          const next = messages[i + 1];
          const prev = messages[i - 1];
          const lastOfGroup = !next || next.sender_uid !== m.sender_uid;
          const firstOfGroup = !prev || prev.sender_uid !== m.sender_uid;
          const who = m.sender_type === 'student' ? (m.sender_name || 'Student') : `${m.sender_name || 'Officer'} · Officer`;
          return (
            <div key={m.id} className={`msg-row ${mine ? 'mine' : 'theirs'}`}>
              {!mine && (lastOfGroup ? <Avatar uid={m.sender_uid} name={m.sender_name || '?'} size={30} /> : <div style={{ width: 30, flexShrink: 0 }} />)}
              <div>
                {!mine && firstOfGroup && thread.kind === 'student' && <div className="msg-name">{who}</div>}
                <div className={`bubble ${mine ? 'mine' : 'theirs'}${m.deleted ? ' deleted' : ''}`}>
                  {m.deleted ? (mine ? 'You unsent a message' : 'Message deleted') : m.message_text}
                  {(lastOfGroup || mine) && (
                    <div className="meta">
                      {fmtTime(m.date_sent)}{mine && !m.deleted ? ` · ${m.status === 'read' ? 'Seen' : 'Sent'}` : ''}
                    </div>
                  )}
                </div>
              </div>
              {mine && !m.deleted && (
                <button className="msg-del" title="Delete message" onClick={() => setDeleting(m)}><Trash2 size={14} /></button>
              )}
            </div>
          );
        })}
      </div>
      <form className="chat-input" onSubmit={send}>
        <input className="input" placeholder="Type your message..." value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn">Send</button>
      </form>
      {deleting && (
        <Confirm title="Delete message?" message="It will be removed for everyone in this chat." confirmLabel="Delete"
          onConfirm={() => unsend(deleting)} onClose={() => setDeleting(null)} />
      )}
    </div>
  );
}

// Pick anyone to message. Students: officers/staff. Staff: everyone.
function PeoplePicker({ onPick, onClose }) {
  const { uid, user } = useSession();
  const staff = isStaff(user.role);
  const users = useCollection('users');
  const [q, setQ] = useState('');
  const rows = (users || []).filter((u) => u.id !== uid && u.status !== 'inactive' && (staff || isStaff(u.role))
    && `${u.full_name} ${u.username} ${u.role}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  return (
    <Modal title="New message" onClose={onClose} width={460}>
      <input className="input" placeholder="Search name, username or role" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div style={{ maxHeight: 360, overflowY: 'auto', marginTop: 12 }}>
        {!users ? <Loading /> : rows.length === 0 ? <div className="empty">No people found.</div> : rows.map((u) => (
          <button key={u.id} className="convo" onClick={() => onPick(u)}>
            <Avatar uid={u.id} name={u.full_name || u.username} size={40} />
            <div><div className="convo-name">{u.full_name || u.username}</div><div className="convo-sub">{ROLES[u.role] || u.role} · {u.username}</div></div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export default function Messenger() {
  useNow();
  const { uid, user } = useSession();
  const staff = isStaff(user.role);
  const { startCall } = useCalls();
  const convos = useCollection(staff ? 'conversations' : null, { orderBy: ['last_time', 'desc'] });
  const dms = useCollection('dms', { where: [['members', uid, 'array-contains']] });
  const presence = useCollection('presence');
  const [active, setActive] = useState(staff ? '' : `student:${uid}`);
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState(null);
  const pres = (id) => (presence || []).find((p) => p.id === id);
  const anyOfficerOnline = (presence || []).some((p) => p.staff && p.id !== uid && isOnline(p));

  const threads = useMemo(() => {
    const list = [];
    if (!staff) list.push({ kind: 'student', id: uid, key: `student:${uid}`, base: `conversations/${uid}`, title: 'JPCS Officers', last_time: Infinity, sub: 'All JPCS officers' });
    for (const c of convos || []) list.push({ kind: 'student', id: c.id, key: `student:${c.id}`, base: `conversations/${c.id}`, title: c.student_name || 'Student', peerUid: c.id, memberId: c.member_id, last_time: c.last_time || 0, sub: c.last_message, unread: c.staff_unread || 0 });
    for (const d of dms || []) {
      const peer = (d.members || []).find((m) => m !== uid) || '';
      list.push({ kind: 'dm', id: d.id, key: `dm:${d.id}`, base: `dms/${d.id}`, title: d.names?.[peer] || 'User', peerUid: peer, last_time: d.last_time || 0, sub: d.last_message, unread: d[`unread_${uid}`] || 0 });
    }
    if (draft && !list.some((t) => t.key === draft.key)) list.unshift(draft);
    return list.sort((a, b) => b.last_time - a.last_time);
  }, [convos, dms, draft, staff, uid]);

  useEffect(() => { if (!active && threads.length) setActive(threads[0].key); }, [threads, active]);
  const current = threads.find((t) => t.key === active);

  const pick = async (u) => {
    setPicking(false);
    if (staff && u.role === 'student') {
      const t = { kind: 'student', id: u.id, key: `student:${u.id}`, base: `conversations/${u.id}`, title: u.full_name || u.username, peerUid: u.id, memberId: u.member_id || '', last_time: Date.now(), sub: '' };
      setDraft(t); setActive(t.key); return;
    }
    const id = pairId(uid, u.id);
    await api.set(`dms/${id}`, { members: [uid, u.id].sort(), names: { [uid]: user.full_name || user.username, [u.id]: u.full_name || u.username } }, { merge: true });
    setActive(`dm:${id}`);
  };

  const call = (t) => {
    if (t.kind === 'student' && !staff) startCall({ calleeType: 'staff', calleeUid: '', conversationId: uid, memberId: user.member_id || '', name: 'JPCS Officers' });
    else startCall({ calleeType: t.kind === 'dm' ? 'user' : 'student', calleeUid: t.peerUid, conversationId: t.id, memberId: t.memberId || '', name: t.title || 'User' });
  };

  const status = (t) => {
    if (t.kind === 'student' && !staff) return [anyOfficerOnline, anyOfficerOnline ? 'An officer is active now' : 'Officers will reply soon'];
    const p = pres(t.peerUid);
    return [isOnline(p), lastSeen(p)];
  };

  return (
    <>
      <PageHead title="Messenger" sub="Real-time messages and video calls.">
        <button className="btn light" onClick={() => setPicking(true)}>+ New Message</button>
      </PageHead>
      <div className="messenger">
        <div className="card convos">
          <div className="card-title">Chats</div>
          {(staff && !convos) || !dms ? <Loading /> : threads.length === 0 ? <div className="empty small">No chats yet. Click "+ New Message" to start one.</div> : threads.map((t) => {
            const [on] = status(t);
            return (
              <button key={t.key} className={`convo${t.key === active ? ' active' : ''}`} onClick={() => setActive(t.key)}>
                {t.kind === 'student' && !staff
                  ? <div className="avatar" style={{ width: 42, height: 42 }}><Users size={18} /><span className={`dot${on ? ' on' : ''}`} /></div>
                  : <Avatar uid={t.peerUid} name={t.title} size={42} online={on} />}
                <div style={{ minWidth: 0 }}>
                  <div className="convo-name">{t.title}</div>
                  <div className="convo-sub">{t.sub || (t.kind === 'dm' ? 'Direct message' : 'New conversation')}</div>
                </div>
                {t.unread > 0 && <span className="unread">{t.unread}</span>}
              </button>
            );
          })}
        </div>
        {current ? (() => {
          const [on, st] = status(current);
          return <ChatPane key={current.key} thread={current} peerOnline={on} peerStatus={st} onCall={() => call(current)} />;
        })() : <div className="card empty">Select a chat.</div>}
      </div>
      {picking && <PeoplePicker onPick={pick} onClose={() => setPicking(false)} />}
    </>
  );
}
