import type { JSONSchemaType } from 'ajv';
/** Client is transfering the other actor to a new actor */
export type ClientMediaSignalTransfer = {
    callId: string;
    type: 'transfer';
    contractId: string;
    to: {
        type: 'user' | 'sip';
        id: string;
    };
};
export declare const clientMediaSignalTransferSchema: JSONSchemaType<ClientMediaSignalTransfer>;
//# sourceMappingURL=transfer.d.ts.map