import { Emitter } from '@rocket.chat/emitter';
export type MediaStreamTrackEvents = {
    mute: void;
    unmute: void;
    ended: void;
};
export declare class MediaStreamTrackWrapper {
    readonly track: MediaStreamTrack;
    /**
     * muted is a flag that determines if the track has media coming in
     */
    get muted(): boolean;
    get ended(): boolean;
    /**
     * enabled is a flag that determines if the rocket.chat client wants this track to be enabled
     * */
    get enabled(): boolean;
    set enabled(value: boolean);
    readonly emitter: Emitter<MediaStreamTrackEvents>;
    private muteTriggered;
    private endedTriggered;
    private muteTimeoutHandler;
    private endedIntervalHandler;
    private cleared;
    private _onTrackMute;
    private _onTrackUnmute;
    private _onTrackEnded;
    constructor(track: MediaStreamTrack);
    clear(): void;
    private setMuted;
    private setEnded;
    private onTrackMute;
    private onTrackUnmute;
    private clearMuteTimeout;
    private clearEndedInterval;
}
//# sourceMappingURL=MediaStreamTrackWrapper.d.ts.map