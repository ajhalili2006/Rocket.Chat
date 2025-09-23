export class MediaSignalTransportWrapper {
    constructor(contractId, sendSignalFn, logger) {
        this.contractId = contractId;
        this.sendSignalFn = sendSignalFn;
        this.logger = logger;
    }
    sendToServer(callId, type, signal) {
        var _a;
        (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalTransportWrapper.sendToServer', type);
        return this.sendSignal(Object.assign(Object.assign(Object.assign({}, (type !== 'register' && { callId })), { contractId: this.contractId, type }), signal));
    }
    sendError(callId, { errorType, errorCode, negotiationId }) {
        this.sendToServer(callId, 'error', Object.assign(Object.assign({ errorType: errorType || 'other' }, (errorCode && { errorCode })), (negotiationId && { negotiationId })));
    }
    answer(callId, answer) {
        return this.sendToServer(callId, 'answer', { answer });
    }
    hangup(callId, reason) {
        return this.sendToServer(callId, 'hangup', { reason });
    }
    requestRenegotiation(callId, oldNegotiationId) {
        return this.sendToServer(callId, 'negotiation-needed', { oldNegotiationId });
    }
    sendSignal(signal) {
        var _a;
        (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug('MediaSignalTransportWrapper.sendSignal', signal);
        this.sendSignalFn(signal);
    }
}
//# sourceMappingURL=TransportWrapper.js.map