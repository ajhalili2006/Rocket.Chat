import { Ajv } from 'ajv';
import { clientMediaSignalAnswerSchema } from './answer';
import { clientMediaSignalDTMFSchema } from './dtmf';
import { clientMediaSignalErrorSchema } from './error';
import { clientMediaSignalHangupSchema } from './hangup';
import { clientMediaSignalLocalSDPSchema } from './local-sdp';
import { clientMediaSignalLocalStateSchema } from './local-state';
import { clientMediaSignalNegotiationNeededSchema } from './negotiation-needed';
import { clientMediaSignalRegisterSchema } from './register';
import { clientMediaSignalRequestCallSchema } from './request-call';
import { clientMediaSignalTransferSchema } from './transfer';
const ajv = new Ajv({ discriminator: true });
export const clientMediaSignalSchema = {
    type: 'object',
    additionalProperties: true,
    discriminator: { propertyName: 'type' },
    required: ['type'],
    oneOf: [
        clientMediaSignalLocalSDPSchema,
        clientMediaSignalErrorSchema,
        clientMediaSignalAnswerSchema,
        clientMediaSignalHangupSchema,
        clientMediaSignalDTMFSchema,
        clientMediaSignalRequestCallSchema,
        clientMediaSignalLocalStateSchema,
        clientMediaSignalRegisterSchema,
        clientMediaSignalNegotiationNeededSchema,
        clientMediaSignalTransferSchema,
    ],
};
export const isClientMediaSignal = ajv.compile(clientMediaSignalSchema);
//# sourceMappingURL=MediaSignal.js.map