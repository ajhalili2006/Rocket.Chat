export const clientMediaSignalDTMFSchema = {
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
            const: 'dtmf',
        },
        dtmf: {
            type: 'string',
            nullable: false,
            minLength: 1,
        },
        duration: {
            type: 'number',
            nullable: true,
        },
    },
    additionalProperties: false,
    required: ['callId', 'contractId', 'type', 'dtmf'],
};
//# sourceMappingURL=dtmf.js.map