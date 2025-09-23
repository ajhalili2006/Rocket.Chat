import type { JSONSchemaType } from 'ajv';
/** Client is reporting an error */
export type ClientMediaSignalError = {
    callId: string;
    contractId: string;
    type: 'error';
    errorType?: 'signaling' | 'service' | 'other';
    errorCode?: string;
    negotiationId?: string;
};
export declare const clientMediaSignalErrorSchema: JSONSchemaType<ClientMediaSignalError>;
//# sourceMappingURL=error.d.ts.map