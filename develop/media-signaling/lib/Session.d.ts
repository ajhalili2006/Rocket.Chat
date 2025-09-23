import { Emitter } from '@rocket.chat/emitter';
import type { ClientMediaSignal, IServiceProcessorFactoryList, MediaSignalTransport, MediaStreamFactory, RandomStringFactory, ServerMediaSignal } from '../definition';
import type { IClientMediaCall, CallActorType, CallContact } from '../definition/call';
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
};
export type MediaSignalingSessionConfig = {
    userId: string;
    oldSessionId?: string;
    logger?: IMediaSignalLogger;
    processorFactories: IServiceProcessorFactoryList;
    mediaStreamFactory: MediaStreamFactory;
    randomStringFactory: RandomStringFactory;
    transport: MediaSignalTransport<ClientMediaSignal>;
    iceGatheringTimeout?: number;
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
    private updatingInputTrack;
    private deviceId;
    private currentDeviceId;
    private callsToGetUserMedia;
    private lastRegisterTimestamp;
    private lastState;
    get sessionId(): string;
    get userId(): string;
    constructor(config: MediaSignalingSessionConfig);
    isBusy(): boolean;
    enableStateReport(interval: number): void;
    disableStateReport(): void;
    endSession(): void;
    getCallData(callId: string): IClientMediaCall | null;
    getMainCall(): IClientMediaCall | null;
    processSignal(signal: ServerMediaSignal): Promise<void>;
    setDeviceId(deviceId: ConstrainDOMString | null): Promise<void>;
    startCall(calleeType: CallActorType, calleeId: string, params?: {
        contactInfo?: CallContact;
    }): Promise<void>;
    register(): void;
    setIceGatheringTimeout(newTimeout: number): void;
    private createTemporaryCallId;
    private isCallIgnored;
    private ignoreCall;
    private getExistingCallBySignal;
    private getReplacedCallBySignal;
    private getOrCreateCallBySignal;
    private reportState;
    private autoRegister;
    private setInputTrack;
    private requestInputTrackUpdate;
    private updateInputTrack;
    private maybeStartInputTrack;
    private getAudioConstraints;
    private startInputTrack;
    private hangupCallsThatNeedInput;
    private maybeStopInputTrack;
    private createCall;
    private onCallContactUpdate;
    private onCallStateChange;
    private onCallClientStateChange;
    private onNewCall;
    private onAcceptedCall;
    private onAcceptingCall;
    private onTrackStateChange;
    private onEndedCall;
    private onHiddenCall;
    private onActiveCall;
    private onSessionStateChange;
}
//# sourceMappingURL=Session.d.ts.map