const REGISTER_CONFIRMATION_TIMEOUT = 1000;
const MAX_REGISTER_ATTEMPTS = 10;
export class SessionRegistration {
    get registered() {
        return this.registrationConfirmed;
    }
    get active() {
        return this.registered && !this.sessionEnded;
    }
    constructor(config) {
        this.config = config;
        this.sessionEnded = false;
        this.registrationConfirmed = false;
        this.registerConfirmationHandler = null;
        //
    }
    register() {
        if (this.registerConfirmationHandler) {
            return;
        }
        this.registerAttempt(1);
    }
    reRegister() {
        var _a;
        if (this.sessionEnded) {
            return;
        }
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('SessionRegistration.reRegister');
        this.clearRegisterConfirmationHandler();
        this.register();
    }
    confirmRegistration() {
        this.registrationConfirmed = true;
        this.clearRegisterConfirmationHandler();
    }
    endSession() {
        this.sessionEnded = true;
    }
    clearRegisterConfirmationHandler() {
        if (this.registerConfirmationHandler) {
            clearTimeout(this.registerConfirmationHandler);
            this.registerConfirmationHandler = null;
        }
    }
    registerAttempt(attempt) {
        var _a;
        if (this.sessionEnded) {
            return;
        }
        (_a = this.config.logger) === null || _a === void 0 ? void 0 : _a.debug('SessionRegistration.registerAttempt', attempt);
        const timeout = attempt * REGISTER_CONFIRMATION_TIMEOUT;
        this.registerConfirmationHandler = setTimeout(() => {
            this.registerConfirmationHandler = null;
            if (attempt < MAX_REGISTER_ATTEMPTS) {
                this.registerAttempt(attempt + 1);
            }
        }, timeout);
        this.config.registerFn();
    }
}
//# sourceMappingURL=SessionRegistration.js.map