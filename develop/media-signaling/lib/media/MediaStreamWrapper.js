var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Emitter } from '@rocket.chat/emitter';
import { MediaStreamTrackWrapper } from './MediaStreamTrackWrapper';
const AUDIO_STATS_INTERVAL = 50;
export class MediaStreamWrapper {
    get local() {
        return !this.remote;
    }
    get localId() {
        return this.stream.id;
    }
    get active() {
        return this._active;
    }
    get audioLevel() {
        return this._audioLevel;
    }
    constructor(remote, tag, peer, logger) {
        this.tag = tag;
        this.peer = peer;
        this.logger = logger;
        this.audioEnabled = true;
        this.audioTrack = null;
        this.videoTrack = null;
        this.audioSender = null;
        this.videoSender = null;
        this.stopped = false;
        this.remote = remote;
        this.stream = new MediaStream();
        this.emitter = new Emitter();
        this.remoteIds = [];
        this._audioLevel = 0;
        this._trackingAudioStats = false;
        // Main stream initiates as active, any other initiates as inactive
        this._active = tag === 'main';
    }
    hasAudio() {
        if (!this.audioTrack || this.audioTrack.ended) {
            return false;
        }
        const tracks = this.stream.getAudioTracks() || [];
        if (!(tracks === null || tracks === void 0 ? void 0 : tracks.length)) {
            return false;
        }
        return true;
    }
    hasVideo() {
        if (!this.videoTrack || this.videoTrack.ended) {
            return false;
        }
        const tracks = this.stream.getVideoTracks() || [];
        if (!(tracks === null || tracks === void 0 ? void 0 : tracks.length)) {
            return false;
        }
        return true;
    }
    isAudioMutedBySystem() {
        if (!this.audioTrack) {
            return false;
        }
        return this.audioTrack.muted || !this.audioEnabled;
    }
    isAudioEnabled() {
        if (this.audioTrack) {
            return this.audioTrack.enabled;
        }
        return this.audioEnabled;
    }
    isStopped() {
        return this.stopped;
    }
    setAudioEnabled(enabled) {
        const wasMuted = this.isAudioMutedBySystem();
        this.audioEnabled = enabled;
        if (this.audioTrack) {
            this.audioTrack.enabled = enabled;
        }
        if (this.isAudioMutedBySystem() !== wasMuted) {
            this.emitter.emit('stateChanged');
        }
    }
    setActive(active) {
        if (this._active === active) {
            return;
        }
        this._active = active;
        this.emitter.emit('stateChanged');
    }
    stop() {
        var _a, _b;
        this.stopped = true;
        this.removeTracks();
        (_a = this.audioTrack) === null || _a === void 0 ? void 0 : _a.clear();
        (_b = this.videoTrack) === null || _b === void 0 ? void 0 : _b.clear();
    }
    setTrack(kind, track) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug('BaseMediaStream.setTrack', kind, this.remote, this.tag);
            if (track && this.isSameTrack(track.id)) {
                return;
            }
            yield this.replaceTrack(kind, track);
        });
    }
    addRemoteId(id) {
        if (this.hasRemoteId(id)) {
            return;
        }
        this.remoteIds.push(id);
    }
    hasRemoteId(id) {
        return this.remoteIds.includes(id);
    }
    getTracks(kind) {
        switch (kind) {
            case 'audio':
                return this.stream.getAudioTracks();
            case 'video':
                return this.stream.getVideoTracks();
            default:
                return this.stream.getTracks();
        }
    }
    removeTracks(kind) {
        const tracks = this.getTracks(kind);
        tracks.forEach((track) => {
            if (track) {
                this.stream.removeTrack(track);
            }
        });
    }
    replaceTrack(kind, newTrack) {
        return __awaiter(this, void 0, void 0, function* () {
            this.removeTracks(kind);
            if (newTrack) {
                this.stream.addTrack(newTrack);
            }
            this.wrapTrack(kind, newTrack);
            yield this.syncTrackChange(kind, newTrack);
            this.emitter.emit('trackChanged', { track: newTrack, kind });
        });
    }
    syncTrackChange(kind, track) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (this.remote) {
                return;
            }
            const sender = kind === 'audio' ? this.audioSender : this.videoSender;
            if (sender) {
                // If we already have a sender of the same kind for this stream, we can just replace the track with no issues
                // TODO: safe guard against edge cases where this would fail (eg: changing number of audio channels or increasing video quality)
                (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaStreamWrapper.setPeerTrack.replaceTrack', kind);
                yield sender.replaceTrack(track);
                return;
            }
            if (!track) {
                return;
            }
            (_b = this.logger) === null || _b === void 0 ? void 0 : _b.debug('MediaStreamWrapper.setPeerTrack.addTrack', kind);
            // This will require a re-negotiation
            this.peer.addTrack(track, this.stream);
            const transceiver = this.peer.getTransceivers().find((t) => t.sender.track === track);
            if (transceiver) {
                if (kind === 'audio') {
                    this.audioSender = transceiver.sender;
                }
                else {
                    this.videoSender = transceiver.sender;
                }
            }
        });
    }
    wrapTrack(kind, track) {
        const wrapper = track ? new MediaStreamTrackWrapper(track) : null;
        const oldWrapper = this.getWrappedTrack(kind);
        if (oldWrapper) {
            oldWrapper.clear();
        }
        if (kind === 'audio') {
            this.audioTrack = wrapper;
            if (this.local && wrapper) {
                wrapper.enabled = this.audioEnabled;
            }
            if (wrapper && !this._trackingAudioStats) {
                this.registerAudioLevelTracker();
            }
        }
        else {
            this.videoTrack = wrapper;
        }
        if (!wrapper) {
            return;
        }
        wrapper.emitter.on('mute', () => {
            this.emitter.emit('stateChanged');
        });
        wrapper.emitter.on('unmute', () => {
            this.emitter.emit('stateChanged');
        });
        wrapper.emitter.on('ended', () => {
            this.emitter.emit('stateChanged');
        });
    }
    isSameTrack(trackId) {
        return Boolean(this.stream.getTrackById(trackId));
    }
    getWrappedTrack(kind) {
        if (kind !== 'audio') {
            return this.videoTrack;
        }
        return this.audioTrack;
    }
    registerAudioLevelTracker() {
        if (this.stopped) {
            return;
        }
        this._trackingAudioStats = true;
        setTimeout(() => this.collectAudioStats(), AUDIO_STATS_INTERVAL);
    }
    collectAudioStats() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.stopped || !this.audioTrack) {
                this._audioLevel = 0;
                this._trackingAudioStats = false;
                return;
            }
            try {
                const stats = yield this.peer.getStats(this.audioTrack.track);
                if (!stats) {
                    return;
                }
                const relevantReportType = this.local ? 'media-source' : 'inbound-rtp';
                // stats is an object that has a forEach function
                stats.forEach((report) => {
                    var _a;
                    if (report.kind !== 'audio') {
                        return;
                    }
                    if (report.type !== relevantReportType) {
                        return;
                    }
                    this._audioLevel = (_a = report.audioLevel) !== null && _a !== void 0 ? _a : 0;
                });
            }
            catch (_a) {
                this._audioLevel = 0;
            }
            finally {
                // Ensure that the countdown for the next iteration only starts after fully processing the current one
                this.registerAudioLevelTracker();
            }
        });
    }
}
//# sourceMappingURL=MediaStreamWrapper.js.map