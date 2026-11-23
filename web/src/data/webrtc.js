// One-to-one video call using WebRTC, with Firestore (or demo storage) as the
// signaling channel. Call documents follow the CALL_SESSION entity:
// calls/{id} { member_id, user_id, caller_*, callee_*, status, offer, answer,
//              start_time, end_time, session_link }
// with sub-collections callerCandidates / calleeCandidates for ICE.
import { api } from './api';
import { turn } from '../firebaseConfig';

export const RING_TIMEOUT_MS = 45000;

function iceServers() {
  const list = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (turn.url) list.push({ urls: turn.url, username: turn.username, credential: turn.credential });
  return list;
}

export class CallSession {
  constructor(onChange) {
    this.onChange = onChange;
    this.id = null;
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.status = 'idle';
    this.role = null; // 'caller' | 'callee'
    this.unsubs = [];
    this.seen = new Set();
    this.pending = [];
    this.micOn = true;
    this.camOn = true;
    this.peerName = '';
    this.error = '';
    this.ringTimer = null;
  }

  emit() { this.onChange?.(this); }

  async openMedia() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch {
      // No camera (or blocked): try audio only so the call can still go on.
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.camOn = false;
    }
    this.remoteStream = new MediaStream();
    this.pc = new RTCPeerConnection({ iceServers: iceServers() });
    this.localStream.getTracks().forEach((t) => this.pc.addTrack(t, this.localStream));
    this.pc.ontrack = (ev) => {
      ev.streams[0]?.getTracks().forEach((t) => {
        if (!this.remoteStream.getTracks().includes(t)) this.remoteStream.addTrack(t);
      });
      this.emit();
    };
    this.pc.onconnectionstatechange = () => {
      if (this.pc?.connectionState === 'failed') {
        this.error = 'Connection failed. The two networks may need a TURN server (see README).';
        this.emit();
      }
    };
    this.emit();
  }

  watchCandidates(sub) {
    this.unsubs.push(api.sub(`calls/${this.id}/${sub}`, {}, (rows) => {
      for (const r of rows) {
        if (this.seen.has(r.id)) continue;
        this.seen.add(r.id);
        const c = { candidate: r.candidate, sdpMid: r.sdpMid, sdpMLineIndex: r.sdpMLineIndex };
        if (this.pc?.remoteDescription) this.pc.addIceCandidate(c).catch(() => {});
        else this.pending.push(c);
      }
    }));
  }

  flushPending() {
    for (const c of this.pending) this.pc.addIceCandidate(c).catch(() => {});
    this.pending = [];
  }

  sendCandidates(sub) {
    this.pc.onicecandidate = (ev) => {
      if (ev.candidate) api.add(`calls/${this.id}/${sub}`, ev.candidate.toJSON()).catch(() => {});
    };
  }

  watchCall() {
    this.unsubs.push(api.subDoc(`calls/${this.id}`, async (call) => {
      if (!call) return;
      if (this.role === 'caller' && call.answer && this.pc && !this.answerApplied) {
        this.answerApplied = true;
        await this.pc.setRemoteDescription(call.answer);
        this.flushPending();
      }
      if (call.status === 'accepted' && this.status !== 'connected') {
        this.status = 'connected';
        this.peerName = this.role === 'caller' ? call.answered_name || this.peerName : this.peerName;
        clearTimeout(this.ringTimer);
        this.emit();
      }
      if (['ended', 'declined', 'missed'].includes(call.status) && this.status !== 'ended') {
        this.endReason = call.status;
        this.cleanup();
      }
    }));
  }

  // me: { uid, name, role }; target: { calleeType, calleeUid, conversationId, memberId, name }
  async start(me, target) {
    this.role = 'caller';
    this.status = 'calling';
    this.peerName = target.name;
    this.emit();
    try {
      this.id = api.newId('calls');
      await this.openMedia();
      this.sendCandidates('callerCandidates');
      this.watchCandidates('calleeCandidates');
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      await api.set(`calls/${this.id}`, {
        member_id: target.memberId || '',
        user_id: me.role === 'student' ? '' : me.uid,
        conversation_id: target.conversationId,
        caller_uid: me.uid, caller_name: me.name || 'JPCS HUB user', caller_type: me.role === 'student' ? 'student' : 'staff',
        callee_type: target.calleeType, callee_uid: target.calleeUid || '', callee_name: target.name || 'User',
        status: 'ringing', offer: { type: offer.type, sdp: offer.sdp }, answer: null,
        answered_by: '', answered_name: '',
        created_at: Date.now(), start_time: 0, end_time: 0, session_link: `calls/${this.id}`,
      });
      this.watchCall();
      this.ringTimer = setTimeout(() => {
        if (this.status === 'calling') this.hangup('missed');
      }, RING_TIMEOUT_MS);
    } catch (e) {
      this.error = mediaError(e);
      this.cleanup();
    }
  }

  async accept(call, me) {
    this.role = 'callee';
    this.id = call.id;
    this.status = 'connecting';
    this.peerName = call.caller_name;
    this.emit();
    try {
      await this.openMedia();
      this.sendCandidates('calleeCandidates');
      await this.pc.setRemoteDescription(call.offer);
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      const update = {
        answer: { type: answer.type, sdp: answer.sdp }, status: 'accepted',
        answered_by: me.uid, answered_name: me.name, start_time: Date.now(),
      };
      if (me.role !== 'student') update.user_id = me.uid;
      await api.update(`calls/${this.id}`, update);
      this.watchCandidates('callerCandidates');
      this.watchCall();
    } catch (e) {
      this.error = mediaError(e);
      if (this.id) api.update(`calls/${this.id}`, { status: 'ended', end_time: Date.now() }).catch(() => {});
      this.cleanup();
    }
  }

  async hangup(reason = 'ended') {
    if (this.id && this.status !== 'ended') {
      const status = this.status === 'calling' && reason === 'ended' ? 'missed' : reason;
      await api.update(`calls/${this.id}`, { status, end_time: Date.now() }).catch(() => {});
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

  cleanup() {
    clearTimeout(this.ringTimer);
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.pc?.close();
    this.pc = null;
    this.status = 'ended';
    this.emit();
  }
}

export async function declineCall(callId) {
  await api.update(`calls/${callId}`, { status: 'declined', end_time: Date.now() }).catch(() => {});
}

function mediaError(e) {
  if (e?.name === 'NotAllowedError') return 'Camera/microphone permission was blocked. Allow it in the browser and try again.';
  if (e?.name === 'NotFoundError') return 'No camera or microphone was found on this device.';
  return e?.message || 'Could not start the call.';
}
