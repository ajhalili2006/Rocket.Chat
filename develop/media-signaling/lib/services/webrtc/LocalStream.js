var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Stream } from './Stream';
export class LocalStream extends Stream {
    setTrack(newTrack) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (newTrack && (newTrack === null || newTrack === void 0 ? void 0 : newTrack.kind) !== 'audio') {
                return;
            }
            (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug('LocalStream.setTrack');
            if (newTrack) {
                const matchingTrack = this.mediaStream.getTrackById(newTrack.id);
                if (matchingTrack) {
                    matchingTrack.enabled = this.enabled;
                    return;
                }
                newTrack.enabled = this.enabled;
            }
            this.removeAudioTracks();
            if (newTrack) {
                this.mediaStream.addTrack(newTrack);
                yield this.setRemoteTrack(newTrack);
            }
        });
    }
    setRemoteTrack(newTrack) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            // If the peer doesn't yet have any audio track, send it to them
            (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug('LocalStream.setRemoteTrack');
            const sender = this.peer.getSenders().find((sender) => { var _a; return ((_a = sender.track) === null || _a === void 0 ? void 0 : _a.kind) === 'audio'; });
            if (!sender) {
                if (newTrack) {
                    (_b = this.logger) === null || _b === void 0 ? void 0 : _b.debug('LocalStream.setRemoteTrack.addTrack');
                    // This will require a re-negotiation
                    this.peer.addTrack(newTrack, this.mediaStream);
                }
                return;
            }
            // If the peer already has a track of the same kind, we can just replace it with the new track with no issues
            yield sender.replaceTrack(newTrack);
        });
    }
}
//# sourceMappingURL=LocalStream.js.map