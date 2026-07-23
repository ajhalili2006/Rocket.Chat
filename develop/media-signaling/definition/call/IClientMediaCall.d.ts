import type { Emitter } from '@rocket.chat/emitter';
import type { CallEvents } from './CallEvents';
import type { AnyClientMediaCallParticipant, IClientMediaCallLocalParticipant, IClientMediaCallRemoteParticipant } from './IClientMediaCallParticipant';
import type { CallActorType } from './common';
export type CallService = 'webrtc';
export declare const callFeatureList: readonly ["audio", "screen-share", "transfer", "hold"];
export type CallFeature = (typeof callFeatureList)[number];
export declare const callStateList: readonly ["none", "ringing", "accepted", "active", "renegotiating", "hangup"];
export type CallState = (typeof callStateList)[number];
export declare const callHangupReasonList: readonly ["normal", "remote", "rejected", "unavailable", "transfer", "not-answered", "timeout-local-track", "timeout-remote-sdp", "timeout-local-sdp", "timeout-activation", "timeout", "signaling-error", "service-error", "media-error", "input-error", "error", "unknown", "another-client"];
export type CallHangupReason = (typeof callHangupReasonList)[number];
export declare const callAnswerList: readonly ["accept", "reject", "ack", "unavailable"];
export type CallAnswer = (typeof callAnswerList)[number];
export declare const callNotificationList: readonly ["accepted", "active", "hangup", "trying"];
export type CallNotification = (typeof callNotificationList)[number];
export declare const callRejectedReasonList: readonly ["invalid-call-id", "invalid-contract-id", "existing-call-id", "already-requested", "unsupported", "unavailable", "busy", "invalid-call-params", "forbidden"];
export type CallRejectedReason = (typeof callRejectedReasonList)[number];
export declare const callFlagList: string[];
export type CallFlag = (typeof callFlagList)[number];
export interface IClientMediaCall {
    callId: string;
    state: CallState;
    ignored: boolean;
    signed: boolean;
    hidden: boolean;
    busy: boolean;
    /** The timestamp of the moment the call was marked as active for the first time */
    activeTimestamp?: Date;
    /** if the call was requested by this session, then this will have the ID used to request the call, otherwise it will be the same as callId */
    readonly tempCallId: string;
    /** confirmed indicates if the call exists on the server */
    readonly confirmed: boolean;
    emitter: Emitter<CallEvents>;
    accept(): void;
    reject(): void;
    hangup(): void;
    requestScreenShare(requested: boolean): void;
    setScreenVideoTrack(videoTrack: MediaStreamTrack | null): Promise<void>;
    hasScreenVideoTrack(): boolean;
    canHaveScreenVideoTrack(): boolean;
    transfer(callee: {
        type: CallActorType;
        id: string;
    }): void;
    sendDTMF(dtmf: string, duration?: number): void;
    getStats(selector?: MediaStreamTrack | null): Promise<RTCStatsReport | null>;
    isFeatureAvailable(feature: CallFeature): boolean;
    hasFlag(flag: CallFlag): boolean;
    readonly localParticipant: IClientMediaCallLocalParticipant;
    readonly remoteParticipants: IClientMediaCallRemoteParticipant[];
    readonly participants: AnyClientMediaCallParticipant[];
}
//# sourceMappingURL=IClientMediaCall.d.ts.map