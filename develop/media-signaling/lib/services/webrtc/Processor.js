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
import { MediaStreamManager } from '../../media/MediaStreamManager';
import { getExternalWaiter } from '../../utils/getExternalWaiter';
const DATA_CHANNEL_LABEL = 'rocket.chat';
export class MediaCallWebRTCProcessor {
    get muted() {
        return this._muted;
    }
    get held() {
        return this._held;
    }
    constructor(config) {
        this.config = config;
        this.iceGatheringTimedOut = false;
        this._muted = false;
        this._held = false;
        this.stopped = false;
        this.iceCandidateCount = 0;
        this._remoteMute = false;
        this._remoteHeld = false;
        this._dataChannelEnded = false;
        this.iceGatheringWaiters = new Set();
        this.inputTrack = config.inputTrack;
        this.screenVideoTrack = config.screenVideoTrack || null;
        this._dataChannel = null;
        this.emitter = new Emitter();
        this.peer = new RTCPeerConnection(config.rtc);
        this.registerPeerEvents();
        this.streams = new MediaStreamManager(this.peer, this.config.logger);
        this.streams.emitter.on('streamChanged', () => {
            var _a;
            (_a = config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.streamChanged');
            this.emitter.emit('streamChanged');
        });
        this.initialization = this.initialize().catch((e) => {
            var _a;
            (_a = config.logger) === null || _a === void 0 ? void 0 : _a.error('MediaCallWebRTCProcessor.initialization error', e);
            this.stop();
        });
    }
    setInputTrack(newInputTrack) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.setInputTrack');
            if (newInputTrack && newInputTrack.kind !== 'audio') {
                throw new Error('Unsupported track kind');
            }
            yield this.initialization;
            this.inputTrack = newInputTrack;
            yield this.loadInputTrack();
        });
    }
    setScreenVideoTrack(newVideoTrack) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.setScreenVideoTrack');
            if (newVideoTrack && newVideoTrack.kind !== 'video') {
                throw new Error('Unsupported track kind');
            }
            yield this.initialization;
            this.screenVideoTrack = newVideoTrack;
            yield this.loadScreenVideoTrack();
        });
    }
    createOffer(_a) {
        return __awaiter(this, arguments, void 0, function* ({ iceRestart }) {
            var _b;
            (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.debug('MediaCallWebRTCProcessor.createOffer');
            if (this.stopped) {
                throw new Error('WebRTC Processor has already been stopped.');
            }
            yield this.initialization;
            this.createDataChannel();
            this.processPreNegotiation();
            if (iceRestart) {
                this.restartIce();
            }
            return this.peer.createOffer({});
        });
    }
    setMuted(muted) {
        if (this.stopped) {
            return;
        }
        this._muted = muted;
        this.streams.mainLocal.setAudioEnabled(!muted && !this._held);
        this.updateMuteForRemote();
    }
    setHeld(held) {
        if (this.stopped) {
            return;
        }
        this._held = held;
        this.streams.mainLocal.setAudioEnabled(!held && !this._muted);
        this.streams.mainRemote.setAudioEnabled(!held);
        this.updateAudioDirectionWithoutNegotiation();
    }
    stop() {
        var _a, _b;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.stop');
        this.endDataChannel();
        this.stopped = true;
        // Stop only the remote stream; the track of the local stream may still be in use by another call so it's up to the session to stop it.
        this.streams.stopRemoteStreams();
        // The screen share local stream is safe to stop here, as currently it shouldn't be used by any other call
        (_b = this.screenVideoTrack) === null || _b === void 0 ? void 0 : _b.stop();
        this.unregisterPeerEvents();
        this.peer.close();
    }
    createAnswer() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.createAnswer');
            if (this.stopped) {
                throw new Error('WebRTC Processor has already been stopped.');
            }
            if (!this.inputTrack) {
                throw new Error('no-input-track');
            }
            yield this.initialization;
            const transceivers = this.getTransceivers('audio');
            if (!transceivers.length) {
                throw new Error('no-audio-transceiver');
            }
            return this.peer.createAnswer();
        });
    }
    setLocalDescription(sdp) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.setLocalDescription');
            if (this.stopped) {
                return;
            }
            yield this.initialization;
            if (!['offer', 'answer'].includes(sdp.type)) {
                throw new Error('unsupported-description-type');
            }
            yield this.peer.setLocalDescription(sdp);
            if (sdp.type === 'answer') {
                this.processPostNegotiation();
            }
        });
    }
    setRemoteDescription(sdp) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.setRemoteDescription');
            if (this.stopped) {
                return;
            }
            yield this.initialization;
            if (!['offer', 'answer'].includes(sdp.type)) {
                throw new Error('unsupported-description-type');
            }
            if (sdp.type === 'offer') {
                this.processPreNegotiation();
            }
            yield this.peer.setRemoteDescription(sdp);
            if (sdp.type === 'answer') {
                this.processPostNegotiation();
            }
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
            case 'remoteMute':
                return this._remoteMute;
            case 'remoteHeld':
                return this._remoteHeld;
        }
    }
    getStats(selector) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.stopped) {
                return null;
            }
            yield this.initialization;
            return this.peer.getStats(selector);
        });
    }
    isRemoteHeld() {
        return this._remoteHeld;
    }
    isRemoteMute() {
        return this._remoteMute;
    }
    isStable() {
        if (this.stopped) {
            return false;
        }
        return this.peer.signalingState === 'stable';
    }
    getLocalDescription() {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.getLocalDescription');
        if (this.stopped) {
            throw new Error('WebRTC Processor has already been stopped.');
        }
        return this.peer.localDescription;
    }
    waitForIceGathering() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (this.stopped) {
                return;
            }
            if (this.peer.iceGatheringState === 'complete') {
                // If the peer state is 'complete', wait long enough for a macrotask to complete to ensure this state is not outdated
                yield new Promise((resolve) => {
                    setTimeout(resolve, 1);
                });
                if (this.stopped || this.peer.iceGatheringState === 'complete') {
                    return;
                }
            }
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.waitForIceGathering');
            yield this.initialization;
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
        });
    }
    setRemoteIds(streams) {
        this.streams.setRemoteIds(streams);
    }
    getLocalStreamIds() {
        return this.streams.getLocalStreamIds();
    }
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.inputTrack) {
                yield this.loadInputTrack();
            }
            if (this.screenVideoTrack) {
                yield this.loadScreenVideoTrack();
            }
        });
    }
    startNewGathering() {
        this.clearIceGatheringWaiters(new Error('gathering-restarted'));
        this.iceCandidateCount = 0;
    }
    changeInternalState(stateName) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.changeInternalState', stateName);
        this.emitter.emit('internalStateChange', stateName);
    }
    updateAudioDirectionBeforeNegotiation() {
        // Before the negotiation, we set the direction based on our own state only
        // We'll tell the SDK that we want to send audio and, depending on the "on hold" state, also receive it
        const desiredDirection = this.held ? 'sendonly' : 'sendrecv';
        this.updateDirectionBeforeNegotiation('audio', desiredDirection);
    }
    updateAudioDirectionAfterNegotiation() {
        // Before the negotiation started, we told the browser we wanted to send audio - but we don't care if actually send or not, it's up to the other side to determine if they want to receive.
        // If the other side doesn't want to receive audio, the negotiation will result in a state where "direction" and "currentDirection" don't match
        // But if the only difference is that we said we want to send audio and are not sending it, then we can change what we say we want to reflect the current state
        // If we didn't do this, everything would still work, but the browser would trigger redundant renegotiations whenever the directions mismatch
        const desiredDirection = this.held ? 'sendonly' : 'sendrecv';
        const acceptableDirection = this.held ? 'inactive' : 'recvonly';
        this.updateDirectionAfterNegotiation('audio', desiredDirection, acceptableDirection);
    }
    updateVideoDirectionBeforeNegotiation() {
        const desiredDirection = this.screenVideoTrack ? 'sendrecv' : 'recvonly';
        this.updateDirectionBeforeNegotiation('video', desiredDirection);
    }
    updateVideoDirectionAfterNegotiation() {
        const desiredDirection = this.screenVideoTrack ? 'sendrecv' : 'recvonly';
        const acceptableDirection = this.screenVideoTrack ? 'sendonly' : 'inactive';
        this.updateDirectionAfterNegotiation('video', desiredDirection, acceptableDirection);
    }
    updateDirectionBeforeNegotiation(kind, desiredDirection) {
        var _a;
        const transceivers = this.getTransceivers(kind);
        for (const transceiver of transceivers) {
            if (transceiver.direction === 'stopped') {
                continue;
            }
            if (transceiver.direction !== desiredDirection) {
                (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug(`Changing ${kind} direction from ${transceiver.direction} to ${desiredDirection}`);
            }
            transceiver.direction = desiredDirection;
        }
    }
    updateDirectionAfterNegotiation(kind, desiredDirection, acceptableDirection) {
        var _a;
        const transceivers = this.getTransceivers(kind);
        for (const transceiver of transceivers) {
            if (transceiver.direction !== desiredDirection) {
                continue;
            }
            if (!transceiver.currentDirection || ['stopped', desiredDirection].includes(transceiver.currentDirection)) {
                continue;
            }
            if (transceiver.currentDirection === acceptableDirection) {
                (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug(`Changing ${kind} direction from ${transceiver.direction} to match ${transceiver.currentDirection}.`);
                transceiver.direction = transceiver.currentDirection;
            }
        }
    }
    requestDirection(kind, desiredDirection, acceptableDirection) {
        var _a;
        if (!this.canRenegotiate()) {
            return;
        }
        const transceivers = this.getTransceivers(kind);
        for (const transceiver of transceivers) {
            if ([desiredDirection, acceptableDirection, 'stopped'].includes(transceiver.direction)) {
                continue;
            }
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug(`Requesting new ${kind} direction: ${desiredDirection}.`);
            transceiver.direction = desiredDirection;
        }
    }
    updateDirectionForVideoTrackChanged() {
        const desiredDirection = this.screenVideoTrack ? 'sendrecv' : 'recvonly';
        const acceptableDirection = this.screenVideoTrack ? 'sendonly' : 'inactive';
        this.requestDirection('video', desiredDirection, acceptableDirection);
    }
    getTransceivers(kind) {
        return this.peer
            .getTransceivers()
            .filter((transceiver) => { var _a, _b; return ((_a = transceiver.sender.track) === null || _a === void 0 ? void 0 : _a.kind) === kind || ((_b = transceiver.receiver.track) === null || _b === void 0 ? void 0 : _b.kind) === kind; });
    }
    updateAudioDirectionWithoutNegotiation() {
        var _a;
        // If the signaling state is not stable, then a negotiation is already happening and the audio direction will be updated by them
        if (this.peer.signalingState !== 'stable') {
            return;
        }
        const desiredDirection = this.held ? 'sendonly' : 'sendrecv';
        const acceptableDirection = this.held ? 'inactive' : 'recvonly';
        const transceivers = this.getTransceivers('audio');
        for (const transceiver of transceivers) {
            // If the last direction we requested still matches our current requirements, then we don't need to change our request
            if ([desiredDirection, acceptableDirection, 'stopped'].includes(transceiver.direction)) {
                continue;
            }
            // If the current state of the call doesn't match what we are requesting here, the browser will trigger the negotiation-needed event for us
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug(`Changing desired audio direction from ${transceiver.direction} to ${desiredDirection}.`);
            transceiver.direction = desiredDirection;
        }
    }
    createDataChannel() {
        var _a;
        if (this._dataChannel || this._dataChannelEnded || !this.config.call.hasFlag('create-data-channel')) {
            return;
        }
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.createDataChannel');
        const channel = this.peer.createDataChannel(DATA_CHANNEL_LABEL);
        this.initializeDataChannel(channel);
    }
    endDataChannel() {
        this._dataChannelEnded = true;
        this.sendP2PCommand('end');
    }
    initializeDataChannel(channel) {
        var _a;
        if (channel.label !== DATA_CHANNEL_LABEL) {
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.warn('Unexpected Data Channel', channel.label);
            return;
        }
        channel.onopen = (_event) => {
            var _a, _b;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('Data Channel Open', channel.label);
            if (((_b = this._dataChannel) === null || _b === void 0 ? void 0 : _b.readyState) !== 'open') {
                this._dataChannel = channel;
            }
            this.updateMuteForRemote();
        };
        channel.onclose = (_event) => {
            var _a;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('Data Channel Closed', channel.label);
            if (this._dataChannel === channel) {
                this._dataChannel = null;
                if (this.config.call.state !== 'hangup') {
                    this.createDataChannel();
                }
            }
        };
        channel.onmessage = (event) => {
            var _a, _b;
            if (typeof event.data !== 'string') {
                (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('Invalid Data Channel Message');
                return;
            }
            (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.debug('Data Channel Message', event.data);
            const command = this.getCommandFromDataChannelMessage(event.data);
            if (command) {
                this.onP2PCommand(command);
            }
        };
        if (!this._dataChannel) {
            this._dataChannel = channel;
        }
    }
    sendP2PCommand(command) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.sendP2PCommand', command);
        if (!this._dataChannel) {
            return false;
        }
        if (this._dataChannel.readyState !== 'open') {
            return false;
        }
        const jsonCommand = JSON.stringify({ command });
        this._dataChannel.send(jsonCommand);
        return true;
    }
    isValidCommand(command) {
        return ['mute', 'unmute', 'end'].includes(command);
    }
    getCommandFromDataChannelMessage(message) {
        var _a;
        try {
            const obj = JSON.parse(message);
            if (obj.command && this.isValidCommand(obj.command)) {
                return obj.command;
            }
        }
        catch (_b) {
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('Failed to parse Data Channel Command');
        }
        return null;
    }
    onP2PCommand(command) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.onP2PCommand', command);
        switch (command) {
            case 'mute':
                this.setRemoteMute(true);
                break;
            case 'unmute':
                this.setRemoteMute(false);
                break;
            case 'end':
                this._dataChannelEnded = true;
                break;
        }
    }
    setRemoteMute(muted) {
        if (muted === this._remoteMute) {
            return;
        }
        this._remoteMute = muted;
        this.emitter.emit('internalStateChange', 'remoteMute');
    }
    setRemoteHeld(held) {
        var _a;
        if (held === this._remoteHeld) {
            return;
        }
        this._remoteHeld = held;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.setRemoteHeld', held);
        this.emitter.emit('internalStateChange', 'remoteHeld');
    }
    updateMuteForRemote() {
        const command = this._muted ? 'mute' : 'unmute';
        this.sendP2PCommand(command);
    }
    processPreNegotiation() {
        this.updateAudioDirectionBeforeNegotiation();
        this.updateVideoDirectionBeforeNegotiation();
    }
    processPostNegotiation() {
        this.updateAudioDirectionAfterNegotiation();
        this.updateVideoDirectionAfterNegotiation();
        this.updateRemoteHeld();
        this.updateRemoteScreenShare();
    }
    updateRemoteHeld() {
        if (!this.isActiveConnection()) {
            return;
        }
        let anyTransceiverNotSending = false;
        const transceivers = this.getTransceivers('audio');
        for (const transceiver of transceivers) {
            if (!transceiver.currentDirection || transceiver.currentDirection === 'stopped') {
                continue;
            }
            if (transceiver.currentDirection.includes('send')) {
                this.setRemoteHeld(false);
                return;
            }
            anyTransceiverNotSending = true;
        }
        this.setRemoteHeld(anyTransceiverNotSending);
    }
    updateRemoteScreenShare() {
        var _a, _b;
        if (!this.isActiveConnection()) {
            return;
        }
        const transceivers = this.getTransceivers('video');
        for (const transceiver of transceivers) {
            if (!transceiver.currentDirection || transceiver.currentDirection === 'stopped') {
                continue;
            }
            if (transceiver.currentDirection.includes('recv')) {
                (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug(`Video Transceiver is receiving; enabling screen-share`);
                this.streams.screenShareRemote.setActive(true);
                return;
            }
        }
        if (this.streams.screenShareRemote.active) {
            (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.debug(`No video Transceiver is receiving, disabling screen-share`);
            this.streams.screenShareRemote.setActive(false);
        }
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
        peer.ondatachannel = (event) => this.onDataChannel(event);
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
            peer.ondatachannel = null;
        }
        catch (_a) {
            // suppress exceptions here
        }
    }
    restartIce() {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.restartIce');
        this.startNewGathering();
        this.peer.restartIce();
    }
    canRenegotiate() {
        return !this.stopped && this.peer.signalingState === 'stable';
    }
    isActiveConnection() {
        return !this.stopped && !['new', 'closed', 'failed'].includes(this.peer.connectionState);
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
        this.emitter.emit('internalError', { critical: false, error: 'ice-candidate-error', errorDetails: JSON.stringify(event) });
    }
    onNegotiationNeeded() {
        var _a;
        if (!this.canRenegotiate()) {
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
        this.streams.addRemoteTrack(event.track, event.streams);
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
        const state = this.peer.iceGatheringState;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.onIceGatheringStateChange', state);
        if (state === 'gathering') {
            this.iceCandidateCount = 0;
        }
        if (state === 'complete') {
            this.onIceGatheringComplete();
        }
        this.changeInternalState('iceGathering');
    }
    loadInputTrack() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.loadInputTrack');
            yield this.streams.mainLocal.setTrack('audio', this.inputTrack);
        });
    }
    loadScreenVideoTrack() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.loadScreenVideoTrack');
            yield this.streams.screenShareLocal.setTrack('video', this.screenVideoTrack);
            this.streams.screenShareLocal.setActive(Boolean(this.screenVideoTrack));
            this.updateDirectionForVideoTrackChanged();
        });
    }
    onIceGatheringComplete() {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.onIceGatheringComplete');
        this.clearIceGatheringWaiters();
    }
    onDataChannel(event) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaCallWebRTCProcessor.onDataChannel');
        this.initializeDataChannel(event.channel);
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