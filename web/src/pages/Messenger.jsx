// Messenger: every chat is a private 1-on-1 conversation between two accounts,
// stored at dms/{uidA_uidB}. Pick a person to start a chat, like Messenger.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Video, Trash2 } from 'lucide-react';
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

function ChatPane({ thread, peerOnline, peerStatus, onCall, onDeleteChat }) {
  const { uid, user } = useSession();
  const base = `dms/${thread.id}`;
  const all = useCollection(`${base}/messages`, { orderBy: ['date_sent', 'asc'] });
  // Messages from before "Delete conversation" stay hidden for this user only.
  const messages = all && all.filter((m) => (m.date_sent || 0) > (thread.cleared || 0));
  const [text, setText] = useState('');
  const [deleting, setDeleting] = useState(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages?.length]);

  // Read indicators: mark the other person's messages as read while the chat is open.
  useEffect(() => {
    if (!messages || document.visibilityState !== 'visible') return;
    const unread = messages.filter((m) => m.sender_uid !== uid && m.status !== 'read');
    if (!unread.length) return;
    unread.forEach((m) => api.update(`${base}/messages/${m.id}`, { status: 'read' }).catch(() => {}));
    api.update(base, { [`unread_${uid}`]: 0 }).catch(() => {});
  }, [messages, base, uid]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText('');
    const now = Date.now();
    await api.add(`${base}/messages`, {
      sender_uid: uid, sender_name: user.full_name || user.username,
      sender_type: isStaff(user.role) ? 'officer' : 'student',
      message_text: body, date_sent: now, status: 'sent',
    });
    await api.update(base, {
      last_message: body, last_time: now, last_sender_uid: uid, [`unread_${thread.peerUid}`]: api.inc(1),
      [`hidden_${uid}`]: false, [`hidden_${thread.peerUid}`]: false,
    });
  };

  return (
    <div className="card chat">
      <div className="chat-head">
        <div className="row">
          <Avatar uid={thread.peerUid} name={thread.title} size={40} online={peerOnline} />
          <div>
            <h3>{thread.title}</h3>
            <div className="convo-status"><span className={`status-dot${peerOnline ? ' on' : ''}`} />{peerStatus}</div>
          </div>
        </div>
        <div className="row">
          <button className="btn light" onClick={onCall}><Video /> Video Call</button>
          <button className="btn light" style={{ color: 'var(--red)' }} onClick={onDeleteChat} title="Delete this whole conversation"><Trash2 size={16} /> Delete chat</button>
        </div>
      </div>
      <div className="chat-body" ref={bodyRef}>
        {!messages ? <Loading /> : messages.length === 0 ? <div className="empty" style={{ margin: 'auto' }}>No messages yet. Say hello!</div> : messages.map((m, i) => {
          const mine = m.sender_uid === uid;
          const next = messages[i + 1];
          const lastOfGroup = !next || next.sender_uid !== m.sender_uid;
          return (
            <div key={m.id} className={`msg-row ${mine ? 'mine' : 'theirs'}`}>
              {!mine && (lastOfGroup ? <Avatar uid={m.sender_uid} name={m.sender_name || '?'} size={30} /> : <div style={{ width: 30, flexShrink: 0 }} />)}
              <div>
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
        <Confirm title="Delete message?" message="It will be removed for both of you." confirmLabel="Delete"
          onConfirm={() => api.update(`${base}/messages/${deleting.id}`, { deleted: true, message_text: '' })}
          onClose={() => setDeleting(null)} />
      )}
    </div>
  );
}

// Pick one person to chat with. Students see the officers and staff; staff see everyone.
function PeoplePicker({ onPick, onClose }) {
  const { uid, user } = useSession();
  const staff = isStaff(user.role);
  const users = useCollection('users');
  const presence = useCollection('presence');
  const [q, setQ] = useState('');
  const rows = (users || []).filter((u) => u.id !== uid && u.status !== 'inactive' && (staff || isStaff(u.role))
    && `${u.full_name} ${u.username} ${u.role}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || '')));
  return (
    <Modal title="New message" onClose={onClose} width={460}>
      <input className="input" placeholder="Search name, username or role" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div style={{ maxHeight: 360, overflowY: 'auto', marginTop: 12 }}>
        {!users ? <Loading /> : rows.length === 0 ? <div className="empty">No people found.</div> : rows.map((u) => (
          <button key={u.id} className="convo" onClick={() => onPick(u)}>
            <Avatar uid={u.id} name={u.full_name || u.username} size={40} online={isOnline((presence || []).find((p) => p.id === u.id))} />
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
  const { startCall } = useCalls();
  const dms = useCollection('dms', { where: [['members', uid, 'array-contains']] });
  const presence = useCollection('presence');
  const [active, setActive] = useState('');
  const [picking, setPicking] = useState(false);
  const [removing, setRemoving] = useState(null);
  const pres = (id) => (presence || []).find((p) => p.id === id);

  const threads = useMemo(() => (dms || []).filter((d) => !d[`hidden_${uid}`]).map((d) => {
    const peer = (d.members || []).find((m) => m !== uid) || '';
    return {
      id: d.id, peerUid: peer, title: d.names?.[peer] || 'User',
      last_time: d.last_time || 0, unread: d[`unread_${uid}`] || 0, cleared: d[`cleared_${uid}`] || 0,
      sub: (d.last_time || 0) > (d[`cleared_${uid}`] || 0) ? (d.last_message || 'New conversation') : 'New conversation',
    };
  }).sort((a, b) => b.last_time - a.last_time), [dms, uid]);

  useEffect(() => {
    if ((!active || !threads.some((t) => t.id === active)) && threads.length) setActive(threads[0].id);
  }, [threads, active]);

  // Delete the whole conversation for me (like Messenger): it disappears from
  // my list and its old messages stay hidden for me; the other person keeps theirs.
  const deleteChat = async (t) => {
    await api.update(`dms/${t.id}`, { [`hidden_${uid}`]: true, [`cleared_${uid}`]: Date.now(), [`unread_${uid}`]: 0 });
    if (active === t.id) setActive('');
  };
  const current = threads.find((t) => t.id === active);

  const pick = async (u) => {
    setPicking(false);
    const id = pairId(uid, u.id);
    await api.set(`dms/${id}`, {
      members: [uid, u.id].sort(),
      names: { [uid]: user.full_name || user.username, [u.id]: u.full_name || u.username },
      [`hidden_${uid}`]: false,
    }, { merge: true });
    setActive(id);
  };

  return (
    <>
      <PageHead title="Messenger" sub="Private one-on-one messages and video calls.">
        <button className="btn light" onClick={() => setPicking(true)}>+ New Message</button>
      </PageHead>
      <div className="messenger">
        <div className="card convos">
          <div className="card-title">Chats</div>
          {!dms ? <Loading /> : threads.length === 0 ? <div className="empty small">No chats yet. Click "+ New Message" and choose a person.</div> : threads.map((t) => (
            <button key={t.id} className={`convo${t.id === active ? ' active' : ''}`} onClick={() => setActive(t.id)}>
              <Avatar uid={t.peerUid} name={t.title} size={42} online={isOnline(pres(t.peerUid))} />
              <div style={{ minWidth: 0 }}>
                <div className="convo-name">{t.title}</div>
                <div className="convo-sub">{t.sub}</div>
              </div>
              {t.unread > 0 && <span className="unread">{t.unread}</span>}
              <span className="convo-del" role="button" title="Delete conversation"
                onClick={(e) => { e.stopPropagation(); setRemoving(t); }}><Trash2 size={15} /></span>
            </button>
          ))}
        </div>
        {current ? (
          <ChatPane
            key={current.id}
            thread={current}
            peerOnline={isOnline(pres(current.peerUid))}
            peerStatus={lastSeen(pres(current.peerUid))}
            onDeleteChat={() => setRemoving(current)}
            onCall={() => startCall({ calleeType: 'user', calleeUid: current.peerUid, conversationId: current.id, memberId: '', name: current.title })}
          />
        ) : <div className="card empty">Choose a chat, or click "+ New Message".</div>}
      </div>
      {picking && <PeoplePicker onPick={pick} onClose={() => setPicking(false)} />}
      {removing && (
        <Confirm
          title="Delete conversation?"
          message={`Your whole chat with ${removing.title} will be deleted from your Messenger. ${removing.title} will still have their copy.`}
          onConfirm={() => deleteChat(removing)}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}
