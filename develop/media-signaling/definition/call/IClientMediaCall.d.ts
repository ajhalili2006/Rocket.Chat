import type { Emitter } from '@rocket.chat/emitter';
import type { CallEvents } from './CallEvents';
export type CallActorType = 'user' | 'sip';
export type CallContact = {
    type?: CallActorType;
    id?: string;
    contractId?: string;
    displayName?: string;
    username?: string;
    sipExtension?: string;
};
export type CallRole = 'caller' | 'callee';
export type CallService = 'webrtc';
export type CallState = 'none' | 'ringing' | 'accepted' | 'active' | 'renegotiating' | 'hangup';
export type CallHangupReason = 'normal' | 'remote' | 'rejected' | 'unavailable' | 'transfer' | 'timeout' | 'signaling-error' | 'service-error' | 'media-error' | 'input-error' | 'error' | 'unknown' | 'another-client';
export type CallAnswer = 'accept' | 'reject' | 'ack' | 'unavailable';
export type CallNotification = 'accepted' | 'active' | 'hangup';
export type CallRejectedReason = 'invalid-call-id' | 'invalid-contract-id' | 'existing-call-id' | 'already-requested' | 'unsupported' | 'unavailable' | 'busy' | 'invalid-call-params' | 'forbidden';
export interface IClientMediaCall {
    callId: string;
    role: CallRole;
    service: CallService | null;
    state: CallState;
    ignored: boolean;
    signed: boolean;
    hidden: boolean;
    muted: boolean;
    held: boolean;
    busy: boolean;
    contact: CallContact;
    transferredBy: CallContact | null;
    audioLevel: number;
    localAudioLevel: number;
    emitter: Emitter<CallEvents>;
    getRemoteMediaStream(): MediaStream;
    accept(): void;
    reject(): void;
    hangup(): void;
    setMuted(muted: boolean): void;
    setHeld(onHold: boolean): void;
    transfer(callee: {
        type: CallActorType;
        id: string;
    }): void;
    sendDTMF(dtmf: string, duration?: number): void;
    getStats(selector?: MediaStreamTrack | null): Promise<RTCStatsReport | null>;
}
//# sourceMappingURL=IClientMediaCall.d.ts.map