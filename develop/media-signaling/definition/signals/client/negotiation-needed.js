export const clientMediaSignalNegotiationNeededSchema = {
    type: 'object',
    properties: {
        callId: {
            type: 'string',
            nullable: false,
        },
        contractId: {
            type: 'string',
            nullable: false,
        },
        type: {
            type: 'string',
            const: 'negotiation-needed',
        },
        oldNegotiationId: {
            type: 'string',
            nullable: false,
        },
    },
    additionalProperties: false,
    required: ['callId', 'contractId', 'type', 'oldNegotiationId'],
};
//# sourceMappingURL=negotiation-needed.js.map