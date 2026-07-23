export declare const clientStateList: readonly ["none", "pending", "accepting", "waiting-for-track", "waiting-for-offer", "waiting-for-answer", "generating-local-sdp", "activating", "busy-elsewhere", "active", "renegotiating", "hangup"];
export type ClientState = (typeof clientStateList)[number];
export declare const clientContractStateList: readonly ["proposed", "signed", "pre-signed", "self-signed", "ignored"];
export type ClientContractState = (typeof clientContractStateList)[number];
export type RandomStringFactory = () => string;
//# sourceMappingURL=client.d.ts.map