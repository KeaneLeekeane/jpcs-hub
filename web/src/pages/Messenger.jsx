import { useEffect, useMemo, useRef, useState } from 'react';
import { Video } from 'lucide-react';
import { api, isOnline, fmtDateTime, fmtTime } from '../data/api';
import { useCollection, useNow, useSession } from '../data/hooks';
import { useCalls } from '../components/Calls';
import { PageHead, Loading, Modal } from '../components/ui';
import { Avatar } from '../components/Avatar';

function lastSeen(p) {
  if (!p?.last_active) return 'Offline';
  if (isOnline(p)) return 'Active now';
  return `Last active ${fmtDateTime(p.last_active)}`;
}

function ChatPane({ convoId, title, peerOnline, peerStatus, onCall, mySide, member, peerUid }) {
  const { uid, user } = useSession();
  const messages = useCollection(`conversations/${convoId}/messages`, { orderBy: ['date_sent', 'asc'] });
  const [text, setText] = useState('');
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages?.length]);

  // Read indicators: mark the other side's messages as read while the chat is open.
  useEffect(() => {
    if (!messages || document.visibilityState !== 'visible') return;
    const unread = messages.filter((m) => m.sender_uid !== uid && m.status !== 'read');
    if (!unread.length) return;
    unread.forEach((m) => api.update(`conversations/${convoId}/messages/${m.id}`, { status: 'read' }).catch(() => {}));
    api.update(`conversations/${convoId}`, mySide === 'student' ? { student_unread: 0 } : { staff_unread: 0 }).catch(() => {});
  }, [messages, convoId, uid, mySide]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText('');
    const now = Date.now();
    const name = user.full_name || user.username;
    await api.add(`conversations/${convoId}/messages`, {
      member_id: member?.member_id || user.member_id || '', user_id: mySide === 'student' ? '' : uid,
      sender_uid: uid, sender_name: name, sender_type: mySide, message_text: body, date_sent: now, status: 'sent',
    });
    const convo = {
      last_message: body, last_time: now, last_sender_type: mySide,
      [mySide === 'student' ? 'staff_unread' : 'student_unread']: api.inc(1),
    };
    if (mySide === 'student') Object.assign(convo, { student_uid: uid, student_name: name, member_id: user.member_id || '' });
    else Object.assign(convo, { student_uid: convoId, student_name: title || 'Student', member_id: member?.member_id || '' });
    await api.set(`conversations/${convoId}`, convo, { merge: true });
  };

  return (
    <div className="card chat">
      <div className="chat-head">
        <div className="row">
          <Avatar uid={peerUid} name={title} size={40} online={peerOnline} />
          <div>
          <h3>{title}</h3>
          <div className="convo-status"><span className={`status-dot${peerOnline ? ' on' : ''}`} />{peerStatus}</div>
          </div>
        </div>
        <button className="btn light" onClick={onCall}><Video /> Video Call</button>
      </div>
      <div className="chat-body" ref={bodyRef}>
        {!messages ? <Loading /> : messages.length === 0 ? <div className="empty" style={{ margin: 'auto' }}>No messages yet. Say hello!</div> : messages.map((m, i) => {
          // Like Messenger: my messages on the right, everyone else on the left.
          const mine = m.sender_uid === uid;
          const next = messages[i + 1];
          const lastOfGroup = !next || next.sender_uid !== m.sender_uid;
          const prev = messages[i - 1];
          const firstOfGroup = !prev || prev.sender_uid !== m.sender_uid;
          const who = m.sender_type === 'student' ? (m.sender_name || 'Student') : `${m.sender_name || 'Officer'} · Officer`;
          return (
            <div key={m.id} className={`msg-row ${mine ? 'mine' : 'theirs'}`}>
              {!mine && (lastOfGroup ? <Avatar uid={m.sender_uid} name={m.sender_name || '?'} size={30} /> : <div style={{ width: 30, flexShrink: 0 }} />)}
              <div>
                {!mine && firstOfGroup && <div className="msg-name">{who}</div>}
                <div className={`bubble ${mine ? 'mine' : 'theirs'}`}>
                  {m.message_text}
                  {(lastOfGroup || mine) && (
                    <div className="meta">{fmtTime(m.date_sent)}{mine ? ` · ${m.status === 'read' ? 'Seen' : 'Sent'}` : ''}</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <form className="chat-input" onSubmit={send}>
        <input className="input" placeholder="Type your message..." value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn">Send</button>
      </form>
    </div>
  );
}

function NewChat({ onPick, onClose }) {
  const students = useCollection('users', { where: [['role', 'student']] });
  const [q, setQ] = useState('');
  const rows = (students || []).filter((s) => s.status !== 'inactive' && `${s.full_name} ${s.username}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal title="Message a student" onClose={onClose} width={440}>
      <input className="input" placeholder="Search name or student no." value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div style={{ maxHeight: 320, overflowY: 'auto', marginTop: 12 }}>
        {!students ? <Loading /> : rows.length === 0 ? <div className="empty">No students with an app login.</div> : rows.map((s) => (
          <button key={s.id} className="convo" onClick={() => onPick(s)}>
            <Avatar uid={s.id} name={s.full_name} size={40} />
            <div><div className="convo-name">{s.full_name}</div><div className="convo-sub">{s.username}</div></div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function StaffMessenger() {
  useNow();
  const { startCall } = useCalls();
  const convos = useCollection('conversations', { orderBy: ['last_time', 'desc'] });
  const presence = useCollection('presence');
  const [active, setActive] = useState('');
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState(null); // student picked from "New" with no conversation yet

  const pres = (id) => (presence || []).find((p) => p.id === id);
  const list = useMemo(() => {
    const l = [...(convos || [])];
    if (draft && !l.some((c) => c.id === draft.id)) l.unshift({ id: draft.id, student_name: draft.full_name, member_id: draft.member_id, last_message: '' });
    return l;
  }, [convos, draft]);
  useEffect(() => { if (!active && list.length) setActive(list[0].id); }, [list, active]);
  const current = list.find((c) => c.id === active);

  return (
    <>
      <PageHead title="Messenger" sub="Real-time messages and video calls with JPCS members.">
        <button className="btn light" onClick={() => setPicking(true)}>+ New Message</button>
      </PageHead>
      <div className="messenger">
        <div className="card convos">
          <div className="card-title">Conversations</div>
          {!convos ? <Loading /> : list.length === 0 ? <div className="empty small">No conversations yet. Students can message you from the JPCS HUB mobile app.</div> : list.map((c) => {
            const p = pres(c.id);
            return (
              <button key={c.id} className={`convo${c.id === active ? ' active' : ''}`} onClick={() => setActive(c.id)}>
                <Avatar uid={c.id} name={c.student_name || 'Student'} size={42} online={isOnline(p)} />
                <div style={{ minWidth: 0 }}>
                  <div className="convo-name">{c.student_name || 'Student'}</div>
                  <div className="convo-sub">{isOnline(p) ? 'Active now' : c.last_message || 'New conversation'}</div>
                </div>
                {c.staff_unread > 0 && <span className="unread">{c.staff_unread}</span>}
              </button>
            );
          })}
        </div>
        {current ? (
          <ChatPane
            key={current.id}
            convoId={current.id}
            title={current.student_name || 'Student'}
            peerUid={current.id}
            member={current}
            mySide="officer"
            peerOnline={isOnline(pres(current.id))}
            peerStatus={lastSeen(pres(current.id))}
            onCall={() => startCall({ calleeType: 'student', calleeUid: current.id, conversationId: current.id, memberId: current.member_id || '', name: current.student_name || 'Student' })}
          />
        ) : <div className="card empty">Select a conversation.</div>}
      </div>
      {picking && (
        <NewChat
          onClose={() => setPicking(false)}
          onPick={(s) => { setDraft(s); setActive(s.id); setPicking(false); }}
        />
      )}
    </>
  );
}

function StudentMessenger() {
  useNow();
  const { uid, user } = useSession();
  const { startCall } = useCalls();
  const presence = useCollection('presence', { where: [['staff', true]] });
  const anyOnline = (presence || []).some(isOnline);
  return (
    <>
      <PageHead title="Messenger" sub="Send your questions to the JPCS Officers. The JPCS HUB mobile app has the same chat." />
      <div className="messenger" style={{ gridTemplateColumns: '1fr' }}>
          <ChatPane
            convoId={uid}
            title="JPCS Officers"
            mySide="student"
            member={{ member_id: user.member_id }}
            peerOnline={anyOnline}
            peerStatus={anyOnline ? 'An officer is active now' : 'Officers are offline — they will reply soon'}
            onCall={() => startCall({ calleeType: 'staff', calleeUid: '', conversationId: uid, memberId: user.member_id, name: 'JPCS Officers' })}
          />
      </div>
    </>
  );
}

export default function Messenger() {
  const { user } = useSession();
  return user.role === 'student' ? <StudentMessenger /> : <StaffMessenger />;
}
