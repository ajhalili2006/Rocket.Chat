import type { JSONSchemaType } from 'ajv';
/** Client is reporting they need a new service negotiation */
export type ClientMediaSignalNegotiationNeeded = {
    callId: string;
    type: 'negotiation-needed';
    contractId: string;
    oldNegotiationId: string;
};
export declare const clientMediaSignalNegotiationNeededSchema: JSONSchemaType<ClientMediaSignalNegotiationNeeded>;
//# sourceMappingURL=negotiation-needed.d.ts.map