import { Emitter } from '@rocket.chat/emitter';
import type { MediaSignalTransportWrapper } from './TransportWrapper';
import type { ClientMediaSignalError, IServiceProcessorFactoryList } from '../definition';
import type { IClientMediaCall, CallEvents, CallContact, CallRole, CallState, CallService, CallHangupReason, CallActorType } from '../definition/call';
import type { ClientState } from '../definition/client';
import type { IMediaSignalLogger } from '../definition/logger';
import type { IWebRTCProcessor } from '../definition/services';
import type { ServerMediaSignal, ServerMediaSignalNewCall, ServerMediaSignalRemoteSDP, ServerMediaSignalRequestOffer } from '../definition/signals/server';
export interface IClientMediaCallConfig {
    logger?: IMediaSignalLogger;
    transporter: MediaSignalTransportWrapper;
    processorFactories: IServiceProcessorFactoryList;
    sessionId: string;
    iceGatheringTimeout: number;
}
export declare class ClientMediaCall implements IClientMediaCall {
    private readonly config;
    get callId(): string;
    readonly emitter: Emitter<CallEvents>;
    private _role;
    get role(): CallRole;
    private _state;
    get state(): CallState;
    private _ignored;
    get ignored(): boolean;
    private _contact;
    get contact(): CallContact;
    private _service;
    get service(): CallService | null;
    get signed(): boolean;
    get hidden(): boolean;
    get muted(): boolean;
    /** indicates if the call is on hold */
    get held(): boolean;
    /** indicates the call is past the "dialing" stage and not yet over */
    get busy(): boolean;
    protected webrtcProcessor: IWebRTCProcessor | null;
    private acceptedLocally;
    private endedLocally;
    private hasRemoteData;
    private hasLocalDescription;
    private hasRemoteDescription;
    private initialized;
    private acknowledged;
    private earlySignals;
    private stateTimeoutHandlers;
    private remoteCallId;
    private oldClientState;
    private serviceStates;
    private stateReporterTimeoutHandler;
    private mayReportStates;
    private contractState;
    private inputTrack;
    /** localCallId will only be different on calls initiated by this session */
    private localCallId;
    private currentNegotiationId;
    private creationTimestamp;
    private pendingAnswerRequest;
    constructor(config: IClientMediaCallConfig, callId: string, { inputTrack }?: {
        inputTrack?: MediaStreamTrack | null;
    });
    /**
     * Initialize an outbound call with basic contact information until we receive the full call details from the server;
     * this gets executed once for outbound calls initiated in this session.
     */
    initializeOutboundCall(contact: CallContact): Promise<void>;
    /** Initialize an outbound call with the callee information and send a call request to the server */
    requestCall(callee: {
        type: CallActorType;
        id: string;
    }, contactInfo?: CallContact): Promise<void>;
    /** initialize a call with the data received from the server on a 'new' signal; this gets executed once for every call */
    initializeRemoteCall(signal: ServerMediaSignalNewCall, oldCall?: ClientMediaCall | null): Promise<void>;
    mayNeedInputTrack(): boolean;
    needsInputTrack(): boolean;
    hasInputTrack(): boolean;
    isMissingInputTrack(): boolean;
    getClientState(): ClientState;
    setInputTrack(newInputTrack: MediaStreamTrack | null): Promise<void>;
    getRemoteMediaStream(): MediaStream;
    processSignal(signal: ServerMediaSignal, oldCall?: ClientMediaCall | null): Promise<void>;
    accept(): void;
    reject(): void;
    transfer(callee: {
        type: CallActorType;
        id: string;
    }): void;
    hangup(reason?: CallHangupReason): void;
    isPendingAcceptance(): boolean;
    isPendingOurAcceptance(): boolean;
    isOver(): boolean;
    isAbleToReportStates(): boolean;
    ignore(): void;
    setMuted(muted: boolean): void;
    setHeld(held: boolean): void;
    setContractState(state: 'signed' | 'ignored'): void;
    reportStates(): void;
    sendDTMF(dtmf: string, duration?: number): void;
    private changeState;
    private updateClientState;
    private maybeStopWebRTC;
    private changeContact;
    protected processOfferRequest(signal: ServerMediaSignalRequestOffer): Promise<void>;
    protected shouldIgnoreWebRTC(): boolean;
    protected processAnswerRequest(signal: ServerMediaSignalRemoteSDP): Promise<void>;
    protected sendError(error: Partial<ClientMediaSignalError>): void;
    protected processRemoteSDP(signal: ServerMediaSignalRemoteSDP): Promise<void>;
    protected deliverSdp(data: {
        sdp: RTCSessionDescriptionInit;
        negotiationId: string;
    }): Promise<void>;
    protected rejectAsUnavailable(): Promise<void>;
    protected processEarlySignals(): Promise<void>;
    protected acknowledge(): void;
    private processNotification;
    private flagAsAccepted;
    private flagAsEnded;
    private addStateTimeout;
    private updateStateTimeouts;
    private clearStateTimeouts;
    private onWebRTCInternalStateChange;
    private onWebRTCInternalError;
    private onWebRTCNegotiationNeeded;
    private onWebRTCConnectionStateChange;
    private clearStateReporter;
    private requestStateReport;
    private throwError;
    private isSignalTargetingThisSession;
    private prepareWebRtcProcessor;
    private requireWebRTC;
}
export declare abstract class ClientMediaCallWebRTC extends ClientMediaCall {
    abstract webrtcProcessor: IWebRTCProcessor;
}
//# sourceMappingURL=Call.d.ts.map