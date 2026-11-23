import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CallSession, declineCall, RING_TIMEOUT_MS, type Target } from './call';
import { useCollection, useSession } from './session';
import { Avatar } from './ui';

type Ctx = { startCall: (t: Target) => void };
const CallContext = createContext<Ctx>({ startCall: () => {} });
export const useCalls = () => useContext(CallContext);

function Round({ icon, onPress, bg = 'rgba(255,255,255,0.18)', color = '#fff', label }: {
  icon: keyof typeof Ionicons.glyphMap; onPress: () => void; bg?: string; color?: string; label: string;
}) {
  return (
    <Pressable onPress={onPress} style={[s.round, { backgroundColor: bg }]} accessibilityLabel={label}>
      <Ionicons name={icon} size={26} color={color} />
    </Pressable>
  );
}

export function CallLayer({ children }: { children: ReactNode }) {
  const { uid, user, isStudent } = useSession();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<CallSession | null>(null);
  const [, force] = useState(0);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState('');
  const me = { uid, name: user.full_name || user.username, role: user.role };
  const sessionRef = useRef<CallSession | null>(null);
  sessionRef.current = session;

  // Calls ringing for me (every call is one-on-one).
  const ringing = useCollection('calls', { where: [['callee_uid', uid], ['status', 'ringing']] }) || [];
  const busy = !!session && session.status !== 'ended';
  const incoming = ringing.find((c) => c.caller_uid !== uid && !dismissed.has(c.id)
    && Math.abs(Date.now() - (c.created_at || 0)) < RING_TIMEOUT_MS + 60000 && !busy);

  useEffect(() => {
    if (!incoming) return undefined;
    Vibration.vibrate([0, 800, 1200], true);
    return () => Vibration.cancel();
  }, [incoming?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const make = () => {
    const s = new CallSession(() => force((n) => n + 1));
    setSession(s);
    return s;
  };

  const startCall = (t: Target) => { if (!busy) make().start(me, t); };

  useEffect(() => {
    if (session?.status !== 'ended') return undefined;
    setToast(session.error || ({ declined: 'Call declined', missed: 'No answer' } as Record<string, string>)[session.endReason] || 'Call ended');
    const t = setTimeout(() => { setSession(null); setToast(''); }, session.error ? 5000 : 2200);
    return () => clearTimeout(t);
  }, [session, session?.status]);

  // Hang up if the user leaves the app screen mid-call (e.g. logs out).
  useEffect(() => () => { sessionRef.current?.hangup(); }, []);

  const label = ({ calling: 'Calling…', connecting: 'Connecting…', connected: 'Connected' } as Record<string, string>)[session?.status || ''] || '';
  const remoteURL = session?.remoteStream?.toURL();
  const localURL = session?.localStream?.toURL();

  return (
    <CallContext.Provider value={{ startCall }}>
      {children}

      <Modal visible={!!incoming} transparent animationType="fade" onRequestClose={() => incoming && setDismissed(new Set(dismissed).add(incoming.id))}>
        <View style={s.incomingBack}>
          {incoming && (
            <View style={s.incomingCard}>
              <Avatar uid={incoming.caller_uid} name={incoming.caller_name} size={96} />
              <Text style={s.incomingName}>{incoming.caller_name}</Text>
              <Text style={s.incomingSub}>Incoming video call · JPCS HUB</Text>
              <View style={s.incomingBtns}>
                <View style={{ alignItems: 'center' }}>
                  <Round icon="call" bg="#e53e3e" label="Decline" onPress={() => { setDismissed(new Set(dismissed).add(incoming.id)); declineCall(incoming.id); }} />
                  <Text style={s.btnLabel}>Decline</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Round icon="videocam" bg="#22a45d" label="Accept" onPress={() => { setDismissed(new Set(dismissed).add(incoming.id)); make().accept(incoming, me); }} />
                  <Text style={s.btnLabel}>Accept</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </Modal>

      <Modal visible={busy} animationType="slide" onRequestClose={() => session?.hangup()}>
        <View style={s.callPage}>
          {remoteURL && session?.status === 'connected'
            ? <RTCView streamURL={remoteURL} style={StyleSheet.absoluteFill} objectFit="cover" />
            : (
              <View style={s.waiting}>
                <Avatar name={session?.peerName || ''} size={96} />
              </View>
            )}
          {localURL && session?.camOn && (
            <RTCView streamURL={localURL} style={[s.local, { top: insets.top + 16 }]} objectFit="cover" mirror zOrder={1} />
          )}
          <View style={[s.info, { top: insets.top + 24 }]}>
            <Text style={s.peer}>{session?.peerName}</Text>
            <Text style={s.status}>{label}</Text>
            {!!session?.error && <Text style={s.err}>{session.error}</Text>}
          </View>
          <View style={[s.controls, { paddingBottom: insets.bottom + 24 }]}>
            <Round icon={session?.micOn ? 'mic' : 'mic-off'} label="Microphone" onPress={() => session?.toggleMic()}
              bg={session?.micOn ? undefined : '#fff'} color={session?.micOn ? '#fff' : '#0d1530'} />
            <Round icon={session?.camOn ? 'videocam' : 'videocam-off'} label="Camera" onPress={() => session?.toggleCam()}
              bg={session?.camOn ? undefined : '#fff'} color={session?.camOn ? '#fff' : '#0d1530'} />
            <Round icon="camera-reverse" label="Switch camera" onPress={() => session?.switchCamera()} />
            <Round icon={session?.speakerOn ? 'volume-high' : 'volume-low'} label="Speaker" onPress={() => session?.toggleSpeaker()} />
            <Round icon="call" bg="#e53e3e" label="End call" onPress={() => session?.hangup()} />
          </View>
        </View>
      </Modal>

      {!!toast && !busy && (
        <View style={[s.toast, { bottom: insets.bottom + 90 }]} pointerEvents="none">
          <Text style={{ color: '#fff' }}>{toast}</Text>
        </View>
      )}
    </CallContext.Provider>
  );
}

const s = StyleSheet.create({
  round: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  incomingBack: { flex: 1, backgroundColor: 'rgba(13,21,48,0.92)', justifyContent: 'center', padding: 24 },
  incomingCard: { alignItems: 'center' },
  incomingName: { color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 18 },
  incomingSub: { color: '#c9d4ef', marginTop: 6 },
  incomingBtns: { flexDirection: 'row', justifyContent: 'space-around', alignSelf: 'stretch', marginTop: 60 },
  btnLabel: { color: '#fff', marginTop: 8 },
  callPage: { flex: 1, backgroundColor: '#0d1530' },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  local: { position: 'absolute', right: 16, width: 110, height: 160, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  info: { position: 'absolute', left: 20, right: 140 },
  peer: { color: '#fff', fontSize: 22, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  status: { color: '#e2e8f5', marginTop: 4, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  err: { color: '#fca5a5', marginTop: 6 },
  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-evenly', paddingTop: 18, backgroundColor: 'rgba(0,0,0,0.3)' },
  toast: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(23,41,90,0.95)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
});
