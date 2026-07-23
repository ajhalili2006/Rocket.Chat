import type { IMediaSignalLogger } from '../../definition';
type SessionRegistrationConfig = {
    logger?: IMediaSignalLogger;
    registerFn: () => void;
};
export declare class SessionRegistration {
    private config;
    get registered(): boolean;
    get active(): boolean;
    private sessionEnded;
    private registrationConfirmed;
    private registerConfirmationHandler;
    constructor(config: SessionRegistrationConfig);
    register(): void;
    reRegister(): void;
    confirmRegistration(): void;
    endSession(): void;
    private clearRegisterConfirmationHandler;
    private registerAttempt;
}
export {};
//# sourceMappingURL=SessionRegistration.d.ts.map