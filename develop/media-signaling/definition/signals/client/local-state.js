export const clientMediaSignalLocalStateSchema = {
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
            const: 'local-state',
        },
        callState: {
            type: 'string',
            enum: ['none', 'ringing', 'accepted', 'active', 'renegotiating', 'hangup'],
            nullable: false,
        },
        clientState: {
            type: 'string',
            enum: [
                'none',
                'pending',
                'accepting',
                'accepted',
                'busy-elsewhere',
                'has-offer',
                'has-answer',
                'active',
                'renegotiating',
                'has-new-offer',
                'has-new-answer',
                'hangup',
            ],
            nullable: false,
        },
        serviceStates: {
            type: 'object',
            patternProperties: {
                '.*': {
                    type: 'string',
                },
            },
            nullable: true,
            required: [],
        },
        ignored: {
            type: 'boolean',
            nullable: true,
        },
        contractState: {
            type: 'string',
            enum: ['proposed', 'signed', 'pre-signed', 'self-signed', 'ignored'],
            nullable: false,
        },
        negotiationId: {
            type: 'string',
            nullable: true,
        },
    },
    additionalProperties: false,
    required: ['callId', 'contractId', 'type', 'callState', 'clientState', 'contractState'],
};
//# sourceMappingURL=local-state.js.map