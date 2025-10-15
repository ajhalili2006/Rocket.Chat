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
import { isPendingState } from './services/states';
const TIMEOUT_TO_ACCEPT = 30000;
const TIMEOUT_TO_CONFIRM_ACCEPTANCE = 2000;
const TIMEOUT_TO_PROGRESS_SIGNALING = 10000;
const STATE_REPORT_DELAY = 300;
const CALLS_WITH_NO_REMOTE_DATA_REPORT_DELAY = 5000;
// if the server tells us we're the caller in a call we don't recognize, ignore it completely
const AUTO_IGNORE_UNKNOWN_OUTBOUND_CALLS = true;
export class ClientMediaCall {
    get callId() {
        var _a;
        return (_a = this.remoteCallId) !== null && _a !== void 0 ? _a : this.localCallId;
    }
    get role() {
        return this._role;
    }
    get state() {
        return this._state;
    }
    get ignored() {
        return this._ignored;
    }
    get contact() {
        return this._contact || {};
    }
    get transferredBy() {
        return this._transferredBy;
    }
    get service() {
        return this._service;
    }
    get signed() {
        return ['signed', 'pre-signed', 'self-signed'].includes(this.contractState);
    }
    get hidden() {
        return this.ignored || this.contractState === 'ignored';
    }
    get muted() {
        if (!this.webrtcProcessor) {
            return false;
        }
        return this.webrtcProcessor.muted;
    }
    /** indicates if the call is on hold */
    get held() {
        if (!this.webrtcProcessor) {
            return false;
        }
        return this.webrtcProcessor.held;
    }
    /** indicates the call is past the "dialing" stage and not yet over */
    get busy() {
        return !this.isPendingAcceptance() && !this.isOver();
    }
    get audioLevel() {
        var _a;
        return ((_a = this.webrtcProcessor) === null || _a === void 0 ? void 0 : _a.audioLevel) || 0;
    }
    get localAudioLevel() {
        var _a;
        return ((_a = this.webrtcProcessor) === null || _a === void 0 ? void 0 : _a.localAudioLevel) || 0;
    }
    constructor(config, callId, { inputTrack } = {}) {
        this.config = config;
        this.webrtcProcessor = null;
        this.emitter = new Emitter();
        this.config.transporter = config.transporter;
        this.localCallId = callId;
        this.remoteCallId = null;
        this.acceptedLocally = false;
        this.endedLocally = false;
        this.hasRemoteData = false;
        this.initialized = false;
        this.acknowledged = false;
        this.contractState = 'proposed';
        this.hasLocalDescription = false;
        this.hasRemoteDescription = false;
        this.serviceStates = new Map();
        this.stateReporterTimeoutHandler = null;
        this.mayReportStates = true;
        this.inputTrack = inputTrack || null;
        this.creationTimestamp = new Date();
        this.pendingAnswerRequest = null;
        this.currentNegotiationId = null;
        this.earlySignals = new Set();
        this.stateTimeoutHandlers = new Set();
        this._role = 'callee';
        this._state = 'none';
        this.oldClientState = 'none';
        this._ignored = false;
        this._contact = null;
        this._transferredBy = null;
        this._service = null;
    }
    /**
     * Initialize an outbound call with basic contact information until we receive the full call details from the server;
     * this gets executed once for outbound calls initiated in this session.
     */
    initializeOutboundCall(contact) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (this.acceptedLocally) {
                return;
            }
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.initializeOutboundCall');
            const wasInitialized = this.initialized;
            this.initialized = true;
            this.acceptedLocally = true;
            if (this.hasRemoteData) {
                this.changeContact(contact, { prioritizeExisting: true });
            }
            else {
                this._role = 'caller';
                this._contact = contact;
            }
            this.addStateTimeout('pending', TIMEOUT_TO_ACCEPT);
            if (!wasInitialized) {
                this.emitter.emit('initialized');
            }
        });
    }
    /** Initialize an outbound call with the callee information and send a call request to the server */
    requestCall(callee, contactInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (this.initialized) {
                return;
            }
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.requestCall', callee);
            this.config.transporter.sendToServer(this.callId, 'request-call', {
                callee,
                supportedServices: Object.keys(this.config.processorFactories),
            });
            return this.initializeOutboundCall(Object.assign(Object.assign({}, contactInfo), callee));
        });
    }
    /** initialize a call with the data received from the server on a 'new' signal; this gets executed once for every call */
    initializeRemoteCall(signal, oldCall) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (this.hasRemoteData) {
                return;
            }
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.initializeRemoteCall', signal);
            this.remoteCallId = signal.callId;
            const wasInitialized = this.initialized;
            this.initialized = true;
            this.hasRemoteData = true;
            this._service = signal.service;
            this._role = signal.role;
            this._transferredBy = signal.transferredBy || null;
            this.changeContact(signal.contact);
            if (this._role === 'caller' && !this.acceptedLocally) {
                if (oldCall) {
                    this.acceptedLocally = true;
                }
                else if (AUTO_IGNORE_UNKNOWN_OUTBOUND_CALLS) {
                    (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.log('Ignoring Unknown Outbound Call');
                    this.ignore();
                }
            }
            // If it's flagged as ignored even before the initialization, tell the server we're unavailable
            if (this.ignored) {
                return this.rejectAsUnavailable();
            }
            if (this._service === 'webrtc') {
                try {
                    this.prepareWebRtcProcessor();
                }
                catch (e) {
                    yield this.rejectAsUnavailable();
                    throw e;
                }
            }
            // Send an ACK so the server knows that this session exists and is reachable
            this.acknowledge();
            if (this._role === 'callee' || !this.acceptedLocally) {
                this.addStateTimeout('pending', TIMEOUT_TO_ACCEPT);
            }
            // If the call was requested by this specific session, assume we're signed already.
            if (this._role === 'caller' &&
                this.acceptedLocally &&
                this.contractState !== 'ignored' &&
                (signal.requestedCallId === this.localCallId || Boolean(oldCall))) {
                this.contractState = 'pre-signed';
            }
            if (!wasInitialized) {
                this.emitter.emit('initialized');
            }
            yield this.processEarlySignals();
        });
    }
    mayNeedInputTrack() {
        if (this.isOver() || this._ignored || this.hidden) {
            return false;
        }
        return true;
    }
    needsInputTrack() {
        if (!this.mayNeedInputTrack()) {
            return false;
        }
        if (this.role === 'caller') {
            return this.hasRemoteData;
        }
        return this.busy;
    }
    hasInputTrack() {
        return Boolean(this.inputTrack);
    }
    isMissingInputTrack() {
        return !this.hasInputTrack() && this.mayNeedInputTrack();
    }
    getClientState() {
        if (this.isOver()) {
            return 'hangup';
        }
        if (this.hidden) {
            return 'busy-elsewhere';
        }
        switch (this._state) {
            case 'none':
            case 'ringing':
                if (this.hasRemoteData && this._role === 'callee' && this.acceptedLocally) {
                    return 'accepting';
                }
                return 'pending';
            case 'accepted':
                if (this.hasLocalDescription && this.hasRemoteDescription) {
                    return 'has-answer';
                }
                if (this.hasLocalDescription !== this.hasRemoteDescription) {
                    return 'has-offer';
                }
                return 'accepted';
            case 'renegotiating':
                if (this.hasLocalDescription && this.hasRemoteDescription) {
                    return 'has-new-answer';
                }
                if (this.hasLocalDescription !== this.hasRemoteDescription) {
                    return 'has-new-offer';
                }
                return 'renegotiating';
            default:
                return this._state;
        }
    }
    setInputTrack(newInputTrack) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.setInputTrack', Boolean(newInputTrack));
            if (newInputTrack && (this.isOver() || this.hidden)) {
                return;
            }
            this.inputTrack = newInputTrack;
            if (this.webrtcProcessor) {
                yield this.webrtcProcessor.setInputTrack(newInputTrack);
            }
            if (newInputTrack && this.pendingAnswerRequest) {
                yield this.processAnswerRequest(this.pendingAnswerRequest);
            }
        });
    }
    getRemoteMediaStream() {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.getRemoteMediaStream');
        if (this.hidden) {
            this.throwError('getRemoteMediaStream is not available for this call');
        }
        if (this.shouldIgnoreWebRTC()) {
            this.throwError('getRemoteMediaStream is not available for this service');
        }
        this.prepareWebRtcProcessor();
        return this.webrtcProcessor.getRemoteMediaStream();
    }
    processSignal(signal, oldCall) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (this.isOver()) {
                return;
            }
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.processSignal', signal);
            const { type: signalType } = signal;
            if (signalType === 'new') {
                return this.initializeRemoteCall(signal, oldCall);
            }
            if (signalType === 'rejected-call-request') {
                return this.flagAsEnded('remote');
            }
            if (!this.hasRemoteData) {
                (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.debug('Remote data missing, adding signal to queue');
                this.earlySignals.add(signal);
                return;
            }
            switch (signalType) {
                case 'remote-sdp':
                    return this.processRemoteSDP(signal);
                case 'request-offer':
                    return this.processOfferRequest(signal);
                case 'notification':
                    return this.processNotification(signal);
            }
        });
    }
    accept() {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.accept');
        if (!this.isPendingOurAcceptance()) {
            this.throwError('call-not-pending-acceptance');
        }
        if (!this.hasRemoteData) {
            this.throwError('missing-remote-data');
        }
        this.acceptedLocally = true;
        this.config.transporter.answer(this.callId, 'accept');
        if (this.getClientState() === 'accepting') {
            this.updateStateTimeouts();
            this.addStateTimeout('accepting', TIMEOUT_TO_CONFIRM_ACCEPTANCE);
            this.emitter.emit('accepting');
        }
    }
    reject() {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.reject');
        if (!this.isPendingOurAcceptance()) {
            this.throwError('call-not-pending-acceptance');
        }
        if (!this.hasRemoteData) {
            this.throwError('missing-remote-data');
        }
        this.config.transporter.answer(this.callId, 'reject');
        this.changeState('hangup');
    }
    transfer(callee) {
        var _a;
        if (!this.busy) {
            return;
        }
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.transfer', callee);
        this.config.transporter.sendToServer(this.callId, 'transfer', {
            to: callee,
        });
    }
    hangup(reason = 'normal') {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.hangup', reason);
        if (this.endedLocally || this._state === 'hangup') {
            return;
        }
        if (this.hidden) {
            return;
        }
        this.endedLocally = true;
        this.flagAsEnded(reason);
    }
    isPendingAcceptance() {
        return isPendingState(this._state);
    }
    isPendingOurAcceptance() {
        if (this._role !== 'callee' || this.acceptedLocally) {
            return false;
        }
        if (this.hidden) {
            return false;
        }
        return this.isPendingAcceptance();
    }
    isOver() {
        return this._state === 'hangup';
    }
    isAbleToReportStates() {
        return this.mayReportStates;
    }
    ignore() {
        var _a;
        if (this.ignored) {
            return;
        }
        const { hidden: wasHidden } = this;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.ignore');
        this._ignored = true;
        if (this.hidden && !wasHidden) {
            this.emitter.emit('hidden');
        }
        this.updateClientState();
        this.reportStates();
        this.mayReportStates = false;
        this.clearStateTimeouts();
    }
    setMuted(muted) {
        if (this.isOver() || this.hidden) {
            return;
        }
        if (!this.webrtcProcessor && !muted) {
            return;
        }
        this.requireWebRTC();
        const wasMuted = this.webrtcProcessor.muted;
        this.webrtcProcessor.setMuted(muted);
        if (wasMuted !== this.webrtcProcessor.muted) {
            this.emitter.emit('trackStateChange');
        }
    }
    setHeld(held) {
        if (this.isOver() || this.hidden) {
            return;
        }
        if (!this.webrtcProcessor && !held) {
            return;
        }
        this.requireWebRTC();
        const wasOnHold = this.webrtcProcessor.held;
        this.webrtcProcessor.setHeld(held);
        if (wasOnHold !== this.webrtcProcessor.held) {
            this.emitter.emit('trackStateChange');
        }
    }
    setContractState(state) {
        var _a, _b, _c;
        if (this.contractState === state) {
            return;
        }
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.setContractState', `${this.contractState} => ${state}`);
        if (['pre-signed', 'self-signed'].includes(this.contractState) && state === 'signed') {
            this.contractState = state;
            return;
        }
        if (this.contractState !== 'proposed') {
            this.reportStates();
        }
        if (this.contractState === 'signed') {
            if (state === 'ignored') {
                (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.error('[Media Signal] Trying to ignore a contract that was already signed.');
            }
            return;
        }
        if (this.contractState === 'pre-signed' && state === 'ignored') {
            (_c = this.config.logger) === null || _c === void 0 ? void 0 : _c.error('[Media Signal] Our self signed contract was ignored.');
        }
        const { hidden: wasHidden } = this;
        this.contractState = state;
        if (this.hidden && !wasHidden) {
            this.emitter.emit('hidden');
        }
        this.maybeStopWebRTC();
    }
    reportStates() {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.reportStates');
        this.clearStateReporter();
        if (!this.mayReportStates) {
            return;
        }
        if (this.hasRemoteData || Date.now() > this.creationTimestamp.valueOf() + CALLS_WITH_NO_REMOTE_DATA_REPORT_DELAY) {
            this.config.transporter.sendToServer(this.callId, 'local-state', Object.assign({ callState: this.state, clientState: this.getClientState(), serviceStates: Object.fromEntries(this.serviceStates.entries()), ignored: this.ignored, contractState: this.contractState }, (this.currentNegotiationId && { negotiationId: this.currentNegotiationId })));
        }
        if (this.state === 'hangup') {
            this.mayReportStates = false;
        }
    }
    sendDTMF(dtmf, duration) {
        if (!dtmf || !/^[0-9A-D#*,]$/.exec(dtmf)) {
            throw new Error('Invalid DTMF tone.');
        }
        this.config.transporter.sendToServer(this.callId, 'dtmf', {
            dtmf,
            duration,
        });
    }
    getStats(selector) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            return (_b = (_a = this.webrtcProcessor) === null || _a === void 0 ? void 0 : _a.getStats(selector)) !== null && _b !== void 0 ? _b : null;
        });
    }
    changeState(newState) {
        var _a;
        if (newState === this._state) {
            return;
        }
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.changeState', `${this._state} => ${newState}`);
        const oldState = this._state;
        this._state = newState;
        this.maybeStopWebRTC();
        this.updateClientState();
        this.emitter.emit('stateChange', oldState);
        this.requestStateReport();
        switch (newState) {
            case 'accepted':
                this.emitter.emit('accepted');
                break;
            case 'active':
                this.emitter.emit('active');
                this.reportStates();
                break;
            case 'hangup':
                this.emitter.emit('ended');
                break;
        }
    }
    updateClientState() {
        var _a;
        const { oldClientState } = this;
        const clientState = this.getClientState();
        if (clientState === oldClientState) {
            return;
        }
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.updateClientState', `${oldClientState} => ${clientState}`);
        this.updateStateTimeouts();
        this.requestStateReport();
        this.oldClientState = clientState;
        this.emitter.emit('clientStateChange', oldClientState);
    }
    maybeStopWebRTC() {
        if (!this.webrtcProcessor) {
            return;
        }
        if (this.isOver() || this.hidden) {
            this.webrtcProcessor.stop();
        }
    }
    changeContact(contact, { prioritizeExisting } = {}) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.changeContact');
        const lowPriorityContact = prioritizeExisting ? contact : this._contact;
        const highPriorityContact = prioritizeExisting ? this._contact : contact;
        const finalContact = highPriorityContact || lowPriorityContact;
        this._contact = finalContact && Object.assign({}, finalContact);
        if (this._contact) {
            this.emitter.emit('contactUpdate');
        }
    }
    processOfferRequest(signal) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (this.hidden) {
                return;
            }
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.processOfferRequest', signal);
            if (!this.isSignalTargetingThisSession(signal)) {
                (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.error('Received an unsigned offer request.');
                return;
            }
            const { negotiationId } = signal;
            if (this.shouldIgnoreWebRTC()) {
                this.sendError({ errorType: 'service', errorCode: 'invalid-service', negotiationId });
                return;
            }
            this.requireWebRTC();
            const iceRestart = this.currentNegotiationId !== negotiationId;
            this.currentNegotiationId = negotiationId;
            if (iceRestart) {
                this.hasLocalDescription = false;
            }
            this.hasRemoteDescription = false;
            let offer = null;
            try {
                offer = yield this.webrtcProcessor.createOffer({ iceRestart });
            }
            catch (e) {
                this.sendError({ errorType: 'service', errorCode: 'failed-to-create-offer', negotiationId });
                throw e;
            }
            if (!offer) {
                this.sendError({ errorType: 'service', errorCode: 'implementation-error', negotiationId });
            }
            yield this.deliverSdp(Object.assign(Object.assign({}, offer), { negotiationId }));
        });
    }
    shouldIgnoreWebRTC() {
        if (this.hasRemoteData) {
            return this.service !== 'webrtc';
        }
        // If we called and we don't support webrtc, assume it's not gonna be a webrtc call
        if (this._role === 'caller' && !this.config.processorFactories.webrtc) {
            return true;
        }
        // With no more info, we can't safely ignore webrtc
        return false;
    }
    processAnswerRequest(signal) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            this.pendingAnswerRequest = null;
            if (this.hidden || this.shouldIgnoreWebRTC()) {
                return;
            }
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.processAnswerRequest', signal);
            this.requireWebRTC();
            const { negotiationId } = signal;
            const iceRestart = this.currentNegotiationId !== negotiationId;
            if (iceRestart) {
                this.hasLocalDescription = false;
                this.hasRemoteDescription = false;
                this.webrtcProcessor.startNewNegotiation();
            }
            this.currentNegotiationId = negotiationId;
            if (!this.hasInputTrack()) {
                this.pendingAnswerRequest = signal;
                (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.debug('Delaying WebRTC Answer due to missing audio input track.');
                return;
            }
            let answer = null;
            try {
                answer = yield this.webrtcProcessor.createAnswer(signal);
            }
            catch (e) {
                (_c = this.config.logger) === null || _c === void 0 ? void 0 : _c.error(e);
                this.sendError({ errorType: 'service', errorCode: 'failed-to-create-answer', negotiationId });
                throw e;
            }
            if (!answer) {
                this.sendError({ errorType: 'service', errorCode: 'implementation-error', negotiationId });
                return;
            }
            this.hasRemoteDescription = true;
            yield this.deliverSdp(Object.assign(Object.assign({}, answer), { negotiationId }));
        });
    }
    sendError(error) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.sendError', error);
        if (this.hidden) {
            return;
        }
        this.config.transporter.sendError(this.callId, error);
    }
    processRemoteSDP(signal) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.processRemoteSDP', signal);
            if (this.hidden) {
                return;
            }
            if (!this.isSignalTargetingThisSession(signal)) {
                (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.error('Received an offer request that is unsigned, or signed to a different session.');
                return;
            }
            if (this.shouldIgnoreWebRTC()) {
                return;
            }
            this.requireWebRTC();
            if (signal.sdp.type === 'offer') {
                return this.processAnswerRequest(signal);
            }
            if (signal.negotiationId !== this.currentNegotiationId) {
                (_c = this.config.logger) === null || _c === void 0 ? void 0 : _c.error('Received an answer for an unexpected negotiation.');
                return;
            }
            yield this.webrtcProcessor.setRemoteAnswer(signal);
            this.hasRemoteDescription = true;
        });
    }
    deliverSdp(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.deliverSdp');
            this.hasLocalDescription = true;
            if (!this.hidden) {
                this.config.transporter.sendToServer(this.callId, 'local-sdp', data);
            }
            this.updateClientState();
        });
    }
    rejectAsUnavailable() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.rejectAsUnavailable');
            // If we have already told the server we accept this call, then we need to send a hangup to get out of it
            if (this.acceptedLocally) {
                return this.hangup('unavailable');
            }
            this.config.transporter.answer(this.callId, 'unavailable');
            this.changeState('hangup');
        });
    }
    processEarlySignals() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_1, _b, _c;
            var _d, _e;
            (_d = this.config.logger) === null || _d === void 0 ? void 0 : _d.debug('ClientMediaCall.processEarlySignals');
            const earlySignals = Array.from(this.earlySignals.values());
            this.earlySignals.clear();
            try {
                for (var _f = true, earlySignals_1 = __asyncValues(earlySignals), earlySignals_1_1; earlySignals_1_1 = yield earlySignals_1.next(), _a = earlySignals_1_1.done, !_a; _f = true) {
                    _c = earlySignals_1_1.value;
                    _f = false;
                    const signal = _c;
                    try {
                        yield this.processSignal(signal);
                    }
                    catch (e) {
                        (_e = this.config.logger) === null || _e === void 0 ? void 0 : _e.error('Error processing early signal', e);
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_f && !_a && (_b = earlySignals_1.return)) yield _b.call(earlySignals_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        });
    }
    acknowledge() {
        var _a;
        if (this.acknowledged || this.hidden) {
            return;
        }
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.acknowledge');
        this.acknowledged = true;
        this.config.transporter.answer(this.callId, 'ack');
        if (this._state === 'none') {
            this.changeState('ringing');
        }
    }
    processNotification(signal) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.processNotification');
            switch (signal.notification) {
                case 'accepted':
                    return this.flagAsAccepted();
                case 'active':
                    if (this.state === 'accepted' || this.hidden) {
                        this.changeState('active');
                    }
                    return;
                case 'hangup':
                    return this.flagAsEnded('remote');
            }
        });
    }
    flagAsAccepted() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.flagAsAccepted');
            // If hidden, just move the state without doing anything
            if (this.hidden) {
                this.changeState('accepted');
                return;
            }
            if (!this.acceptedLocally) {
                this.config.transporter.sendError(this.callId, { errorType: 'signaling', errorCode: 'not-accepted' });
                (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.error('Trying to activate a call that was not yet accepted locally.');
                return;
            }
            if (this.contractState === 'proposed') {
                this.contractState = 'self-signed';
            }
            // Both sides of the call have accepted it, we can change the state now
            this.changeState('accepted');
            this.addStateTimeout('accepted', TIMEOUT_TO_PROGRESS_SIGNALING);
            this.addStateTimeout('has-offer', TIMEOUT_TO_PROGRESS_SIGNALING);
        });
    }
    flagAsEnded(reason) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.flagAsEnded', reason);
        if (this._state === 'hangup') {
            return;
        }
        if (!this.hidden && this.hasRemoteData) {
            this.config.transporter.hangup(this.callId, reason);
        }
        this.changeState('hangup');
    }
    addStateTimeout(state, timeout, callback) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.addStateTimeout', state, `${timeout / 1000}s`);
        if (this.getClientState() !== state) {
            return;
        }
        // Do not set state timeouts if the call is not happening on this session, unless there's a callback attached to that timeout
        if (this.hidden && !callback) {
            return;
        }
        const handler = {
            state,
            handler: setTimeout(() => {
                if (this.stateTimeoutHandlers.has(handler)) {
                    this.stateTimeoutHandlers.delete(handler);
                }
                if (state !== this.getClientState()) {
                    return;
                }
                if (callback) {
                    callback();
                }
                else {
                    void this.hangup('timeout');
                }
            }, timeout),
        };
        this.stateTimeoutHandlers.add(handler);
    }
    updateStateTimeouts() {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.updateStateTimeouts');
        const clientState = this.getClientState();
        for (const handler of this.stateTimeoutHandlers.values()) {
            if (handler.state === clientState) {
                continue;
            }
            clearTimeout(handler.handler);
            this.stateTimeoutHandlers.delete(handler);
        }
    }
    clearStateTimeouts() {
        for (const handler of this.stateTimeoutHandlers.values()) {
            clearTimeout(handler.handler);
        }
        this.stateTimeoutHandlers.clear();
    }
    onWebRTCInternalStateChange(stateName) {
        var _a, _b;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.onWebRTCInternalStateChange');
        if (!this.webrtcProcessor) {
            return;
        }
        const stateValue = this.webrtcProcessor.getInternalState(stateName);
        if (this.serviceStates.get(stateName) !== stateValue) {
            (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.debug(stateName, stateValue);
            this.serviceStates.set(stateName, stateValue);
            switch (stateName) {
                case 'connection':
                    this.onWebRTCConnectionStateChange(stateValue);
                    break;
            }
            this.requestStateReport();
        }
    }
    onWebRTCInternalError({ critical, error }) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.onWebRTCInternalError', critical, error);
        const errorCode = typeof error === 'object' ? error.message : error;
        this.sendError(Object.assign({ errorType: 'service', errorCode }, (this.currentNegotiationId && { negotiationId: this.currentNegotiationId })));
        if (critical) {
            this.hangup('service-error');
        }
    }
    onWebRTCNegotiationNeeded() {
        var _a;
        if (this._state !== 'active' || !this.currentNegotiationId) {
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.warn('WebRTCProcessor requested a renegotiation while in a state that should not trigger any.', {
                state: this._state,
                currentNegotiationId: this.currentNegotiationId,
            });
            return;
        }
        this.config.transporter.requestRenegotiation(this.callId, this.currentNegotiationId);
    }
    onWebRTCConnectionStateChange(stateValue) {
        var _a;
        if (this.hidden) {
            return;
        }
        try {
            switch (stateValue) {
                case 'connected':
                    if (this.state === 'accepted') {
                        this.changeState('active');
                    }
                    break;
                case 'failed':
                    if (!this.isOver()) {
                        this.hangup('service-error');
                    }
                    break;
                case 'closed':
                    if (!this.isOver()) {
                        this.hangup('service-error');
                    }
                    break;
                case 'disconnected':
                    // Disconnected state is temporary, so let's wait for it to change into something else before reacting.
                    break;
            }
        }
        catch (e) {
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.error('An error occured while reviewing the webrtc connection state change', e);
        }
    }
    clearStateReporter() {
        if (this.stateReporterTimeoutHandler) {
            clearTimeout(this.stateReporterTimeoutHandler);
            this.stateReporterTimeoutHandler = null;
        }
    }
    requestStateReport() {
        this.clearStateReporter();
        if (!this.mayReportStates) {
            return;
        }
        this.stateReporterTimeoutHandler = setTimeout(() => {
            this.reportStates();
        }, STATE_REPORT_DELAY);
    }
    throwError(error) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.error(error);
        throw new Error(error);
    }
    isSignalTargetingThisSession(signal) {
        if (signal.toContractId) {
            return signal.toContractId === this.config.sessionId;
        }
        return this.signed;
    }
    prepareWebRtcProcessor() {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.prepareWebRtcProcessor');
        if (this.webrtcProcessor) {
            return;
        }
        const { logger, processorFactories: { webrtc: webrtcFactory }, iceGatheringTimeout, } = this.config;
        if (!webrtcFactory) {
            this.throwError('webrtc-not-implemented');
        }
        this.webrtcProcessor = webrtcFactory({ logger, iceGatheringTimeout, call: this, inputTrack: this.inputTrack });
        this.webrtcProcessor.emitter.on('internalError', (event) => this.onWebRTCInternalError(event));
        this.webrtcProcessor.emitter.on('internalStateChange', (stateName) => this.onWebRTCInternalStateChange(stateName));
        this.webrtcProcessor.emitter.on('negotiationNeeded', () => this.onWebRTCNegotiationNeeded());
    }
    requireWebRTC() {
        try {
            this.prepareWebRtcProcessor();
        }
        catch (e) {
            this.sendError({ errorType: 'service', errorCode: 'webrtc-not-implemented' });
            throw e;
        }
    }
}
export class ClientMediaCallWebRTC extends ClientMediaCall {
}
//# sourceMappingURL=Call.js.map