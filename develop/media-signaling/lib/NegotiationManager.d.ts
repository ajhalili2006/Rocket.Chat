import { Emitter } from '@rocket.chat/emitter';
import type { IClientMediaCall, IWebRTCProcessor, NegotiationManagerEvents, NegotiationManagerConfig } from '../definition';
import { Negotiation } from './services/webrtc/Negotiation';
export declare class NegotiationManager {
    protected readonly call: IClientMediaCall;
    protected readonly config: NegotiationManagerConfig;
    readonly emitter: Emitter<NegotiationManagerEvents>;
    get currentNegotiationId(): string | null;
    get hasFinishedAnyNegotiation(): boolean;
    protected negotiations: Map<string, Negotiation>;
    /** negotiation actively being processed, null once completed */
    protected currentNegotiation: Negotiation | null;
    protected highestProcessedSequence: number;
    protected highestImpoliteSequence: number;
    protected highestSequence: number;
    protected webrtcProcessor: IWebRTCProcessor | null;
    /** id of the newest negotiation that has reached the processing state */
    protected highestNegotiationId: string | null;
    /** id of the newest negotiation, regardless of state */
    protected highestKnownNegotiationId: string | null;
    /** id of the newest negotiation that has finished processing */
    protected highestFinishedNegotiationId: string | null;
    constructor(call: IClientMediaCall, config: NegotiationManagerConfig);
    addNegotiation(negotiationId: string, remoteOffer?: RTCSessionDescriptionInit | null, negotiationSequence?: number | null): Promise<void>;
    setRemoteDescription(negotiationId: string, remoteDescription: RTCSessionDescriptionInit, negotiationSequence?: number | null): Promise<void>;
    setWebRTCProcessor(webrtcProcessor: IWebRTCProcessor): void;
    processNegotiations(): Promise<void>;
    protected isPoliteClient(): boolean;
    protected addToQueue(negotiation: Negotiation): void;
    protected getNextInQueue(): Negotiation | null;
    protected processNegotiation(this: WebRTCNegotiationManager, negotiation: Negotiation): Promise<void>;
    isConfigured(): this is WebRTCNegotiationManager;
    protected isFulfillingNegotiationQueued(): boolean;
    protected onWebRTCNegotiationNeeded(): void;
    protected onWebRTCInternalError({ critical, error }: {
        critical: boolean;
        error: string | Error;
        errorDetails?: string;
    }): void;
}
declare abstract class WebRTCNegotiationManager extends NegotiationManager {
    protected abstract webrtcProcessor: IWebRTCProcessor;
}
export {};
//# sourceMappingURL=NegotiationManager.d.ts.map