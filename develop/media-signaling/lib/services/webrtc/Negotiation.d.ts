import { Emitter } from '@rocket.chat/emitter';
import type { IMediaSignalLogger, IWebRTCProcessor, NegotiationData, NegotiationEvents } from '../../../definition';
export declare class Negotiation {
    protected readonly logger?: (IMediaSignalLogger | null) | undefined;
    readonly emitter: Emitter<NegotiationEvents>;
    get started(): boolean;
    /** Returns true when the negotiation will no longer process anything, no matter the reason */
    get ended(): boolean;
    get isLocal(): boolean;
    get finished(): boolean;
    readonly negotiationId: string;
    readonly sequence: number;
    readonly isPolite: boolean;
    protected webrtcProcessor: IWebRTCProcessor | null;
    protected remoteOffer: RTCSessionDescriptionInit | null;
    protected _ended: boolean;
    protected _startedProcessing: boolean;
    protected _failed: boolean;
    protected _finished: boolean;
    constructor(negotiation: NegotiationData, logger?: (IMediaSignalLogger | null) | undefined);
    end(finished?: boolean): void;
    process(webrtcProcessor: IWebRTCProcessor): Promise<void>;
    setRemoteAnswer(sdp: RTCSessionDescriptionInit): Promise<void>;
    protected setLocalDescription(this: WebRTCNegotiation, sdp: RTCSessionDescriptionInit): Promise<void>;
    protected setWebRTCProcessor(webrtcProcessor: IWebRTCProcessor): asserts this is WebRTCNegotiation;
    protected isWebRTCNegotiation(): this is WebRTCNegotiation;
    protected assertNegotiationIsActive(): void;
    protected createLocalOffer(this: WebRTCNegotiation): Promise<void>;
    protected createLocalAnswer(this: WebRTCNegotiation, remoteOffer: RTCSessionDescriptionInit): Promise<void>;
    protected fail(errorCode: string): void;
    protected setPeerRemoteDescription(this: WebRTCNegotiation, remoteDescription: RTCSessionDescriptionInit): Promise<void>;
    protected createEarlyAnswer(this: WebRTCNegotiation): Promise<RTCSessionDescriptionInit>;
    protected setPeerLocalDescription(this: WebRTCNegotiation, localDescription: RTCSessionDescriptionInit): Promise<void>;
    protected getPeerLocalDescription(this: WebRTCNegotiation): RTCSessionDescriptionInit;
    protected mutateLocalDescription(this: WebRTCNegotiation, description: RTCSessionDescriptionInit): RTCSessionDescriptionInit;
}
export declare abstract class WebRTCNegotiation extends Negotiation {
    protected abstract webrtcProcessor: IWebRTCProcessor;
}
//# sourceMappingURL=Negotiation.d.ts.map