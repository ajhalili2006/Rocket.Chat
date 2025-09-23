export const clientMediaSignalAnswerSchema = {
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
            const: 'answer',
        },
        answer: {
            type: 'string',
            enum: ['accept', 'reject', 'ack', 'unavailable'],
            nullable: false,
        },
    },
    additionalProperties: false,
    required: ['callId', 'contractId', 'type', 'answer'],
};
//# sourceMappingURL=answer.js.map