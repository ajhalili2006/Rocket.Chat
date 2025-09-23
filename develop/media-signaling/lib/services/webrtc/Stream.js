export class Stream {
    constructor(mediaStream, peer, logger) {
        this.peer = peer;
        this.logger = logger;
        this.mediaStream = mediaStream;
        this.enabled = true;
    }
    enable() {
        this.setEnabled(true);
    }
    disable() {
        this.setEnabled(false);
    }
    setEnabled(enabled) {
        this.enabled = enabled;
        this.toggleAudioTracks();
    }
    stopAudio() {
        this.removeAudioTracks();
    }
    toggleAudioTracks() {
        var _a;
        (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug('Stream.toggleAudioTracks', this.enabled);
        this.mediaStream.getAudioTracks().forEach((track) => {
            if (!track) {
                return;
            }
            track.enabled = this.enabled;
        });
    }
    removeAudioTracks() {
        var _a;
        (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug('Stream.removeAudioTracks');
        this.mediaStream.getAudioTracks().forEach((track) => {
            if (!track) {
                return;
            }
            this.mediaStream.removeTrack(track);
        });
    }
    setAudioTrack(newTrack) {
        var _a, _b;
        if (newTrack.kind !== 'audio') {
            return false;
        }
        (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug('Stream.setAudioTrack', newTrack.id);
        const matchingTrack = this.mediaStream.getTrackById(newTrack.id);
        if (matchingTrack) {
            (_b = this.logger) === null || _b === void 0 ? void 0 : _b.debug('Stream.setAudioTrack.return', 'track found by id');
            return false;
        }
        this.removeAudioTracks();
        this.mediaStream.addTrack(newTrack);
        return true;
    }
}
//# sourceMappingURL=Stream.js.map