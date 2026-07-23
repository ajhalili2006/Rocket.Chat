import { callHangupReasonList } from '../../call';
export const clientMediaSignalHangupSchema = {
    type: 'object',
    properties: {
        callId: {
            type: 'string',
            nullable: false,
            minLength: 1,
        },
        contractId: {
            type: 'string',
            nullable: false,
            minLength: 1,
        },
        type: {
            type: 'string',
            const: 'hangup',
        },
        reason: {
            type: 'string',
            enum: callHangupReasonList,
            nullable: false,
        },
    },
    additionalProperties: false,
    required: ['callId', 'contractId', 'type', 'reason'],
};
//# sourceMappingURL=hangup.js.map