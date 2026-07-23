import type { ClientState } from '../client';
import type { CallState } from './IClientMediaCall';
export type CallEvents = {
    stateChange: CallState;
    clientStateChange: ClientState;
    trackStateChange: void;
    contactUpdate: void;
    initialized: void;
    confirmed: void;
    accepting: void;
    accepted: void;
    active: void;
    hidden: void;
    ended: void;
    screenShareRequestChange: boolean;
    streamChange: void;
};
//# sourceMappingURL=CallEvents.d.ts.map