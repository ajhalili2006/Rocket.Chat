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
import { LocalStream } from './LocalStream';
import { RemoteStream } from './RemoteStream';
import { getExternalWaiter } from '../../utils/getExternalWaiter';
export class MediaCallWebRTCProcessor {
    get muted() {
        return this._muted;
    }
    get held() {
        return this._held;
    }
    constructor(config) {
        this.config = config;
        this.iceGatheringFinished = false;
        this.iceGatheringTimedOut = false;
        this.localMediaStreamInitialized = false;
        this._muted = false;
        this._held = false;
        this.stopped = false;
        this.iceCandidateCount = 0;
        this.lastSetLocalDescription = null;
        this.addedEmptyTransceiver = false;
        this.localMediaStream = new MediaStream();
        this.remoteMediaStream = new MediaStream();
        this.iceGatheringWaiters = new Set();
        this.inputTrack = config.inputTrack;
        this.peer = new RTCPeerConnection(config.rtc);
        this.localStream = new LocalStream(this.localMediaStream, this.peer, this.config.logger);
        this.remoteStream = new RemoteStream(this.remoteMediaStream, this.peer, this.config.logger);
        this.emitter = new Emitter();
        this.registerPeerEvents();
    }
    getRemoteMediaStream() {
        return this.remoteMediaStream;
    }
    setInputTrack(newInputTrack) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.setInputTrack');
            if (newInputTrack && newInputTrack.kind !== 'audio') {
                throw new Error('Unsupported track kind');
            }
            this.inputTrack = newInputTrack;
            yield this.loadInputTrack();
        });
    }
    createOffer(_a) {
        return __awaiter(this, arguments, void 0, function* ({ iceRestart }) {
            var _b;
            (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.debug('MediaCallWebRTCProcessor.createOffer');
            if (this.stopped) {
                throw new Error('WebRTC Processor has already been stopped.');
            }
            yield this.initializeLocalMediaStream();
            if (!this.addedEmptyTransceiver) {
                // If there's no audio transceivers yet, add a new one; since it's an offer, the track can be set later
                const transceivers = this.peer
                    .getTransceivers()
                    .filter((transceiver) => { var _a, _b; return ((_a = transceiver.sender.track) === null || _a === void 0 ? void 0 : _a.kind) === 'audio' || ((_b = transceiver.receiver.track) === null || _b === void 0 ? void 0 : _b.kind) === 'audio'; });
                if (!transceivers.length) {
                    this.peer.addTransceiver('audio', { direction: 'sendrecv' });
                    this.addedEmptyTransceiver = true;
                }
            }
            if (iceRestart) {
                this.restartIce();
            }
            const offer = yield this.peer.createOffer();
            if (this.lastSetLocalDescription && offer.sdp !== this.lastSetLocalDescription && !iceRestart) {
                this.startNewNegotiation();
            }
            this.lastSetLocalDescription = offer.sdp || null;
            yield this.peer.setLocalDescription(offer);
            return this.getLocalDescription();
        });
    }
    setMuted(muted) {
        if (this.stopped) {
            return;
        }
        this._muted = muted;
        this.localStream.setEnabled(!muted && !this._held);
    }
    setHeld(held) {
        if (this.stopped) {
            return;
        }
        this._held = held;
        this.localStream.setEnabled(!held && !this._muted);
        this.remoteStream.setEnabled(!held);
    }
    stop() {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.stop');
        this.stopped = true;
        // Stop only the remote stream; the track of the local stream may still be in use by another call so it's up to the session to stop it.
        this.remoteStream.stopAudio();
        this.unregisterPeerEvents();
        this.peer.close();
    }
    startNewNegotiation() {
        this.iceGatheringFinished = false;
        this.clearIceGatheringWaiters(new Error('new-negotiation'));
        this.iceCandidateCount = 0;
    }
    createAnswer(_a) {
        return __awaiter(this, arguments, void 0, function* ({ sdp }) {
            var _b, _c;
            (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.debug('MediaCallWebRTCProcessor.createAnswer');
            if (this.stopped) {
                throw new Error('WebRTC Processor has already been stopped.');
            }
            if (sdp.type !== 'offer') {
                throw new Error('invalid-webrtc-offer');
            }
            if (!this.inputTrack) {
                throw new Error('no-input-track');
            }
            yield this.initializeLocalMediaStream();
            const transceivers = this.peer
                .getTransceivers()
                .filter((transceiver) => { var _a, _b; return ((_a = transceiver.sender.track) === null || _a === void 0 ? void 0 : _a.kind) === 'audio' || ((_b = transceiver.receiver.track) === null || _b === void 0 ? void 0 : _b.kind) === 'audio'; });
            if (!transceivers.length) {
                throw new Error('no-audio-transceiver');
            }
            if (((_c = this.peer.remoteDescription) === null || _c === void 0 ? void 0 : _c.sdp) !== sdp.sdp) {
                this.startNewNegotiation();
                yield this.peer.setRemoteDescription(sdp);
            }
            const answer = yield this.peer.createAnswer();
            this.lastSetLocalDescription = answer.sdp || null;
            yield this.peer.setLocalDescription(answer);
            return this.getLocalDescription();
        });
    }
    setRemoteAnswer(_a) {
        return __awaiter(this, arguments, void 0, function* ({ sdp }) {
            var _b;
            (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.debug('MediaCallWebRTCProcessor.setRemoteAnswer');
            if (this.stopped) {
                return;
            }
            if (sdp.type === 'offer') {
                throw new Error('invalid-answer');
            }
            yield this.peer.setRemoteDescription(sdp);
        });
    }
    getInternalState(stateName) {
        switch (stateName) {
            case 'signaling':
                return this.peer.signalingState;
            case 'connection':
                return this.peer.connectionState;
            case 'iceConnection':
                return this.peer.iceConnectionState;
            case 'iceGathering':
                return this.peer.iceGatheringState;
            case 'iceUntrickler':
                if (this.iceGatheringTimedOut) {
                    return 'timeout';
                }
                return this.iceGatheringWaiters.size > 0 ? 'waiting' : 'not-waiting';
        }
    }
    changeInternalState(stateName) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.changeInternalState', stateName);
        this.emitter.emit('internalStateChange', stateName);
    }
    getLocalDescription() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.getLocalDescription');
            if (this.stopped) {
                throw new Error('WebRTC Processor has already been stopped.');
            }
            yield this.waitForIceGathering();
            const sdp = this.peer.localDescription;
            if (!sdp) {
                throw new Error('no-local-sdp');
            }
            (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.debug('MediaCallWebRTCProcessor.getLocalDescription - ice candidates: ', this.iceCandidateCount);
            // If we don't have any ice candidate, trigger a service error.
            if (this.iceCandidateCount === 0) {
                this.emitter.emit('internalError', { critical: true, error: 'no-ice-candidates' });
            }
            return {
                sdp,
            };
        });
    }
    waitForIceGathering() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.waitForIceGathering');
            if (this.iceGatheringFinished || this.stopped) {
                return;
            }
            this.iceGatheringTimedOut = false;
            const iceGatheringData = getExternalWaiter({
                timeout: this.config.iceGatheringTimeout,
                timeoutFn: () => {
                    var _a;
                    if (!this.iceGatheringWaiters.has(iceGatheringData)) {
                        return;
                    }
                    (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.waitForIceGathering.timeout', this.iceCandidateCount);
                    this.clearIceGatheringData(iceGatheringData);
                    this.iceGatheringTimedOut = true;
                    this.changeInternalState('iceUntrickler');
                },
            });
            this.iceGatheringWaiters.add(iceGatheringData);
            this.changeInternalState('iceUntrickler');
            yield iceGatheringData.promise;
            // always wait a little extra to ensure all relevant events have been fired
            // 30ms is low enough that it won't be noticeable by users, but is also enough time to process any local stuff
            yield new Promise((resolve) => setTimeout(resolve, 30));
        });
    }
    registerPeerEvents() {
        const { peer } = this;
        peer.ontrack = (event) => this.onTrack(event);
        peer.onicecandidate = (event) => this.onIceCandidate(event);
        peer.onicecandidateerror = (event) => this.onIceCandidateError(event);
        peer.onconnectionstatechange = () => this.onConnectionStateChange();
        peer.oniceconnectionstatechange = () => this.onIceConnectionStateChange();
        peer.onnegotiationneeded = () => this.onNegotiationNeeded();
        peer.onicegatheringstatechange = () => this.onIceGatheringStateChange();
        peer.onsignalingstatechange = () => this.onSignalingStateChange();
    }
    unregisterPeerEvents() {
        try {
            const { peer } = this;
            peer.ontrack = null;
            peer.onicecandidate = null;
            peer.onicecandidateerror = null;
            peer.onconnectionstatechange = null;
            peer.oniceconnectionstatechange = null;
            peer.onnegotiationneeded = null;
            peer.onicegatheringstatechange = null;
            peer.onsignalingstatechange = null;
        }
        catch (_a) {
            // suppress exceptions here
        }
    }
    restartIce() {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.restartIce');
        this.startNewNegotiation();
        this.peer.restartIce();
    }
    onIceCandidate(event) {
        var _a;
        if (this.stopped) {
            return;
        }
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.onIceCandidate', event.candidate);
        this.iceCandidateCount++;
    }
    onIceCandidateError(event) {
        var _a, _b;
        if (this.stopped) {
            return;
        }
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.onIceCandidateError');
        (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.error(event);
        this.emitter.emit('internalError', { critical: false, error: 'ice-candidate-error' });
    }
    onNegotiationNeeded() {
        var _a;
        if (this.stopped) {
            return;
        }
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.onNegotiationNeeded');
        this.emitter.emit('negotiationNeeded');
    }
    onTrack(event) {
        var _a;
        if (this.stopped) {
            return;
        }
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.onTrack', event.track.kind);
        // Received a remote stream
        this.remoteStream.setTrack(event.track);
    }
    onConnectionStateChange() {
        var _a;
        if (this.stopped) {
            return;
        }
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.onConnectionStateChange');
        this.changeInternalState('connection');
    }
    onIceConnectionStateChange() {
        var _a;
        if (this.stopped) {
            return;
        }
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.onIceConnectionStateChange');
        this.changeInternalState('iceConnection');
    }
    onSignalingStateChange() {
        var _a;
        if (this.stopped) {
            return;
        }
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.onSignalingStateChange');
        this.changeInternalState('signaling');
    }
    onIceGatheringStateChange() {
        var _a;
        if (this.stopped) {
            return;
        }
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.onIceGatheringStateChange');
        if (this.peer.iceGatheringState === 'complete') {
            this.onIceGatheringComplete();
        }
        this.changeInternalState('iceGathering');
    }
    initializeLocalMediaStream() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (this.localMediaStreamInitialized) {
                return;
            }
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.initializeLocalMediaStream');
            yield this.loadInputTrack();
        });
    }
    loadInputTrack() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.loadInputTrack');
            this.localMediaStreamInitialized = true;
            yield this.localStream.setTrack(this.inputTrack);
        });
    }
    onIceGatheringComplete() {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.onIceGatheringComplete');
        this.iceGatheringFinished = true;
        this.clearIceGatheringWaiters();
    }
    clearIceGatheringData(iceGatheringData, error) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.clearIceGatheringData');
        if (this.iceGatheringWaiters.has(iceGatheringData)) {
            this.iceGatheringWaiters.delete(iceGatheringData);
        }
        if (iceGatheringData.timeout) {
            clearTimeout(iceGatheringData.timeout);
        }
        if (error) {
            if (iceGatheringData.promiseReject) {
                iceGatheringData.promiseReject(error);
            }
            return;
        }
        if (iceGatheringData.promiseResolve) {
            iceGatheringData.promiseResolve();
        }
    }
    clearIceGatheringWaiters(error) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.clearIceGatheringWaiters');
        this.iceGatheringTimedOut = false;
        if (!this.iceGatheringWaiters.size) {
            return;
        }
        const waiters = Array.from(this.iceGatheringWaiters.values());
        this.iceGatheringWaiters.clear();
        for (const iceGatheringData of waiters) {
            this.clearIceGatheringData(iceGatheringData, error);
        }
        this.changeInternalState('iceUntrickler');
    }
}
//# sourceMappingURL=Processor.js.map