import { callStateList } from '../../call';
import { clientContractStateList, clientStateList } from '../../client';
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
            enum: callStateList,
            nullable: false,
        },
        clientState: {
            type: 'string',
            enum: clientStateList,
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
            enum: clientContractStateList,
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