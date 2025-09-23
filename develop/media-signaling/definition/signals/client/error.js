export const clientMediaSignalErrorSchema = {
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
            const: 'error',
        },
        errorType: {
            type: 'string',
            enum: ['signaling', 'service', 'other'],
            nullable: true,
        },
        errorCode: {
            type: 'string',
            nullable: true,
        },
        negotiationId: {
            type: 'string',
            nullable: true,
        },
    },
    additionalProperties: false,
    required: ['callId', 'contractId', 'type'],
};
//# sourceMappingURL=error.js.map