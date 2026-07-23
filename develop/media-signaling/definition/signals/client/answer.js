import { callAnswerList, callFeatureList } from '../../call/IClientMediaCall';
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
            enum: callAnswerList,
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
    required: ['callId', 'contractId', 'type', 'answer'],
};
//# sourceMappingURL=answer.js.map