var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
import { Emitter } from '@rocket.chat/emitter';
import { ClientMediaCall } from './Call';
import { MediaSignalTransportWrapper } from './TransportWrapper';
const STATE_REPORT_INTERVAL = 60000;
export class MediaSignalingSession extends Emitter {
    get sessionId() {
        return this._sessionId;
    }
    get userId() {
        return this._userId;
    }
    constructor(config) {
        super();
        this.config = config;
        this.lastRegisterTimestamp = null;
        this._userId = config.userId;
        this._sessionId = config.randomStringFactory();
        this.recurringStateReportHandler = null;
        this.knownCalls = new Map();
        this.ignoredCalls = new Set();
        this.inputTrack = null;
        this.updatingInputTrack = false;
        this.deviceId = null;
        this.currentDeviceId = null;
        this.callsToGetUserMedia = 0;
        this.lastState = { hasCall: false, hasVisibleCall: false, hasBusyCall: false };
        this.transporter = new MediaSignalTransportWrapper(this._sessionId, config.transport, config.logger);
        this.register();
        this.enableStateReport(STATE_REPORT_INTERVAL);
    }
    isBusy() {
        var _a, _b;
        return (_b = (_a = this.getMainCall()) === null || _a === void 0 ? void 0 : _a.busy) !== null && _b !== void 0 ? _b : false;
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
        this.disableStateReport();
        // best‑effort: stop capturing audio
        void this.setInputTrack(null).catch(() => undefined);
        for (const call of this.knownCalls.values()) {
            this.ignoredCalls.add(call.callId);
            call.ignore();
        }
        this.knownCalls.clear();
    }
    getCallData(callId) {
        return this.knownCalls.get(callId) || null;
    }
    getMainCall() {
        let ringingCall = null;
        let pendingCall = null;
        for (const call of this.knownCalls.values()) {
            if (call.state === 'hangup' || call.ignored) {
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
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.processSignal', signal);
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
    setDeviceId(deviceId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            this.deviceId = deviceId;
            // do nothing if:
            // 1. doesn't have any input track yet
            // 2. it's the same device id
            // 3. has no restriction on which device to use
            if (!this.inputTrack || deviceId === this.currentDeviceId || !deviceId) {
                return;
            }
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.setDeviceId');
            yield this.setInputTrack(null);
            yield this.startInputTrack();
        });
    }
    startCall(calleeType_1, calleeId_1) {
        return __awaiter(this, arguments, void 0, function* (calleeType, calleeId, params = {}) {
            var _a;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.startCall', calleeId);
            const { contactInfo } = params;
            const callId = this.createTemporaryCallId();
            const call = this.createCall(callId);
            yield call.requestCall({ type: calleeType, id: calleeId }, contactInfo);
        });
    }
    register() {
        this.lastRegisterTimestamp = new Date();
        this.transporter.sendSignal(Object.assign({ type: 'register', contractId: this._sessionId }, (this.config.oldSessionId && { oldContractId: this.config.oldSessionId })));
    }
    setIceGatheringTimeout(newTimeout) {
        this.config.iceGatheringTimeout = newTimeout;
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
        this.register();
    }
    setInputTrack(newInputTrack) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_1, _b, _c;
            var _d, _e;
            (_d = this.config.logger) === null || _d === void 0 ? void 0 : _d.debug('MediaSignalingSession.setInputTrack', Boolean(newInputTrack));
            const { inputTrack: oldInputTrack } = this;
            if (newInputTrack === oldInputTrack) {
                return;
            }
            this.inputTrack = newInputTrack;
            try {
                for (var _f = true, _g = __asyncValues(this.knownCalls.values()), _h; _h = yield _g.next(), _a = _h.done, !_a; _f = true) {
                    _c = _h.value;
                    _f = false;
                    const call = _c;
                    yield call.setInputTrack(newInputTrack).catch((error) => {
                        if (newInputTrack) {
                            throw error;
                        }
                    });
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_f && !_a && (_b = _g.return)) yield _b.call(_g);
                }
                finally { if (e_1) throw e_1.error; }
            }
            if (oldInputTrack) {
                (_e = this.config.logger) === null || _e === void 0 ? void 0 : _e.debug('MediaSignalingSession.setInputTrack.stopOldTrack');
                try {
                    oldInputTrack.stop();
                }
                catch (_j) {
                    //
                }
            }
        });
    }
    requestInputTrackUpdate() {
        if (this.updatingInputTrack || this.callsToGetUserMedia > 0) {
            return;
        }
        this.updateInputTrack().catch(() => null);
    }
    updateInputTrack() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.updatingInputTrack', this.callsToGetUserMedia);
            this.updatingInputTrack = true;
            try {
                if (this.inputTrack) {
                    yield this.maybeStopInputTrack();
                    return;
                }
                yield this.maybeStartInputTrack();
            }
            finally {
                this.updatingInputTrack = false;
                (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.debug('MediaSignalingSession.updatingInputTrack.finally', this.callsToGetUserMedia);
            }
        });
    }
    maybeStartInputTrack() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.maybeStartInputTrack');
            for (const call of this.knownCalls.values()) {
                if (!call.needsInputTrack()) {
                    continue;
                }
                return this.startInputTrack();
            }
        });
    }
    getAudioConstraints() {
        if (this.deviceId) {
            return { deviceId: this.deviceId };
        }
        return true;
    }
    startInputTrack() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.startInputTrack', this.callsToGetUserMedia);
            this.currentDeviceId = this.deviceId;
            let userMedia = null;
            this.callsToGetUserMedia++;
            try {
                userMedia = yield this.config.mediaStreamFactory({ audio: this.getAudioConstraints() }).catch(() => null);
            }
            finally {
                this.callsToGetUserMedia--;
            }
            (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.debug('MediaSignalingSession.startInputTrack.done', this.callsToGetUserMedia);
            // If there's multiple simultaneous attempts to get the track, only process the output of the last one
            if (this.callsToGetUserMedia > 0) {
                return;
            }
            if (!userMedia) {
                return this.hangupCallsThatNeedInput();
            }
            const tracks = userMedia.getAudioTracks();
            if (!tracks.length) {
                return this.hangupCallsThatNeedInput();
            }
            return this.setInputTrack(tracks[0]);
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
                call.hangup('service-error');
            }
            catch (_b) {
                //
            }
        }
    }
    maybeStopInputTrack() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.maybeStopInputTrack');
            for (const call of this.knownCalls.values()) {
                if (call.mayNeedInputTrack()) {
                    return;
                }
            }
            yield this.setInputTrack(null);
        });
    }
    createCall(callId) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalingSession.createCall');
        const config = {
            logger: this.config.logger,
            transporter: this.transporter,
            processorFactories: this.config.processorFactories,
            iceGatheringTimeout: this.config.iceGatheringTimeout || 1000,
            sessionId: this._sessionId,
        };
        const call = new ClientMediaCall(config, callId, { inputTrack: this.inputTrack });
        this.knownCalls.set(callId, call);
        call.emitter.on('contactUpdate', () => this.onCallContactUpdate(call));
        call.emitter.on('stateChange', () => this.onCallStateChange(call));
        call.emitter.on('clientStateChange', () => this.onCallClientStateChange(call));
        call.emitter.on('trackStateChange', () => this.onTrackStateChange(call));
        call.emitter.on('initialized', () => this.onNewCall(call));
        call.emitter.on('accepted', () => this.onAcceptedCall(call));
        call.emitter.on('accepting', () => this.onAcceptingCall(call));
        call.emitter.on('hidden', () => this.onHiddenCall(call));
        call.emitter.on('active', () => this.onActiveCall(call));
        call.emitter.on('ended', () => this.onEndedCall(call));
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
    onSessionStateChange() {
        const mainCall = this.getMainCall();
        const hasCall = Boolean(mainCall);
        const hasVisibleCall = Boolean(mainCall && !mainCall.hidden);
        const hasBusyCall = Boolean(hasVisibleCall && (mainCall === null || mainCall === void 0 ? void 0 : mainCall.busy));
        const hadCall = this.lastState.hasCall;
        const hadVisibleCall = this.lastState.hasVisibleCall;
        const hadBusyCall = this.lastState.hasBusyCall;
        this.lastState = { hasCall, hasVisibleCall, hasBusyCall };
        if (mainCall && !hadCall) {
            this.emit('newCall', { call: mainCall });
        }
        if (mainCall && hasBusyCall && !hadBusyCall) {
            this.emit('acceptedCall', { call: mainCall });
        }
        this.emit('sessionStateChange');
        this.requestInputTrackUpdate();
        if (hadCall && !hasCall) {
            this.emit('endedCall');
        }
        else if (hadVisibleCall && !hasVisibleCall) {
            this.emit('hiddenCall');
        }
    }
}
//# sourceMappingURL=Session.js.map