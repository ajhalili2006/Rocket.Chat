import type { JSONSchemaType } from 'ajv';
/** Client is sending DTMF tones to the other side of the call */
export type ClientMediaSignalDTMF = {
    callId: string;
    type: 'dtmf';
    contractId: string;
    dtmf: string;
    duration?: number;
};
export declare const clientMediaSignalDTMFSchema: JSONSchemaType<ClientMediaSignalDTMF>;
//# sourceMappingURL=dtmf.d.ts.map