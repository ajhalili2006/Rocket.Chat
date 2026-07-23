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
import { ClientMediaCall } from './Call';
import { MediaSignalTransportWrapper } from './TransportWrapper';
import { SessionRegistration } from './components/SessionRegistration';
import { isSameDeviceId } from './utils/isSameDeviceId';
const STATE_REPORT_INTERVAL = 60000;
export class MediaSignalingSession extends Emitter {
    get sessionId() {
        return this._sessionId;
    }
    get userId() {
        return this._userId;
    }
    get registered() {
        return this.registration.registered;
    }
    // FIXME: This state is controlled outside of this class. MediaSignalingSession should handle this fallback in another way so this information doesn't depend on the consumer
    // FIXME: Consumers can still unmute the call even when this is set to true. That behaviour should be guarded at the call level to avoid representing incorrect states.
    /* micless: used by the consumer to identify when a "fake stream" was used due to inability to retrieve a proper device. When set to true will mute the call once when it starts */
    set micless(micless) {
        if (micless) {
            this.shouldMuteMiclessCall = true;
        }
        else {
            this.shouldMuteMiclessCall = false;
        }
        this._micless = micless;
    }
    get micless() {
        return this._micless;
    }
    constructor(config) {
        super();
        this.config = config;
        this.lastRegisterTimestamp = null;
        this.sessionEnded = false;
        this._micless = false;
        this.shouldMuteMiclessCall = false;
        this._userId = config.userId;
        this._sessionId = config.mobileDeviceId || config.randomStringFactory();
        this.recurringStateReportHandler = null;
        this.knownCalls = new Map();
        this.ignoredCalls = new Set();
        this.inputTrack = null;
        this.switchingInputTrack = false;
        this.deviceId = null;
        this.currentDeviceId = null;
        this.callsToGetUserMedia = 0;
        this.lastState = { hasCall: false, hasVisibleCall: false, hasBusyCall: false };
        this.transporter = new MediaSignalTransportWrapper(this._sessionId, config.transport, config.logger);
        this.registration = new SessionRegistration({
            logger: config.logger,
            registerFn: () => this.sendRegisterSignal(),
        });
        this.registration.register();
        this.enableStateReport(STATE_REPORT_INTERVAL);
    }
    isBusy() {
        var _a, _b;
        return (_b = (_a = this.getMainCall(false)) === null || _a === void 0 ? void 0 : _a.busy) !== null && _b !== void 0 ? _b : false;
    }
    enableStateReport(interval) {
        this.disableStateReport();
        this.recurringStateReportHandler = setInterval(() => {
            this.reportState();
        }, interval);
    }
    disableStateReport() {
        if (this.recurringStateReportHandler) {
            clearInterval(this.recurringStateReportHandler);
            this.recurringStateReportHandler = null;
        }
    }
    endSession() {
        this.sessionEnded = true;
        this.registration.endSession();
        this.disableStateReport();
        // best‑effort: stop capturing audio
        void this.setInputTrack(null).catch(() => undefined);
        for (const call of this.knownCalls.values()) {
            this.ignoredCalls.add(call.callId);
            void this.setScreenVideoTrack(null, call).catch(() => undefined);
            call.ignore();
        }
        this.knownCalls.clear();
        this.emit('sessionStateChange');
    }
    getCallData(callId) {
        return this.knownCalls.get(callId) || null;
    }
    getState(skipLocal = false) {
        const call = this.getMainCall(skipLocal);
        if (!call) {
            return null;
        }
        const state = call.callStateData;
        return Object.assign(Object.assign({}, state), { call });
    }
    getMainCall(skipLocal = false) {
        let ringingCall = null;
        let pendingCall = null;
        for (const call of this.knownCalls.values()) {
            if (call.state === 'hangup' || call.ignored || !call.initialized) {
                continue;
            }
            if (skipLocal && !call.confirmed) {
                continue;
            }
            if (call.busy) {
                return call;
            }
            if (call.state === 'ringing' && !ringingCall) {
                ringingCall = call;
                continue;
            }
            if (call.state === 'none' && !pendingCall) {
                pendingCall = call;
                continue;
            }
        }
        return ringingCall || pendingCall;
    }
    processSignal(signal) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (this.sessionEnded) {
                return;
            }
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.processSignal', signal);
            if ('callId' in signal) {
                return this.processCallSignal(signal);
            }
            return this.processSessionSignal(signal);
        });
    }
    processSessionSignal(signal) {
        switch (signal.type) {
            case 'registered':
                return this.confirmSessionRegistered(signal);
        }
    }
    processCallSignal(signal) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isCallIgnored(signal.callId)) {
                return;
            }
            const call = this.getOrCreateCallBySignal(signal);
            if (signal.type === 'notification' && signal.signedContractId) {
                if (signal.signedContractId === this._sessionId) {
                    call.setContractState('signed');
                }
                else if (signal.notification === 'accepted') {
                    // The server accepted a contract, but it wasn't ours - ignore the call in this session
                    call.setContractState('ignored');
                }
            }
            else if ('toContractId' in signal) {
                call.setContractState(signal.toContractId === this._sessionId ? 'signed' : 'ignored');
            }
            else if (signal.type === 'new' && signal.self.contractId) {
                call.setContractState(signal.self.contractId === this._sessionId ? 'signed' : 'ignored');
            }
            const oldCall = this.getReplacedCallBySignal(signal);
            yield call.processSignal(signal, oldCall);
        });
    }
    setDeviceId(deviceId, force) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            this.deviceId = deviceId;
            if (this.switchingInputTrack) {
                (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.warn('Audio Device was changed while the input track was being actively switched.');
            }
            // do nothing if:
            // 1. doesn't have any input track yet
            // 2. it's the same device id (force flag bypasses this)
            // 3. has no restriction on which device to use
            if (!this.inputTrack || !deviceId || (isSameDeviceId(deviceId, this.currentDeviceId) && !force)) {
                return;
            }
            (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.debug('MediaSignalingSession.setDeviceId');
            yield this.setInputTrack(null);
            yield this.startInputTrack();
        });
    }
    startCall(calleeType_1, calleeId_1) {
        return __awaiter(this, arguments, void 0, function* (calleeType, calleeId, params = {}) {
            var _a;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.startCall', calleeId);
            if (this.getMainCall(false)) {
                throw new Error(`Already on a call.`);
            }
            const { contactInfo } = params;
            const callId = this.createTemporaryCallId();
            const call = this.createCall(callId);
            yield call.requestCall({ type: calleeType, id: calleeId }, this.config.features, contactInfo);
        });
    }
    setIceGatheringTimeout(newTimeout) {
        this.config.iceGatheringTimeout = newTimeout;
    }
    setIceServers(iceServers) {
        this.config.iceServers = iceServers;
    }
    createTemporaryCallId() {
        return `${this._sessionId}-${this.config.randomStringFactory()}`;
    }
    isCallIgnored(callId) {
        return this.ignoredCalls.has(callId);
    }
    ignoreCall(callId) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.ignoreCall', callId);
        this.ignoredCalls.add(callId);
        if (this.knownCalls.has(callId)) {
            const call = this.knownCalls.get(callId);
            this.knownCalls.delete(callId);
            call === null || call === void 0 ? void 0 : call.ignore();
        }
    }
    sendRegisterSignal() {
        this.lastRegisterTimestamp = new Date();
        this.transporter.sendSignal(Object.assign({ type: 'register', contractId: this._sessionId, requestSignals: Boolean(this.config.autoSync) }, (this.config.oldSessionId && { oldContractId: this.config.oldSessionId })));
    }
    confirmSessionRegistered(signal) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.sessionRegistered', signal.calls);
        const wasRegistered = this.registered;
        this.registration.confirmRegistration();
        this.emit('registered', { activeCalls: signal.activeCalls });
        if (!wasRegistered) {
            this.onSessionStateChange();
        }
        if (!this.config.autoSync) {
            const missingCalls = signal.calls.filter((callId) => !this.knownCalls.has(callId) && !this.ignoredCalls.has(callId));
            if (missingCalls.length) {
                this.emit('outOfSync', { missingCalls });
            }
        }
    }
    getExistingCallBySignal(signal) {
        const existingCall = this.knownCalls.get(signal.callId);
        if (existingCall) {
            return existingCall;
        }
        if (signal.type === 'new' && signal.requestedCallId) {
            const localCall = this.knownCalls.get(signal.requestedCallId);
            if (localCall) {
                this.knownCalls.set(signal.callId, localCall);
                this.knownCalls.delete(signal.requestedCallId);
                return localCall;
            }
        }
        return null;
    }
    getReplacedCallBySignal(signal) {
        if ('replacingCallId' in signal && signal.replacingCallId) {
            return this.knownCalls.get(signal.replacingCallId) || null;
        }
        return null;
    }
    getOrCreateCallBySignal(signal) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.getOrCreateCallBySignal', signal);
        const existingCall = this.getExistingCallBySignal(signal);
        if (existingCall) {
            return existingCall;
        }
        return this.createCall(signal.callId);
    }
    reportState() {
        let reportedAny = false;
        let anyNotOver = false;
        for (const call of this.knownCalls.values()) {
            if (call.state !== 'hangup') {
                anyNotOver = true;
            }
            if (!call.isAbleToReportStates()) {
                continue;
            }
            reportedAny = true;
            call.reportStates();
        }
        if (reportedAny) {
            // If we're reporting a call's state, then ensure we'll register again once all calls over
            this.lastRegisterTimestamp = null;
            return;
        }
        // Even if we're not reporting any calls, if we know about one that isn't over, don't register
        if (anyNotOver) {
            return;
        }
        // By registering we're telling the server we have a clean session; if it's not supposed to be clean, it'll tell us
        this.autoRegister();
    }
    autoRegister() {
        if (this.lastRegisterTimestamp) {
            const diff = Date.now() - this.lastRegisterTimestamp.valueOf();
            if (diff < STATE_REPORT_INTERVAL * 10) {
                return;
            }
        }
        this.registration.reRegister();
    }
    setInputTrack(newInputTrack) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.setInputTrack', Boolean(newInputTrack));
            const { inputTrack: oldInputTrack } = this;
            if (newInputTrack === oldInputTrack) {
                return;
            }
            this.inputTrack = newInputTrack;
            for (const call of this.knownCalls.values()) {
                yield call.setInputTrack(newInputTrack).catch((error) => {
                    if (newInputTrack) {
                        throw error;
                    }
                });
            }
            if (oldInputTrack) {
                (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.debug('MediaSignalingSession.setInputTrack.stopOldTrack');
                try {
                    oldInputTrack.stop();
                }
                catch (_c) {
                    //
                }
            }
        });
    }
    requestInputTrackUpdate() {
        // Don't do anything if we don't need to switch the track now
        // This extra check here ensures that requestInputTrackUpdate can be called multiple times even though switchInputTrack can't
        if (!this.shouldSwitchInputTrack()) {
            return;
        }
        this.switchInputTrack().catch(() => null);
    }
    /**
     * Switch ON/OFF the use of an audio input track
     * If there's one already in use, remove it; Otherwise, request and use a new one.
     * This function assumes the current state needs to change and doesn't check anything before starting the switch process
     * Switching OFF is straightforward: the current track is removed and stopped
     * Switching ON is a multi-step process:
     * 1. We request a new track from the media stream factory
     * 2. Once the media stream factory returns a valid track, we double check that we still need it
     * 2.1. If the track is still needed, we set it to all active calls
     * 2.2. If the track is no longer needed by then, we stop it and keep no reference to it
     *
     * The track state only changes by the end of the whole process, so there's no point in calling this function twice and we guard against it --
     * but we don't guard against external changes to the track (for example, calling setDeviceId will also change the track state)
     * */
    switchInputTrack() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.switchInputTrack', this.callsToGetUserMedia);
            if (this.switchingInputTrack) {
                (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.warn('MediaSignalingSession.switchInputTrack', 'Input Track Switcher was called twice');
                return;
            }
            if (!this.shouldSwitchInputTrack()) {
                (_c = this.config.logger) === null || _c === void 0 ? void 0 : _c.warn('MediaSignalingSession.switchInputTrack', 'Input Track Switcher was called but is no longer needed');
                return;
            }
            this.switchingInputTrack = true;
            try {
                if (this.inputTrack) {
                    yield this.setInputTrack(null);
                    return;
                }
                yield this.startInputTrack();
            }
            finally {
                this.switchingInputTrack = false;
                (_d = this.config.logger) === null || _d === void 0 ? void 0 : _d.debug('MediaSignalingSession.switchInputTrack.finally', this.callsToGetUserMedia);
            }
        });
    }
    shouldStartInputTrack() {
        if (this.inputTrack) {
            return false;
        }
        if (this.callsToGetUserMedia > 0) {
            return false;
        }
        for (const call of this.knownCalls.values()) {
            if (call.needsInputTrack()) {
                return true;
            }
        }
        return false;
    }
    shouldSwitchInputTrack() {
        if (this.inputTrack) {
            return !this.mayNeedInputTrack();
        }
        return this.shouldStartInputTrack();
    }
    getAudioConstraints() {
        if (this.deviceId) {
            return { deviceId: this.deviceId };
        }
        return true;
    }
    startInputTrack() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.startInputTrack', this.callsToGetUserMedia);
            this.currentDeviceId = this.deviceId;
            let userMedia;
            this.callsToGetUserMedia++;
            try {
                userMedia = yield this.config.mediaStreamFactory({ audio: this.getAudioConstraints() }).catch(() => null);
            }
            finally {
                this.callsToGetUserMedia--;
            }
            // If there's multiple simultaneous attempts to get the track, only process the output of the last one
            if (this.callsToGetUserMedia > 0) {
                (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.debug('MediaSignalingSession.startInputTrack.skipped', this.callsToGetUserMedia);
                return;
            }
            (_c = this.config.logger) === null || _c === void 0 ? void 0 : _c.debug('MediaSignalingSession.startInputTrack.done', this.callsToGetUserMedia);
            if (!userMedia) {
                return this.hangupCallsThatNeedInput();
            }
            const tracks = userMedia.getAudioTracks();
            if (!tracks.length) {
                return this.hangupCallsThatNeedInput();
            }
            const inputTrack = tracks[0];
            // If we no longer have a call that can use this track, just release it
            if (inputTrack && !this.mayNeedInputTrack()) {
                try {
                    // Stop the track so the browser doesn't have to wait for GC to detect that the stream is not in use
                    inputTrack.stop();
                }
                catch (_d) {
                    // we don't care if this failed
                }
                return;
            }
            return this.setInputTrack(inputTrack);
        });
    }
    hangupCallsThatNeedInput() {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.hangupCallsThatNeedInput');
        for (const call of this.knownCalls.values()) {
            if (!call.needsInputTrack()) {
                continue;
            }
            try {
                call.hangup('input-error');
            }
            catch (_b) {
                //
            }
        }
    }
    mayNeedInputTrack() {
        for (const call of this.knownCalls.values()) {
            if (call.mayNeedInputTrack()) {
                return true;
            }
        }
        return false;
    }
    setScreenVideoTrack(newVideoTrack, call) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.setScreenVideoTrack', Boolean(newVideoTrack));
            yield call.setScreenVideoTrack(newVideoTrack);
        });
    }
    startScreenVideoTrack() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.startScreenVideoTrack');
            const displayMedia = yield this.config.displayMediaFactory({}).catch(() => null);
            (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.debug('MediaSignalingSession.startScreenVideoTrack.done');
            if (!displayMedia) {
                (_c = this.config.logger) === null || _c === void 0 ? void 0 : _c.error('MediaSignalingSession.startScreenVideoTrack.failed.noDisplayMedia');
                throw new Error('Failed to get display media');
            }
            const tracks = displayMedia.getVideoTracks();
            if (!tracks.length) {
                (_d = this.config.logger) === null || _d === void 0 ? void 0 : _d.error('MediaSignalingSession.startScreenVideoTrack.failed.noTracks');
                throw new Error('Failed to get video tracks');
            }
            return tracks[0];
        });
    }
    endScreenSharing(call) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.endScreenSharing');
            yield this.setScreenVideoTrack(null, call);
        });
    }
    startScreenSharing(call) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.startScreenSharing');
            const track = yield this.startScreenVideoTrack();
            if (!track) {
                return;
            }
            yield this.setScreenVideoTrack(track, call);
        });
    }
    createCall(callId) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.createCall');
        const config = {
            userId: this.config.userId,
            logger: this.config.logger,
            transporter: this.transporter,
            processorFactories: this.config.processorFactories,
            iceGatheringTimeout: this.config.iceGatheringTimeout || 5000,
            iceServers: this.config.iceServers || [],
            sessionId: this._sessionId,
            supportedFeatures: this.config.features,
        };
        const call = new ClientMediaCall(config, callId, { inputTrack: this.inputTrack });
        this.knownCalls.set(callId, call);
        call.emitter.on('contactUpdate', () => this.onCallContactUpdate(call));
        call.emitter.on('stateChange', () => this.onCallStateChange(call));
        call.emitter.on('clientStateChange', () => this.onCallClientStateChange(call));
        call.emitter.on('trackStateChange', () => this.onTrackStateChange(call));
        call.emitter.on('initialized', () => this.onNewCall(call));
        call.emitter.on('confirmed', () => this.onConfirmedCall(call));
        call.emitter.on('accepted', () => this.onAcceptedCall(call));
        call.emitter.on('accepting', () => this.onAcceptingCall(call));
        call.emitter.on('hidden', () => this.onHiddenCall(call));
        call.emitter.on('active', () => this.onActiveCall(call));
        call.emitter.on('ended', () => this.onEndedCall(call));
        call.emitter.on('screenShareRequestChange', (requested) => this.onScreenShareRequestChange(call, requested));
        call.emitter.on('streamChange', () => this.onSessionStateChange());
        return call;
    }
    onCallContactUpdate(_call) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.onCallContactUpdate');
        this.onSessionStateChange();
    }
    onCallStateChange(_call) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.onCallStateChange');
        this.onSessionStateChange();
    }
    onCallClientStateChange(_call) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.onCallClientStateChange');
        this.onSessionStateChange();
    }
    onNewCall(_call) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.onNewCall');
        this.onSessionStateChange();
    }
    onConfirmedCall(_call) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.onConfirmedCall');
        this.onSessionStateChange();
    }
    onAcceptedCall(_call) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.onAcceptedCall');
        this.onSessionStateChange();
    }
    onAcceptingCall(_call) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.onAcceptingCall');
        this.onSessionStateChange();
    }
    onTrackStateChange(_call) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.onTrackStateChange');
        this.onSessionStateChange();
    }
    onEndedCall(call) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.onEndedCall');
        this.ignoreCall(call.callId);
        this.onSessionStateChange();
    }
    onHiddenCall(_call) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.onHiddenCall');
        this.onSessionStateChange();
    }
    onActiveCall(_call) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.onActiveCall');
        this.onSessionStateChange();
    }
    onScreenShareRequestChange(call, requested) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.onScreenShareRequestChange');
            if (!requested) {
                yield this.endScreenSharing(call);
            }
            else {
                yield this.startScreenSharing(call);
            }
            this.onSessionStateChange();
        });
    }
    onSessionStateChange() {
        var _a;
        const hadCall = this.lastState.hasCall;
        const hadVisibleCall = this.lastState.hasVisibleCall;
        const hadBusyCall = this.lastState.hasBusyCall;
        if (!this.registration.active) {
            if (hadCall) {
                this.emit('endedCall');
            }
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('skipping session events on inactive session');
            return;
        }
        // Do not skip local calls if we transitioned from a different active call to it
        const mainCall = this.getMainCall(!hadCall);
        const hasCall = Boolean(mainCall);
        const hasVisibleCall = Boolean(mainCall && !mainCall.hidden);
        const hasBusyCall = Boolean(hasVisibleCall && (mainCall === null || mainCall === void 0 ? void 0 : mainCall.busy));
        this.lastState = { hasCall, hasVisibleCall, hasBusyCall };
        if (mainCall && !hadCall) {
            this.emit('newCall', { call: mainCall });
        }
        if (mainCall && hasBusyCall && !hadBusyCall) {
            this.emit('acceptedCall', { call: mainCall });
        }
        this.emit('sessionStateChange');
        this.requestInputTrackUpdate();
        if (mainCall && this.shouldMuteMiclessCall) {
            this.shouldMuteMiclessCall = false;
            if (!mainCall.muted) {
                mainCall.setMuted(true);
            }
        }
        if (hadCall && !hasCall) {
            this.emit('endedCall');
        }
        else if (hadVisibleCall && !hasVisibleCall) {
            this.emit('hiddenCall');
        }
    }
}
//# sourceMappingURL=Session.js.map