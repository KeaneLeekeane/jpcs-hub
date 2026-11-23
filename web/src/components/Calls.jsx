import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone } from 'lucide-react';
import { CallSession, declineCall, RING_TIMEOUT_MS } from '../data/webrtc';
import { useCollection, useSession } from '../data/hooks';

const CallContext = createContext(null);
export const useCalls = () => useContext(CallContext);

function VideoEl({ stream, className, muted }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null;
  });
  return <video ref={ref} className={className} autoPlay playsInline muted={muted} />;
}

function useRingtone(active) {
  useEffect(() => {
    if (!active) return undefined;
    let ctx;
    let timer;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const beep = () => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 660;
        g.gain.value = 0.06;
        o.connect(g).connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.35);
      };
      beep();
      timer = setInterval(beep, 1600);
    } catch { /* audio not allowed yet */ }
    return () => { clearInterval(timer); ctx?.close(); };
  }, [active]);
}

export function CallProvider({ children }) {
  const { uid, user } = useSession();
  const [session, setSession] = useState(null);
  const [, force] = useState(0);
  const [dismissed, setDismissed] = useState(() => new Set());
  const [toast, setToast] = useState('');
  const staff = user.role !== 'student';
  const me = { uid, name: user.full_name || user.username, role: user.role };

  // Calls ringing for me: staff get calls addressed to "JPCS Officers";
  // students get calls addressed to them.
  const ringing = useCollection(
    'calls',
    staff ? { where: [['callee_type', 'staff'], ['status', 'ringing']] }
      : { where: [['callee_uid', uid], ['status', 'ringing']] },
  );
  const incoming = (ringing || []).find(
    (c) => c.caller_uid !== uid && !dismissed.has(c.id) && Date.now() - (c.created_at || 0) < RING_TIMEOUT_MS
      && (!session || session.status === 'ended'),
  );
  useRingtone(!!incoming);

  const newSession = () => {
    const s = new CallSession(() => force((n) => n + 1));
    setSession(s);
    return s;
  };

  const startCall = (target) => {
    if (session && session.status !== 'ended') return;
    newSession().start(me, target);
  };

  const accept = (call) => {
    setDismissed((d) => new Set(d).add(call.id));
    newSession().accept(call, me);
  };

  const decline = (call) => {
    setDismissed((d) => new Set(d).add(call.id));
    declineCall(call.id);
  };

  useEffect(() => {
    if (session?.status === 'ended') {
      const msg = session.error || ({ declined: 'Call declined.', missed: 'No answer.' }[session.endReason]) || 'Call ended.';
      setToast(msg);
      const t = setTimeout(() => { setSession(null); setToast(''); }, session.error ? 6000 : 2500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [session, session?.status]);

  const active = session && session.status !== 'ended';
  const label = {
    calling: 'Calling…', connecting: 'Connecting…', connected: 'Connected',
  }[session?.status] || '';

  return (
    <CallContext.Provider value={{ startCall, inCall: !!active }}>
      {children}
      {incoming && (
        <div className="incoming" role="alertdialog">
          <div className="small muted">Incoming video call</div>
          <h4 style={{ margin: '4px 0 14px' }}>{incoming.caller_name}</h4>
          <div className="row">
            <button className="btn green" style={{ flex: 1, background: '#22a45d', color: '#fff' }} onClick={() => accept(incoming)}>
              <Phone size={16} /> Accept
            </button>
            <button className="btn danger" style={{ flex: 1 }} onClick={() => decline(incoming)}>
              <PhoneOff size={16} /> Decline
            </button>
          </div>
        </div>
      )}
      {active && (
        <div className="call-overlay">
          <div className="call-videos">
            <VideoEl className="remote" stream={session.remoteStream} />
            <VideoEl className="local" stream={session.localStream} muted />
            <div className="call-info">
              <h3>{session.peerName}</h3>
              <div>{label}</div>
              {session.error && <div style={{ color: '#fca5a5', marginTop: 6 }}>{session.error}</div>}
            </div>
          </div>
          <div className="call-controls">
            <button className={`round${session.micOn ? '' : ' off'}`} onClick={() => session.toggleMic()} title="Microphone">
              {session.micOn ? <Mic /> : <MicOff />}
            </button>
            <button className={`round${session.camOn ? '' : ' off'}`} onClick={() => session.toggleCam()} title="Camera">
              {session.camOn ? <Video /> : <VideoOff />}
            </button>
            <button className="round red" onClick={() => session.hangup()} title="End call"><PhoneOff /></button>
          </div>
        </div>
      )}
      {toast && !active && <div className="incoming" style={{ width: 'auto' }}>{toast}</div>}
    </CallContext.Provider>
  );
}
