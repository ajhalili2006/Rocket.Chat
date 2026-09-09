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
import { SDP } from './sdp';
export class Negotiation {
    get started() {
        return this._startedProcessing;
    }
    /** Returns true when the negotiation will no longer process anything, no matter the reason */
    get ended() {
        return this._ended;
    }
    get isLocal() {
        return !this.remoteOffer;
    }
    get finished() {
        return this._finished;
    }
    constructor(negotiation, logger) {
        this.logger = logger;
        this.webrtcProcessor = null;
        this._startedProcessing = false;
        this._ended = false;
        this._failed = false;
        this._finished = false;
        this.negotiationId = negotiation.negotiationId;
        this.sequence = negotiation.sequence;
        this.isPolite = negotiation.isPolite;
        this.remoteOffer = negotiation.remoteOffer;
        this.emitter = new Emitter();
    }
    end(finished = false) {
        var _a;
        if (this._ended) {
            return;
        }
        (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug('Negotiation.end', this.negotiationId);
        this._ended = true;
        if (finished && this._startedProcessing && !this._failed) {
            this._finished = true;
        }
        this.emitter.emit('ended');
    }
    process(webrtcProcessor) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (this._startedProcessing) {
                return;
            }
            (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug('Negotiation.process', this.negotiationId);
            this.setWebRTCProcessor(webrtcProcessor);
            this._startedProcessing = true;
            if (this.remoteOffer) {
                yield this.createLocalAnswer(this.remoteOffer);
                return;
            }
            // after creating the local offer, this negotiation will remain active until it receives an answer
            yield this.createLocalOffer();
        });
    }
    setRemoteAnswer(sdp) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (!this.isWebRTCNegotiation()) {
                return;
            }
            (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug('Negotiation.setRemoteAnswer', this.negotiationId);
            if (!this.isLocal || !this._startedProcessing || sdp.type !== 'answer') {
                (_b = this.logger) === null || _b === void 0 ? void 0 : _b.warn('Invalid negotiation workflow');
                return;
            }
            yield this.setPeerRemoteDescription(sdp);
            // Local negotiations end when the remote description is available
            this.end(true);
        });
    }
    setLocalDescription(sdp) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug('Negotiation.setLocalDescription', this.negotiationId);
            this.assertNegotiationIsActive();
            yield this.setPeerLocalDescription(sdp);
            this.assertNegotiationIsActive();
            yield this.webrtcProcessor.waitForIceGathering();
            this.assertNegotiationIsActive();
            const localDescription = this.getPeerLocalDescription();
            this.emitter.emit('local-sdp', { sdp: localDescription });
            // Remote negotiations end when the local description is available
            if (!this.isLocal) {
                this.end(true);
            }
        });
    }
    setWebRTCProcessor(webrtcProcessor) {
        this.webrtcProcessor = webrtcProcessor;
    }
    isWebRTCNegotiation() {
        return !!this.webrtcProcessor;
    }
    assertNegotiationIsActive() {
        if (this._ended) {
            this.fail('skipped-negotiation');
            throw new Error('Skipped Negotiation');
        }
    }
    createLocalOffer() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug('Negotiation.createLocalOffer', this.negotiationId);
            this.assertNegotiationIsActive();
            const earlyOffer = yield this.webrtcProcessor.createOffer({});
            yield this.setLocalDescription(earlyOffer);
        });
    }
    createLocalAnswer(remoteOffer) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug('Negotiation.createLocalAnswer', this.negotiationId);
            this.assertNegotiationIsActive();
            yield this.setPeerRemoteDescription(remoteOffer);
            this.assertNegotiationIsActive();
            const earlyAnswer = yield this.createEarlyAnswer();
            this.assertNegotiationIsActive();
            yield this.setLocalDescription(earlyAnswer);
        });
    }
    fail(errorCode) {
        if (this._failed || this._ended) {
            return;
        }
        this.emitter.emit('error', { errorCode });
        this._failed = true;
    }
    setPeerRemoteDescription(remoteDescription) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                yield this.webrtcProcessor.setRemoteDescription(remoteDescription);
            }
            catch (err) {
                (_a = this.logger) === null || _a === void 0 ? void 0 : _a.error(err);
                this.fail('failed-to-set-remote-description');
            }
        });
    }
    createEarlyAnswer() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const earlyAnswer = yield this.webrtcProcessor.createAnswer();
                return earlyAnswer;
            }
            catch (err) {
                (_a = this.logger) === null || _a === void 0 ? void 0 : _a.error(err);
                this.fail('failed-to-create-local-answer');
                throw err;
            }
        });
    }
    setPeerLocalDescription(localDescription) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                yield this.webrtcProcessor.setLocalDescription(localDescription);
            }
            catch (err) {
                (_a = this.logger) === null || _a === void 0 ? void 0 : _a.error(err);
                this.fail('failed-to-set-local-description');
            }
        });
    }
    getPeerLocalDescription() {
        var _a;
        try {
            const sdp = this.webrtcProcessor.getLocalDescription();
            if (!sdp) {
                throw new Error('No local description');
            }
            return this.mutateLocalDescription(sdp);
        }
        catch (err) {
            (_a = this.logger) === null || _a === void 0 ? void 0 : _a.error(err);
            this.fail('failed-to-get-local-description');
            throw err;
        }
    }
    mutateLocalDescription(description) {
        var _a, _b;
        const { sdp, type } = description;
        if (!sdp) {
            return description;
        }
        (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.mutateLocalDescription', type);
        const mainStreamId = this.webrtcProcessor.streams.mainLocal.stream.id;
        const screenShareStreamId = this.webrtcProcessor.streams.screenShareLocal.stream.id;
        const mutated = SDP.mutateSDPWithStreamContents(sdp, [
            { id: mainStreamId, content: 'main' },
            { id: screenShareStreamId, content: 'slides' },
        ]);
        if (sdp !== mutated) {
            (_b = this.logger) === null || _b === void 0 ? void 0 : _b.debug('SDP was mutated');
        }
        return {
            type,
            sdp: mutated,
        };
    }
}
export class WebRTCNegotiation extends Negotiation {
}
//# sourceMappingURL=Negotiation.js.map