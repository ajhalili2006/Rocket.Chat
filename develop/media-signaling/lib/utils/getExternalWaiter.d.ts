export type PromiseWaiterData = {
    done: boolean;
    promise: Promise<void>;
    promiseReject: (error: Error) => void;
    promiseResolve: () => void;
    timeout: ReturnType<typeof setTimeout> | null;
};
export type PromiseWaiterParams = {
    timeout?: number;
    timeoutFn?: () => void;
    cleanupFn?: () => void;
};
export declare function getExternalWaiter({ timeout, timeoutFn, cleanupFn }?: PromiseWaiterParams): PromiseWaiterData;
//# sourceMappingURL=getExternalWaiter.d.ts.map