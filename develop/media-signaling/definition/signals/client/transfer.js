export const clientMediaSignalTransferSchema = {
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
            const: 'transfer',
        },
        to: {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    enum: ['user', 'sip'],
                    nullable: false,
                },
                id: {
                    type: 'string',
                    nullable: false,
                    minLength: 1,
                },
            },
            required: ['type', 'id'],
            additionalProperties: false,
        },
    },
    additionalProperties: false,
    required: ['callId', 'contractId', 'type', 'to'],
};
//# sourceMappingURL=transfer.js.map