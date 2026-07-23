import { Emitter } from '@rocket.chat/emitter';
import { MediaStreamWrapper } from './MediaStreamWrapper';
export class MediaStreamManager {
    constructor(peer, logger) {
        this.peer = peer;
        this.logger = logger;
        this.emitter = new Emitter();
        this.mainLocal = this.createStream(false, 'main');
        this.screenShareLocal = this.createStream(false, 'screen-share');
        this.mainRemote = this.createStream(true, 'main');
        this.screenShareRemote = this.createStream(true, 'screen-share');
    }
    stopRemoteStreams() {
        this.mainRemote.stop();
        this.screenShareRemote.stop();
    }
    setRemoteIds(streams) {
        var _a;
        for (const stream of streams) {
            (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug('setting remote id', stream.tag, stream.id);
            const localStream = this.getRemoteStreamByTag(stream.tag);
            if (!localStream) {
                continue;
            }
            localStream.addRemoteId(stream.id);
        }
    }
    getLocalStreamIds() {
        return this.getLocalStreams().map((stream) => ({
            tag: stream.tag,
            id: stream.stream.id,
        }));
    }
    addRemoteTrack(track, streams) {
        var _a, _b;
        (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug('addRemoteTrack', track.kind);
        const streamWrappers = this.findStreamWrappersForRemoteTrack(track, streams);
        for (const stream of streamWrappers) {
            (_b = this.logger) === null || _b === void 0 ? void 0 : _b.debug('setRemoteTrack', stream.tag, track.kind);
            void stream.setTrack(track.kind, track);
        }
    }
    getStreams() {
        return [...this.getLocalStreams(), ...this.getRemoteStreams()];
    }
    getLocalStreams() {
        return [this.mainLocal, this.screenShareLocal];
    }
    getRemoteStreams() {
        return [this.mainRemote, this.screenShareRemote];
    }
    getLocalStreamByTag(tag) {
        return this.getLocalStreams().find((stream) => stream.tag === tag) || null;
    }
    getRemoteStreamByTag(tag) {
        return this.getRemoteStreams().find((stream) => stream.tag === tag) || null;
    }
    hasAllRequiredTracks() {
        return this.mainLocal.hasAudio();
    }
    findStreamWrappersForRemoteTrack(track, streams) {
        var _a, _b, _c;
        const streamWrappers = streams
            .map((stream) => this.getRemoteStreamById(stream.id))
            .filter((wrapper) => Boolean(wrapper));
        if (streamWrappers.length) {
            (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug('found stream wrappers for track');
            return streamWrappers;
        }
        // If no streams have been found by id and it's an audio track, this is probably an external call so assume the main stream
        if (track.kind === 'audio') {
            (_b = this.logger) === null || _b === void 0 ? void 0 : _b.debug('default audio to main track');
            return [this.mainRemote];
        }
        // A video track for an unidentified stream, let's ignore it
        (_c = this.logger) === null || _c === void 0 ? void 0 : _c.debug('unidentified stream, ignoring video track');
        return [];
    }
    createStream(remote, tag) {
        const wrapper = new MediaStreamWrapper(remote, tag, this.peer, this.logger);
        wrapper.emitter.on('trackChanged', () => {
            var _a;
            (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug('Wrapper.trackChanged', tag, remote);
            this.emitter.emit('streamChanged');
        });
        wrapper.emitter.on('stateChanged', () => {
            var _a;
            (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug('Wrapper.stateChanged', tag, remote);
            this.emitter.emit('streamChanged');
        });
        return wrapper;
    }
    getRemoteStreamById(id) {
        return this.getRemoteStreams().find((stream) => stream.hasRemoteId(id)) || null;
    }
}
//# sourceMappingURL=MediaStreamManager.js.map