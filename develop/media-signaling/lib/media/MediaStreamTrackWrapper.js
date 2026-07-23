import { Emitter } from '@rocket.chat/emitter';
/**
 * As a workaround for a chrome bug, we use a delay to ignore any 'mute' events that are immediately followed by an 'unmute' event.
 * */
const MUTE_DELAY = 500;
const ENDED_INTERVAL = 100;
export class MediaStreamTrackWrapper {
    /**
     * muted is a flag that determines if the track has media coming in
     */
    get muted() {
        return this.muteTriggered;
    }
    get ended() {
        return this.endedTriggered || this.track.readyState === 'ended';
    }
    /**
     * enabled is a flag that determines if the rocket.chat client wants this track to be enabled
     * */
    get enabled() {
        return this.track.enabled;
    }
    set enabled(value) {
        this.track.enabled = value;
    }
    constructor(track) {
        var _a;
        this.track = track;
        this.muteTriggered = false;
        this.endedTriggered = false;
        this.muteTimeoutHandler = null;
        this.endedIntervalHandler = null;
        this.cleared = false;
        this.emitter = new Emitter();
        this.muteTriggered = (_a = track.muted) !== null && _a !== void 0 ? _a : false;
        this.endedIntervalHandler = setInterval(() => {
            if (this.endedTriggered || this.track.readyState !== 'ended') {
                return;
            }
            this.setEnded();
        }, ENDED_INTERVAL);
        this._onTrackMute = () => this.onTrackMute();
        this._onTrackUnmute = () => this.onTrackUnmute();
        this._onTrackEnded = () => this.setEnded();
        this.track.addEventListener('mute', this._onTrackMute);
        this.track.addEventListener('unmute', this._onTrackUnmute);
        this.track.addEventListener('ended', this._onTrackEnded);
    }
    clear() {
        this.cleared = true;
        this.clearMuteTimeout();
        this.clearEndedInterval();
        this.track.removeEventListener('mute', this._onTrackMute);
        this.track.removeEventListener('unmute', this._onTrackUnmute);
        this.track.removeEventListener('ended', this._onTrackEnded);
    }
    setMuted(muted) {
        if (this.endedTriggered || this.muteTriggered === muted) {
            return;
        }
        this.muteTriggered = muted;
        if (muted) {
            this.emitter.emit('mute');
        }
        else {
            this.emitter.emit('unmute');
        }
    }
    setEnded() {
        this.clearEndedInterval();
        if (this.endedTriggered) {
            return;
        }
        this.clearMuteTimeout();
        this.endedTriggered = true;
        this.emitter.emit('ended');
    }
    onTrackMute() {
        if (this.cleared) {
            return;
        }
        this.clearMuteTimeout();
        this.muteTimeoutHandler = setTimeout(() => {
            this.setMuted(true);
        }, MUTE_DELAY);
    }
    onTrackUnmute() {
        this.clearMuteTimeout();
        if (this.muteTriggered) {
            this.setMuted(false);
        }
    }
    clearMuteTimeout() {
        if (!this.muteTimeoutHandler) {
            return;
        }
        clearTimeout(this.muteTimeoutHandler);
        this.muteTimeoutHandler = null;
    }
    clearEndedInterval() {
        if (!this.endedIntervalHandler) {
            return;
        }
        clearInterval(this.endedIntervalHandler);
        this.endedIntervalHandler = null;
    }
}
//# sourceMappingURL=MediaStreamTrackWrapper.js.map