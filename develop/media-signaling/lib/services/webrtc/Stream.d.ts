import type { IMediaSignalLogger } from '../../../definition';
export declare class Stream {
    protected readonly peer: RTCPeerConnection;
    protected readonly logger?: IMediaSignalLogger | undefined;
    protected mediaStream: MediaStream;
    protected enabled: boolean;
    constructor(mediaStream: MediaStream, peer: RTCPeerConnection, logger?: IMediaSignalLogger | undefined);
    enable(): void;
    disable(): void;
    setEnabled(enabled: boolean): void;
    stopAudio(): void;
    protected toggleAudioTracks(): void;
    protected removeAudioTracks(): void;
    protected setAudioTrack(newTrack: MediaStreamTrack): boolean;
}
//# sourceMappingURL=Stream.d.ts.map