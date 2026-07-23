import { Emitter } from '@rocket.chat/emitter';
import type { ClientMediaSignal, IServiceProcessorFactoryList, MediaSignalTransport, MediaStreamFactory, RandomStringFactory, ServerMediaSignal } from '../definition';
import type { IClientMediaCall, CallActorType, CallContact, CallFeature, AnyMediaCallData } from '../definition/call';
import type { IMediaSignalLogger } from '../definition/logger';
export type MediaSignalingEvents = {
    sessionStateChange: void;
    newCall: {
        call: IClientMediaCall;
    };
    acceptedCall: {
        call: IClientMediaCall;
    };
    endedCall: void;
    hiddenCall: void;
    registered: {
        activeCalls: IClientMediaCall['callId'][];
    };
    outOfSync: {
        missingCalls: IClientMediaCall['callId'][];
    };
};
export type MediaSignalingSessionConfig = {
    userId: string;
    mobileDeviceId?: string;
    oldSessionId?: string;
    logger?: IMediaSignalLogger;
    processorFactories: IServiceProcessorFactoryList;
    mediaStreamFactory: MediaStreamFactory;
    displayMediaFactory: MediaStreamFactory;
    randomStringFactory: RandomStringFactory;
    transport: MediaSignalTransport<ClientMediaSignal>;
    iceGatheringTimeout?: number;
    iceServers?: RTCIceServer[];
    features: CallFeature[];
    autoSync?: boolean;
};
export declare class MediaSignalingSession extends Emitter<MediaSignalingEvents> {
    private config;
    private _userId;
    private readonly _sessionId;
    private knownCalls;
    private ignoredCalls;
    private transporter;
    private recurringStateReportHandler;
    private inputTrack;
    private switchingInputTrack;
    private deviceId;
    private currentDeviceId;
    private callsToGetUserMedia;
    private lastRegisterTimestamp;
    private lastState;
    private sessionEnded;
    private registration;
    private _micless;
    private shouldMuteMiclessCall;
    get sessionId(): string;
    get userId(): string;
    get registered(): boolean;
    set micless(micless: boolean);
    get micless(): boolean;
    constructor(config: MediaSignalingSessionConfig);
    isBusy(): boolean;
    enableStateReport(interval: number): void;
    disableStateReport(): void;
    endSession(): void;
    getCallData(callId: string): IClientMediaCall | null;
    getState(skipLocal?: boolean): (AnyMediaCallData & {
        call: IClientMediaCall;
    }) | null;
    private getMainCall;
    processSignal(signal: ServerMediaSignal): Promise<void>;
    private processSessionSignal;
    private processCallSignal;
    setDeviceId(deviceId: ConstrainDOMString | null, force?: boolean): Promise<void>;
    startCall(calleeType: CallActorType, calleeId: string, params?: {
        contactInfo?: CallContact;
    }): Promise<void>;
    setIceGatheringTimeout(newTimeout: number): void;
    setIceServers(iceServers: RTCIceServer[]): void;
    private createTemporaryCallId;
    private isCallIgnored;
    private ignoreCall;
    private sendRegisterSignal;
    private confirmSessionRegistered;
    private getExistingCallBySignal;
    private getReplacedCallBySignal;
    private getOrCreateCallBySignal;
    private reportState;
    private autoRegister;
    private setInputTrack;
    requestInputTrackUpdate(): void;
    /**
     * Switch ON/OFF the use of an audio input track
     * If there's one already in use, remove it; Otherwise, request and use a new one.
     * This function assumes the current state needs to change and doesn't check anything before starting the switch process
     * Switching OFF is straightforward: the current track is removed and stopped
     * Switching ON is a multi-step process:
     * 1. We request a new track from the media stream factory
     * 2. Once the media stream factory returns a valid track, we double check that we still need it
     * 2.1. If the track is still needed, we set it to all active calls
     * 2.2. If the track is no longer needed by then, we stop it and keep no reference to it
     *
     * The track state only changes by the end of the whole process, so there's no point in calling this function twice and we guard against it --
     * but we don't guard against external changes to the track (for example, calling setDeviceId will also change the track state)
     * */
    private switchInputTrack;
    private shouldStartInputTrack;
    private shouldSwitchInputTrack;
    private getAudioConstraints;
    private startInputTrack;
    private hangupCallsThatNeedInput;
    private mayNeedInputTrack;
    private setScreenVideoTrack;
    private startScreenVideoTrack;
    private endScreenSharing;
    private startScreenSharing;
    private createCall;
    private onCallContactUpdate;
    private onCallStateChange;
    private onCallClientStateChange;
    private onNewCall;
    private onConfirmedCall;
    private onAcceptedCall;
    private onAcceptingCall;
    private onTrackStateChange;
    private onEndedCall;
    private onHiddenCall;
    private onActiveCall;
    private onScreenShareRequestChange;
    private onSessionStateChange;
}
//# sourceMappingURL=Session.d.ts.map