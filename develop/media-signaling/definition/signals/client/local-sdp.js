export const clientMediaSignalLocalSDPSchema = {
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
            const: 'local-sdp',
        },
        sdp: {
            type: 'object',
            properties: {
                sdp: {
                    type: 'string',
                    nullable: true,
                },
                type: {
                    type: 'string',
                    enum: ['offer', 'answer', 'pranswer', 'rollback'],
                    nullable: false,
                },
            },
            additionalProperties: false,
            nullable: false,
            required: ['type'],
        },
        negotiationId: {
            type: 'string',
            nullable: false,
        },
        streams: {
            type: 'array',
            nullable: true,
            items: {
                type: 'object',
                properties: {
                    tag: {
                        type: 'string',
                        minLength: 1,
                    },
                    id: {
                        type: 'string',
                        minLength: 1,
                    },
                },
                additionalProperties: false,
                required: ['tag', 'id'],
            },
        },
    },
    additionalProperties: false,
    required: ['callId', 'contractId', 'type', 'sdp', 'negotiationId'],
};
//# sourceMappingURL=local-sdp.js.map