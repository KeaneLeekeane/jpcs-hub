// One-to-one video call (WebRTC) using Firestore for signaling. Same call
// document format as the web portal, so the app can call the portal and back.
import { PermissionsAndroid, Platform } from 'react-native';
import {
  mediaDevices, RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, MediaStream,
} from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import { add, set, sub, subDoc, update, newId, type Row } from './firebase';
import { turn } from './firebaseConfig';

export const RING_TIMEOUT_MS = 45000;

export type Me = { uid: string; name: string; role: string };
export type Target = { calleeType: 'staff' | 'student'; calleeUid: string; conversationId: string; memberId: string; name: string };
export type CallStatus = 'idle' | 'calling' | 'connecting' | 'connected' | 'ended';

function iceServers() {
  const list: any[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (turn.url) list.push({ urls: turn.url, username: turn.username, credential: turn.credential });
  return list;
}

async function askPermissions() {
  if (Platform.OS !== 'android') return;
  const res = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ]);
  if (res[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error('Microphone permission is needed for calls. Allow it in Settings > Apps > JPCS HUB.');
  }
}

export class CallSession {
  id: string | null = null;
  pc: RTCPeerConnection | null = null;
  localStream: MediaStream | null = null;
  remoteStream: MediaStream | null = null;
  status: CallStatus = 'idle';
  role: 'caller' | 'callee' | null = null;
  peerName = '';
  error = '';
  endReason = '';
  micOn = true;
  camOn = true;
  speakerOn = true;
  private unsubs: (() => void)[] = [];
  private seen = new Set<string>();
  private pending: any[] = [];
  private answerApplied = false;
  private ringTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private onChange: () => void) {}

  private emit() { this.onChange(); }

  private async openMedia() {
    await askPermissions();
    try {
      this.localStream = await mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'user' } as any });
    } catch {
      this.localStream = await mediaDevices.getUserMedia({ audio: true, video: false });
      this.camOn = false;
    }
    InCallManager.start({ media: 'video' });
    InCallManager.setForceSpeakerphoneOn(true);
    this.pc = new RTCPeerConnection({ iceServers: iceServers() });
    this.localStream.getTracks().forEach((t) => this.pc!.addTrack(t, this.localStream!));
    (this.pc as any).addEventListener('track', (ev: any) => {
      const stream = ev.streams?.[0];
      if (stream) this.remoteStream = stream;
      this.emit();
    });
    (this.pc as any).addEventListener('connectionstatechange', () => {
      if (this.pc?.connectionState === 'failed') {
        this.error = 'Connection failed. A TURN server may be needed for these networks.';
        this.emit();
      }
    });
    this.emit();
  }

  private sendCandidates(subName: string) {
    (this.pc as any).addEventListener('icecandidate', (ev: any) => {
      if (ev.candidate) add(`calls/${this.id}/${subName}`, ev.candidate.toJSON()).catch(() => {});
    });
  }

  private watchCandidates(subName: string) {
    this.unsubs.push(sub(`calls/${this.id}/${subName}`, {}, (rows) => {
      for (const r of rows) {
        if (this.seen.has(r.id)) continue;
        this.seen.add(r.id);
        const c = new RTCIceCandidate({ candidate: r.candidate, sdpMid: r.sdpMid, sdpMLineIndex: r.sdpMLineIndex });
        if (this.pc?.remoteDescription) this.pc.addIceCandidate(c).catch(() => {});
        else this.pending.push(c);
      }
    }));
  }

  private flushPending() {
    this.pending.forEach((c) => this.pc?.addIceCandidate(c).catch(() => {}));
    this.pending = [];
  }

  private watchCall() {
    this.unsubs.push(subDoc(`calls/${this.id}`, async (call) => {
      if (!call) return;
      if (this.role === 'caller' && call.answer && this.pc && !this.answerApplied) {
        this.answerApplied = true;
        await this.pc.setRemoteDescription(new RTCSessionDescription(call.answer));
        this.flushPending();
      }
      if (call.status === 'accepted' && this.status !== 'connected') {
        this.status = 'connected';
        if (this.role === 'caller' && call.answered_name) this.peerName = call.answered_name;
        clearTimeout(this.ringTimer);
        this.emit();
      }
      if (['ended', 'declined', 'missed'].includes(call.status) && this.status !== 'ended') {
        this.endReason = call.status;
        this.cleanup();
      }
    }));
  }

  async start(me: Me, target: Target) {
    this.role = 'caller';
    this.status = 'calling';
    this.peerName = target.name;
    this.emit();
    try {
      this.id = newId('calls');
      await this.openMedia();
      this.sendCandidates('callerCandidates');
      this.watchCandidates('calleeCandidates');
      const offer = await this.pc!.createOffer({});
      await this.pc!.setLocalDescription(offer);
      await set(`calls/${this.id}`, {
        member_id: target.memberId || '', user_id: me.role === 'student' ? '' : me.uid,
        conversation_id: target.conversationId,
        caller_uid: me.uid, caller_name: me.name, caller_type: me.role === 'student' ? 'student' : 'staff',
        callee_type: target.calleeType, callee_uid: target.calleeUid || '', callee_name: target.name,
        status: 'ringing', offer: { type: offer.type, sdp: offer.sdp }, answer: null,
        answered_by: '', answered_name: '',
        created_at: Date.now(), start_time: 0, end_time: 0, session_link: `calls/${this.id}`,
      });
      this.watchCall();
      this.ringTimer = setTimeout(() => { if (this.status === 'calling') this.hangup('missed'); }, RING_TIMEOUT_MS);
    } catch (e: any) {
      this.error = e?.message || 'Could not start the call.';
      this.cleanup();
    }
  }

  async accept(call: Row, me: Me) {
    this.role = 'callee';
    this.id = call.id;
    this.status = 'connecting';
    this.peerName = call.caller_name;
    this.emit();
    try {
      await this.openMedia();
      this.sendCandidates('calleeCandidates');
      await this.pc!.setRemoteDescription(new RTCSessionDescription(call.offer));
      const answer = await this.pc!.createAnswer();
      await this.pc!.setLocalDescription(answer);
      const data: any = {
        answer: { type: answer.type, sdp: answer.sdp }, status: 'accepted',
        answered_by: me.uid, answered_name: me.name, start_time: Date.now(),
      };
      if (me.role !== 'student') data.user_id = me.uid;
      await update(`calls/${this.id}`, data);
      this.watchCandidates('callerCandidates');
      this.watchCall();
    } catch (e: any) {
      this.error = e?.message || 'Could not join the call.';
      if (this.id) update(`calls/${this.id}`, { status: 'ended', end_time: Date.now() }).catch(() => {});
      this.cleanup();
    }
  }

  async hangup(reason = 'ended') {
    if (this.id && this.status !== 'ended') {
      const status = this.status === 'calling' && reason === 'ended' ? 'missed' : reason;
      await update(`calls/${this.id}`, { status, end_time: Date.now() }).catch(() => {});
    }
    this.cleanup();
  }

  toggleMic() {
    this.micOn = !this.micOn;
    this.localStream?.getAudioTracks().forEach((t) => { t.enabled = this.micOn; });
    this.emit();
  }

  toggleCam() {
    this.camOn = !this.camOn;
    this.localStream?.getVideoTracks().forEach((t) => { t.enabled = this.camOn; });
    this.emit();
  }

  switchCamera() {
    this.localStream?.getVideoTracks().forEach((t: any) => t._switchCamera?.());
  }

  toggleSpeaker() {
    this.speakerOn = !this.speakerOn;
    InCallManager.setForceSpeakerphoneOn(this.speakerOn);
    this.emit();
  }

  private cleanup() {
    clearTimeout(this.ringTimer);
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream?.release?.();
    this.pc?.close();
    this.pc = null;
    try { InCallManager.stop(); } catch { /* not started */ }
    this.status = 'ended';
    this.emit();
  }
}

export const declineCall = (id: string) =>
  update(`calls/${id}`, { status: 'declined', end_time: Date.now() }).catch(() => {});
