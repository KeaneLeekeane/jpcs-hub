import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone } from 'lucide-react';
import { CallSession, declineCall, RING_TIMEOUT_MS } from '../data/webrtc';
import { useCollection, useSession } from '../data/hooks';
import { Avatar } from './Avatar';

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
  const me = { uid, name: user.full_name || user.username, role: user.role };

  // Calls ringing for me (every call is one-on-one).
  const direct = useCollection('calls', { where: [['callee_uid', uid], ['status', 'ringing']] });
  const incoming = (direct || []).find(
    (c) => c.caller_uid !== uid && !dismissed.has(c.id)
      // tolerate phone/laptop clocks that differ a little
      && Math.abs(Date.now() - (c.created_at || 0)) < RING_TIMEOUT_MS + 60000
      && (!session || session.status === 'ended'),
  );
  useRingtone(!!incoming);

  // Desktop notification when the window is in the background.
  useEffect(() => {
    if (!incoming || document.visibilityState === 'visible' || !('Notification' in window)) return undefined;
    let n;
    const show = () => { n = new Notification('Incoming video call', { body: `${incoming.caller_name} is calling you on JPCS HUB`, requireInteraction: true }); n.onclick = () => { window.focus(); n.close(); }; };
    if (Notification.permission === 'granted') show();
    return () => n?.close();
  }, [incoming?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ask once for notification permission so calls can alert in the background.
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      const ask = () => { Notification.requestPermission().catch(() => {}); window.removeEventListener('click', ask); };
      window.addEventListener('click', ask);
      return () => window.removeEventListener('click', ask);
    }
    return undefined;
  }, []);

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
        <div className="ring-back" role="alertdialog" aria-label="Incoming video call">
          <div className="ring-card">
            <div className="ring-pulse"><Avatar uid={incoming.caller_uid} name={incoming.caller_name} size={84} /></div>
            <h3>{incoming.caller_name}</h3>
            <div className="ring-sub">Incoming video call · JPCS HUB</div>
            <div className="ring-actions">
              <button className="round red" onClick={() => decline(incoming)} title="Decline"><PhoneOff /></button>
              <button className="round green" onClick={() => accept(incoming)} title="Accept"><Phone /></button>
            </div>
            <div className="ring-labels"><span>Decline</span><span>Accept</span></div>
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
