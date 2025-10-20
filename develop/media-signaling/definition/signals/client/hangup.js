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
            enum: [
                'normal',
                'remote',
                'rejected',
                'unavailable',
                'transfer',
                'timeout',
                'signaling-error',
                'service-error',
                'media-error',
                'input-error',
                'error',
                'unknown',
                'another-client',
            ],
            nullable: false,
        },
    },
    additionalProperties: false,
    required: ['callId', 'contractId', 'type', 'reason'],
};
//# sourceMappingURL=hangup.js.map