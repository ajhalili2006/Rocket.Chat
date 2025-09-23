export const clientMediaSignalRegisterSchema = {
    type: 'object',
    properties: {
        contractId: {
            type: 'string',
            nullable: false,
            minLength: 1,
        },
        type: {
            type: 'string',
            const: 'register',
        },
        oldContractId: {
            type: 'string',
            nullable: true,
        },
    },
    additionalProperties: false,
    required: ['contractId', 'type'],
};
//# sourceMappingURL=register.js.map