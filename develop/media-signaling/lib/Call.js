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
import { NegotiationManager } from './NegotiationManager';
import { isPendingState } from './services/states';
import { serializeError } from './utils/serializeError';
const TIMEOUT_TO_ACCEPT = 60000;
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
        if (!this._transferredBy) {
            return null;
        }
        return Object.assign({}, this._transferredBy);
    }
    get service() {
        return this._service;
    }
    get signed() {
        return ['signed', 'pre-signed', 'self-signed'].includes(this.contractState);
    }
    get hidden() {
        /**
         * A call is hidden if:
         * 1. It was flagged as ignored by the Session
         * 2. It is happening in a different session
         * 3. The call was started in some other session and we have not received its data yet
         *    Since the Call instance is only created when we receive "something" from the server, this would mean we received signals out of order, or missed one.
         */
        return this.ignored || this.contractState === 'ignored' || !this.initialized;
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
    get remoteHeld() {
        return this._remoteHeld;
    }
    get remoteMute() {
        return this._remoteMute;
    }
    /** indicates the call is past the "dialing" stage and not yet over */
    get busy() {
        return !this.isPendingAcceptance() && !this.isOver();
    }
    get confirmed() {
        return this.hasRemoteData;
    }
    get tempCallId() {
        return this.localCallId;
    }
    get activeTimestamp() {
        if (!this._activeTimestamp) {
            return undefined;
        }
        return new Date(this._activeTimestamp);
    }
    get initialized() {
        return this._initialized;
    }
    get flags() {
        return [...this._flags];
    }
    get features() {
        return [...(this.enabledFeatures || [])];
    }
    get remoteParticipants() {
        if (!this.remoteParticipant) {
            return [];
        }
        return [this.remoteParticipant];
    }
    get participants() {
        return [this.localParticipant, ...this.remoteParticipants];
    }
    get callStateData() {
        if (!this.confirmed || !this.remoteParticipant) {
            const number = this.contact.type === 'sip' ? this.contact.id : '';
            return {
                confirmed: false,
                tempCallId: this.tempCallId,
                state: this.state,
                title: this.contact.displayName || number || 'unknown',
                localParticipant: this.localParticipant,
            };
        }
        return {
            confirmed: this.confirmed,
            callId: this.callId,
            service: this.service,
            flags: this.flags,
            features: this.features,
            state: this.state,
            transferredBy: this.transferredBy,
            activeTimestamp: this.activeTimestamp,
            tempCallId: this.tempCallId,
            hidden: this.hidden,
            localParticipant: this.localParticipant,
            remoteParticipant: this.remoteParticipant,
        };
    }
    constructor(config, callId, { inputTrack } = {}) {
        this.config = config;
        this.webrtcProcessor = null;
        this.emitter = new Emitter();
        this.config.transporter = config.transporter;
        this.localCallId = callId;
        this.remoteCallId = null;
        this.acceptedLocally = false;
        this.acceptedRemotely = false;
        this.endedLocally = false;
        this.hasRemoteData = false;
        this._initialized = false;
        this.acknowledged = false;
        this.contractState = 'proposed';
        this.serviceStates = new Map();
        this.stateReporterTimeoutHandler = null;
        this.mayReportStates = true;
        this.inputTrack = inputTrack || null;
        this.screenVideoTrack = null;
        this.creationTimestamp = new Date();
        this.sentLocalSdp = false;
        this.receivedRemoteSdp = false;
        this.enabledFeatures = null;
        this.earlySignals = new Set();
        this.stateTimeoutHandlers = new Set();
        this._role = 'callee';
        this._state = 'none';
        this.oldClientState = 'none';
        this._ignored = false;
        this._contact = null;
        this._transferredBy = null;
        this._service = null;
        this._remoteHeld = false;
        this._remoteMute = false;
        this._flags = [];
        this.selfContact = null;
        this.localParticipant = this.createLocalParticipantProxy();
        this.remoteParticipant = null;
        this.negotiationManager = new NegotiationManager(this, { logger: config.logger });
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
            this._initialized = true;
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
    requestCall(callee, supportedFeatures, contactInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (this.initialized) {
                return;
            }
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.requestCall', callee);
            this.config.transporter.sendToServer(this.callId, 'request-call', {
                callee,
                supportedServices: Object.keys(this.config.processorFactories),
                supportedFeatures,
            });
            return this.initializeOutboundCall(Object.assign(Object.assign({}, contactInfo), callee));
        });
    }
    /** initialize a call with the data received from the server on a 'new' signal; this gets executed once for every call */
    initializeRemoteCall(signal, oldCall) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            if (this.hasRemoteData) {
                return;
            }
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.initializeRemoteCall', signal);
            this.remoteCallId = signal.callId;
            const wasInitialized = this.initialized;
            this._initialized = true;
            this.hasRemoteData = true;
            this._service = signal.service;
            this._role = signal.role;
            this._flags = signal.flags || [];
            this.selfContact = Object.assign({ type: 'user', id: this.config.userId }, signal.self);
            this._transferredBy = signal.transferredBy || null;
            if (this._role === 'caller' && !this.acceptedLocally) {
                if (oldCall) {
                    this.acceptedLocally = true;
                }
                else if (((_b = signal.self) === null || _b === void 0 ? void 0 : _b.contractId) && signal.self.contractId !== this.config.sessionId) {
                    // Call from another session, must be flagged as ignored before any event is triggered
                    (_c = this.config.logger) === null || _c === void 0 ? void 0 : _c.log('Ignoring Outbound Call from a different session');
                    this.contractState = 'ignored';
                }
                else if (AUTO_IGNORE_UNKNOWN_OUTBOUND_CALLS) {
                    (_d = this.config.logger) === null || _d === void 0 ? void 0 : _d.log('Ignoring Unknown Outbound Call');
                    this.ignore();
                }
            }
            this.changeContact(signal.contact, { skipEvent: true });
            this.remoteParticipant = this.createRemoteParticipantProxy();
            try {
                // If the call is already flagged as over before the initialization, do not process anything other than filling in the basic information
                if (this.isOver()) {
                    return;
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
                        this.sendError({
                            errorType: 'service',
                            errorCode: 'service-initialization-failed',
                            critical: true,
                            errorDetails: serializeError(e),
                        });
                        yield this.rejectAsUnavailable();
                        throw e;
                    }
                }
                // Send an ACK so the server knows that this session exists and is reachable
                this.acknowledge();
                // Adds a secondary timeout for all sessions of the call; Won't matter if the original caller session is still active, but is needed for transferred calls.
                this.addStateTimeout('pending', TIMEOUT_TO_ACCEPT);
                // If the call was requested by this specific session, assume we're signed already.
                if (this._role === 'caller' &&
                    this.acceptedLocally &&
                    this.contractState !== 'ignored' &&
                    (signal.requestedCallId === this.localCallId || Boolean(oldCall))) {
                    this.contractState = 'pre-signed';
                }
            }
            finally {
                if (!wasInitialized) {
                    this.emitter.emit('initialized');
                }
                this.emitter.emit('contactUpdate');
                this.emitter.emit('confirmed');
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
                if (!this.negotiationManager.isConfigured()) {
                    return 'waiting-for-track';
                }
                if (!this.negotiationManager.currentNegotiationId) {
                    return 'waiting-for-offer';
                }
                if (this._role === 'caller') {
                    if (!this.sentLocalSdp) {
                        return 'generating-local-sdp';
                    }
                    if (!this.receivedRemoteSdp) {
                        return 'waiting-for-answer';
                    }
                }
                else {
                    if (!this.receivedRemoteSdp) {
                        return 'waiting-for-offer';
                    }
                    if (!this.sentLocalSdp) {
                        return 'generating-local-sdp';
                    }
                }
                return 'activating';
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
            const hadInputTrack = Boolean(this.inputTrack);
            this.inputTrack = newInputTrack;
            if (this.webrtcProcessor) {
                yield this.webrtcProcessor.setInputTrack(newInputTrack);
            }
            if (newInputTrack && !hadInputTrack) {
                this.updateClientState();
                yield this.negotiationManager.processNegotiations();
            }
        });
    }
    setScreenVideoTrack(newVideoTrack) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.setScreenVideoTrack', Boolean(newVideoTrack));
            if (newVideoTrack && !this.canHaveScreenVideoTrack()) {
                newVideoTrack.stop();
                newVideoTrack = null;
            }
            const hadVideoTrack = this.hasScreenVideoTrack();
            const oldVideoTrack = this.screenVideoTrack;
            this.screenVideoTrack = newVideoTrack;
            if (this.webrtcProcessor) {
                yield this.webrtcProcessor.setScreenVideoTrack(newVideoTrack);
            }
            // Only stop the track after we replaced it on the transceiver, as we don't want the transceiver to stop if there's another track
            if (hadVideoTrack && newVideoTrack !== oldVideoTrack) {
                (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.debug('ClientMediaCall.setScreenVideoTrack.stopOldTrack');
                oldVideoTrack === null || oldVideoTrack === void 0 ? void 0 : oldVideoTrack.stop();
            }
            if (newVideoTrack && !hadVideoTrack) {
                yield this.negotiationManager.processNegotiations();
            }
        });
    }
    canHaveScreenVideoTrack() {
        if (this.isOver() || this._ignored || this.hidden) {
            return false;
        }
        if (this.role === 'caller') {
            return this.hasRemoteData;
        }
        return this.busy;
    }
    hasScreenVideoTrack() {
        return Boolean(this.screenVideoTrack);
    }
    getLocalMediaStream(tag) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.getLocalMediaStream', tag);
        if (!this.mayUseStreams()) {
            return null;
        }
        return this.webrtcProcessor.streams.getLocalStreamByTag(tag || 'main');
    }
    getRemoteMediaStream(tag) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.getRemoteMediaStream', tag);
        if (!this.mayUseStreams()) {
            return null;
        }
        return this.webrtcProcessor.streams.getRemoteStreamByTag(tag || 'main');
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
                // if the call is over, we no longer need to wait for its data
                if (signal.type === 'notification' && signal.notification === 'hangup') {
                    this.changeState('hangup');
                    return;
                }
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
        // If the server already signed us into this call, go straight to the accepted state
        if (this.acceptedRemotely) {
            this.changeState('accepted');
            return;
        }
        this.config.transporter.answer(this.callId, 'accept', { supportedFeatures: this.config.supportedFeatures });
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
        // If the hangup was requested by the user but the call is not happening here, send an 'another-client' hangup request to the server and wait for the server to hangup the call
        if (reason === 'normal' && this.contractState === 'ignored') {
            this.config.transporter.hangup(this.callId, 'another-client');
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
    requestScreenShare(requested) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.setScreenShareRequested', requested);
        if (!this.canHaveScreenVideoTrack()) {
            return;
        }
        if (!this.webrtcProcessor && !requested) {
            return;
        }
        if (!this.isFeatureAvailable('screen-share')) {
            this.throwError('Screen sharing is not available for this call.');
        }
        this.requireWebRTC();
        this.emitter.emit('screenShareRequestChange', requested);
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
            this.config.transporter.sendToServer(this.callId, 'local-state', Object.assign({ callState: this.state, clientState: this.getClientState(), serviceStates: Object.fromEntries(this.serviceStates.entries()), ignored: this.ignored, contractState: this.contractState }, (this.negotiationManager.currentNegotiationId && { negotiationId: this.negotiationManager.currentNegotiationId })));
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
    isFeatureAvailable(feature) {
        if (!this.enabledFeatures) {
            return false;
        }
        return this.enabledFeatures.includes(feature);
    }
    hasFlag(flag) {
        return this._flags.includes(flag);
    }
    canChangeToState(newState) {
        if (newState === this._state) {
            return false;
        }
        if (this._state === 'hangup') {
            return false;
        }
        switch (newState) {
            case 'accepted':
                return this.isPendingAcceptance();
            case 'active':
                return this._state === 'accepted' || this.hidden;
        }
        return true;
    }
    changeState(newState) {
        var _a;
        if (!this.canChangeToState(newState)) {
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
                if (!this._activeTimestamp) {
                    this._activeTimestamp = new Date();
                }
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
        // Any time the client state changes within the 'accepted' call state, set a new timeout for the new client state
        // This ensures there will be three separate timeouts for the different negotiation stages: "generating local sdp", "waiting for remote sdp" and "connecting"
        if (this._state === 'accepted') {
            this.addStateTimeout(clientState, TIMEOUT_TO_PROGRESS_SIGNALING);
        }
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
    changeContact(contact, { prioritizeExisting, skipEvent } = {}) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.changeContact');
        const lowPriorityContact = prioritizeExisting ? contact : this._contact;
        const highPriorityContact = prioritizeExisting ? this._contact : contact;
        const finalContact = highPriorityContact || lowPriorityContact;
        this._contact = finalContact && Object.assign({}, finalContact);
        if (this._contact && !skipEvent) {
            this.emitter.emit('contactUpdate');
        }
    }
    processOfferRequest(signal) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (this.hidden || this.isOver()) {
                return;
            }
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.processOfferRequest', signal);
            if (!this.isSignalTargetingThisSession(signal)) {
                (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.error('Received an unsigned offer request.');
                return;
            }
            const { negotiationId } = signal;
            if (this.shouldIgnoreWebRTC()) {
                this.sendError({ errorType: 'service', errorCode: 'invalid-service', negotiationId, critical: true });
                return;
            }
            this.requireWebRTC();
            void this.negotiationManager.addNegotiation(negotiationId);
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
            var _a;
            if (this.hidden || this.shouldIgnoreWebRTC()) {
                return;
            }
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.processAnswerRequest', signal);
            this.requireWebRTC();
            void this.negotiationManager.addNegotiation(signal.negotiationId, signal.sdp);
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
            if (signal.streams) {
                this.webrtcProcessor.setRemoteIds(signal.streams);
            }
            switch (signal.sdp.type) {
                case 'offer':
                    yield this.processAnswerRequest(signal);
                    break;
                case 'answer':
                    yield this.negotiationManager.setRemoteDescription(signal.negotiationId, signal.sdp);
                    break;
                default:
                    (_c = this.config.logger) === null || _c === void 0 ? void 0 : _c.error('Unsupported sdp type.');
                    return;
            }
            this.receivedRemoteSdp = true;
            this.updateClientState();
        });
    }
    deliverSdp(data) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.deliverSdp');
        if (!this.hidden) {
            this.config.transporter.sendToServer(this.callId, 'local-sdp', Object.assign(Object.assign({}, data), { streams: this.getLocalStreamIds() }));
            this.sentLocalSdp = true;
        }
        this.updateClientState();
    }
    getLocalStreamIds() {
        var _a;
        return ((_a = this.webrtcProcessor) === null || _a === void 0 ? void 0 : _a.getLocalStreamIds()) || [];
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
            var _a, _b;
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.processEarlySignals');
            const earlySignals = Array.from(this.earlySignals.values());
            this.earlySignals.clear();
            for (const signal of earlySignals) {
                try {
                    yield this.processSignal(signal);
                }
                catch (e) {
                    (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.error('Error processing early signal', e);
                }
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
                    return this.flagAsAccepted(signal.features);
                case 'active':
                    if (this.state === 'accepted' || this.hidden) {
                        this.changeState('active');
                    }
                    return;
                case 'trying':
                    this.resetStateTimeouts();
                    break;
                case 'hangup':
                    return this.flagAsEnded('remote');
            }
        });
    }
    flagAsAccepted(enabledFeatures) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (!this.isPendingAcceptance()) {
                return;
            }
            (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.flagAsAccepted');
            this.acceptedRemotely = true;
            if (enabledFeatures && this._state !== 'accepted') {
                this.enabledFeatures = enabledFeatures;
            }
            // If hidden, just move the state without doing anything
            if (this.hidden) {
                this.changeState('accepted');
                return;
            }
            if (this.contractState === 'proposed') {
                this.contractState = 'self-signed';
            }
            if (!this.acceptedLocally) {
                (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.debug('Server signed us into a call that we have not yet accepted locally.');
                return;
            }
            // Both sides of the call have accepted it, we can change the state now
            this.changeState('accepted');
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
        let handler = null;
        const data = {
            state,
            clear: () => {
                if (handler) {
                    clearTimeout(handler);
                }
                handler = null;
            },
            reset: () => {
                data.clear();
                handler = setTimeout(() => {
                    if (this.stateTimeoutHandlers.has(data)) {
                        this.stateTimeoutHandlers.delete(data);
                    }
                    if (state !== this.getClientState()) {
                        return;
                    }
                    if (callback) {
                        callback();
                    }
                    else {
                        void this.hangup(this.getTimeoutHangupReason(state));
                    }
                }, timeout);
            },
        };
        data.reset();
        this.stateTimeoutHandlers.add(data);
    }
    getTimeoutHangupReason(state) {
        switch (state) {
            case 'pending':
                return 'not-answered';
            case 'waiting-for-track':
                return 'timeout-local-track';
            case 'waiting-for-offer':
            case 'waiting-for-answer':
                return 'timeout-remote-sdp';
            case 'generating-local-sdp':
                return 'timeout-local-sdp';
            case 'activating':
                return 'timeout-activation';
        }
        return 'timeout';
    }
    resetStateTimeouts() {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.resetStateTimeouts');
        const clientState = this.getClientState();
        for (const handler of this.stateTimeoutHandlers.values()) {
            if (handler.state !== clientState) {
                continue;
            }
            handler.reset();
        }
    }
    updateStateTimeouts() {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.updateStateTimeouts');
        const clientState = this.getClientState();
        for (const handler of this.stateTimeoutHandlers.values()) {
            if (handler.state === clientState) {
                continue;
            }
            handler.clear();
            this.stateTimeoutHandlers.delete(handler);
        }
    }
    clearStateTimeouts() {
        for (const handler of this.stateTimeoutHandlers.values()) {
            handler.clear();
        }
        this.stateTimeoutHandlers.clear();
    }
    updateRemoteStates() {
        if (!this.webrtcProcessor) {
            return;
        }
        const isRemoteHeld = this.webrtcProcessor.isRemoteHeld();
        const isRemoteMute = this.webrtcProcessor.isRemoteMute();
        if (isRemoteHeld === this._remoteHeld && isRemoteMute === this._remoteMute) {
            return;
        }
        this._remoteHeld = isRemoteHeld;
        this._remoteMute = isRemoteMute;
        this.emitter.emit('trackStateChange');
    }
    onWebRTCInternalStateChange(stateName) {
        var _a, _b;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.onWebRTCInternalStateChange');
        if (!this.webrtcProcessor) {
            return;
        }
        const stateValue = this.webrtcProcessor.getInternalState(stateName);
        if (typeof stateValue === 'string' && this.serviceStates.get(stateName) !== stateValue) {
            (_b = this.config.logger) === null || _b === void 0 ? void 0 : _b.debug(stateName, stateValue);
            this.serviceStates.set(stateName, stateValue);
            switch (stateName) {
                case 'connection':
                    this.onWebRTCConnectionStateChange(stateValue);
                    break;
            }
            this.requestStateReport();
        }
        this.updateRemoteStates();
    }
    onWebRTCStreamChanged() {
        var _a, _b;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.onWebRTCStreamChanged');
        if (!((_b = this.webrtcProcessor) === null || _b === void 0 ? void 0 : _b.streams.screenShareLocal.hasVideo()) && this.hasScreenVideoTrack()) {
            void this.setScreenVideoTrack(null);
        }
        this.emitter.emit('streamChange');
    }
    onNegotiationNeeded(oldNegotiationId) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.onNegotiationNeeded', oldNegotiationId);
        this.config.transporter.requestRenegotiation(this.callId, oldNegotiationId);
    }
    onNegotiationStarted() {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.onNegotiationStarted');
        this.updateClientState();
    }
    onNegotiationError(negotiationId, errorCode) {
        var _a;
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.onNegotiationError', negotiationId, errorCode);
        this.sendError({
            errorType: 'service',
            errorCode,
            negotiationId,
            critical: false,
        });
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
                        this.sendError({
                            errorType: 'service',
                            errorCode: 'connection-failed',
                            critical: true,
                            negotiationId: this.negotiationManager.currentNegotiationId || undefined,
                        });
                        this.hangup('service-error');
                    }
                    break;
                case 'closed':
                    if (!this.isOver()) {
                        this.sendError({
                            errorType: 'service',
                            errorCode: 'connection-closed',
                            critical: true,
                            negotiationId: this.negotiationManager.currentNegotiationId || undefined,
                        });
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
    createLocalParticipantProxy() {
        const localParticipant = {
            local: true,
            participantId: this.config.userId,
            actorType: 'user',
            actorId: this.config.userId,
            role: this._role,
            muted: this.muted,
            held: this.held,
            contact: this.selfContact || { type: 'user', id: this.config.userId },
            getMediaStream: (tag) => this.getLocalMediaStream(tag),
            setMuted: (muted) => this.setMuted(muted),
            setHeld: (held) => this.setHeld(held),
        };
        return new Proxy(localParticipant, {
            get: (target, prop, receiver) => {
                switch (prop) {
                    case 'role':
                        return this._role;
                    case 'contact':
                        return this.selfContact || { type: 'user', id: this.config.userId };
                    case 'muted':
                        return this.muted;
                    case 'held':
                        return this.held;
                    default:
                        return Reflect.get(target, prop, receiver);
                }
            },
        });
    }
    createRemoteParticipantProxy() {
        if (!this.hasRemoteData) {
            throw new Error('Unable to initialize remote participant without remote data');
        }
        const { type: actorType, id: actorId } = this.contact;
        if (!actorType || !actorId) {
            throw new Error('Unable to initialize remote participant without actor identification');
        }
        const participantId = actorType === 'user' ? actorId : `${actorType}/${actorId}`;
        const role = this._role === 'callee' ? 'caller' : 'callee';
        const remote = {
            local: false,
            participantId,
            actorType,
            actorId,
            role,
            muted: this.remoteMute,
            held: this.remoteHeld,
            contact: this.contact,
            getMediaStream: (tag) => this.getRemoteMediaStream(tag),
        };
        return new Proxy(remote, {
            get: (target, prop, receiver) => {
                switch (prop) {
                    case 'contact':
                        return this.contact;
                    case 'muted':
                        return this.remoteMute;
                    case 'held':
                        return this.remoteHeld;
                    default:
                        return Reflect.get(target, prop, receiver);
                }
            },
        });
    }
    mayUseStreams() {
        if (this.hidden || !this.signed) {
            return false;
        }
        if (this.shouldIgnoreWebRTC()) {
            return false;
        }
        if (!this.webrtcProcessor) {
            return false;
        }
        return true;
    }
    prepareWebRtcProcessor() {
        var _a;
        if (this.webrtcProcessor) {
            return;
        }
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('ClientMediaCall.prepareWebRtcProcessor');
        const { logger, processorFactories: { webrtc: webrtcFactory }, iceGatheringTimeout, } = this.config;
        if (!webrtcFactory) {
            this.throwError('webrtc-not-implemented');
        }
        this.webrtcProcessor = webrtcFactory(Object.assign({ logger,
            iceGatheringTimeout, call: this, inputTrack: this.inputTrack, screenVideoTrack: this.screenVideoTrack }, (this.config.iceServers.length && { rtc: { iceServers: this.config.iceServers } })));
        this.webrtcProcessor.emitter.on('internalStateChange', (stateName) => this.onWebRTCInternalStateChange(stateName));
        this.webrtcProcessor.emitter.on('streamChanged', () => this.onWebRTCStreamChanged());
        this.negotiationManager.emitter.on('local-sdp', ({ sdp, negotiationId }) => this.deliverSdp({ sdp, negotiationId }));
        this.negotiationManager.emitter.on('negotiation-needed', ({ oldNegotiationId }) => this.onNegotiationNeeded(oldNegotiationId));
        this.negotiationManager.emitter.on('negotiation-started', () => this.onNegotiationStarted());
        this.negotiationManager.emitter.on('error', ({ errorCode, negotiationId }) => this.onNegotiationError(negotiationId, errorCode));
        this.negotiationManager.setWebRTCProcessor(this.webrtcProcessor);
    }
    requireWebRTC() {
        try {
            this.prepareWebRtcProcessor();
        }
        catch (e) {
            this.sendError({ errorType: 'service', errorCode: 'webrtc-not-implemented', critical: true, errorDetails: serializeError(e) });
            throw e;
        }
    }
}
export class ClientMediaCallWebRTC extends ClientMediaCall {
}
//# sourceMappingURL=Call.js.map