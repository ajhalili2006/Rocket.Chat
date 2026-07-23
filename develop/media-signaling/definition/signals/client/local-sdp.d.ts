import type { JSONSchemaType } from 'ajv';
import type { MediaStreamIdentification } from '../../media/MediaStreamIdentification';
/** Client is sending the local session description to the server */
export type ClientMediaSignalLocalSDP = {
    callId: string;
    contractId: string;
    type: 'local-sdp';
    sdp: RTCSessionDescriptionInit;
    negotiationId: string;
    streams?: MediaStreamIdentification[];
};
export declare const clientMediaSignalLocalSDPSchema: JSONSchemaType<ClientMediaSignalLocalSDP>;
//# sourceMappingURL=local-sdp.d.ts.map