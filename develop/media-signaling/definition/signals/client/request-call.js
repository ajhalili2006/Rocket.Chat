import { callFeatureList } from '../../call/IClientMediaCall';
export const clientMediaSignalRequestCallSchema = {
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
            const: 'request-call',
        },
        callee: {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    enum: ['user', 'sip'],
                    nullable: false,
                },
                id: {
                    type: 'string',
                    minLength: 1,
                    nullable: false,
                },
            },
            required: ['type', 'id'],
            additionalProperties: false,
        },
        supportedServices: {
            type: 'array',
            items: {
                type: 'string',
                enum: ['webrtc'],
                nullable: false,
            },
            nullable: false,
        },
        supportedFeatures: {
            type: 'array',
            items: {
                type: 'string',
                enum: callFeatureList,
                nullable: false,
            },
            nullable: true,
        },
    },
    additionalProperties: false,
    required: ['callId', 'contractId', 'type', 'callee', 'supportedServices'],
};
//# sourceMappingURL=request-call.js.map