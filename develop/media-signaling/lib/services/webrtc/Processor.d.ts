import { Emitter } from '@rocket.chat/emitter';
import type { IWebRTCProcessor, WebRTCInternalStateMap, WebRTCProcessorConfig, WebRTCProcessorEvents } from '../../../definition';
import type { ServiceStateValue } from '../../../definition/services/IServiceProcessor';
export declare class MediaCallWebRTCProcessor implements IWebRTCProcessor {
    private readonly config;
    readonly emitter: Emitter<WebRTCProcessorEvents>;
    private peer;
    private iceGatheringFinished;
    private iceGatheringTimedOut;
    private localStream;
    private localMediaStream;
    private localMediaStreamInitialized;
    private remoteStream;
    private remoteMediaStream;
    private iceGatheringWaiters;
    private inputTrack;
    private _muted;
    get muted(): boolean;
    private _held;
    get held(): boolean;
    private stopped;
    private iceCandidateCount;
    private lastSetLocalDescription;
    private addedEmptyTransceiver;
    private _audioLevelTracker;
    private _audioLevel;
    get audioLevel(): number;
    private _localAudioLevel;
    get localAudioLevel(): number;
    constructor(config: WebRTCProcessorConfig);
    getRemoteMediaStream(): MediaStream;
    setInputTrack(newInputTrack: MediaStreamTrack | null): Promise<void>;
    createOffer({ iceRestart }: {
        iceRestart?: boolean;
    }): Promise<{
        sdp: RTCSessionDescriptionInit;
    }>;
    setMuted(muted: boolean): void;
    setHeld(held: boolean): void;
    stop(): void;
    startNewNegotiation(): void;
    createAnswer({ sdp }: {
        sdp: RTCSessionDescriptionInit;
    }): Promise<{
        sdp: RTCSessionDescriptionInit;
    }>;
    setRemoteAnswer({ sdp }: {
        sdp: RTCSessionDescriptionInit;
    }): Promise<void>;
    getInternalState<K extends keyof WebRTCInternalStateMap>(stateName: K): ServiceStateValue<WebRTCInternalStateMap, K>;
    getStats(selector?: MediaStreamTrack | null): Promise<RTCStatsReport | null>;
    private changeInternalState;
    private getLocalDescription;
    private waitForIceGathering;
    private registerPeerEvents;
    private unregisterPeerEvents;
    private registerAudioLevelTracker;
    private unregisterAudioLevelTracker;
    private restartIce;
    private onIceCandidate;
    private onIceCandidateError;
    private onNegotiationNeeded;
    private onTrack;
    private onConnectionStateChange;
    private onIceConnectionStateChange;
    private onSignalingStateChange;
    private onIceGatheringStateChange;
    private initializeLocalMediaStream;
    private loadInputTrack;
    private onIceGatheringComplete;
    private clearIceGatheringData;
    private clearIceGatheringWaiters;
}
//# sourceMappingURL=Processor.d.ts.map