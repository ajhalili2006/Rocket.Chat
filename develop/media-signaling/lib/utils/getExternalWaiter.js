export function getExternalWaiter({ timeout, timeoutFn, cleanupFn } = {}) {
    const data = {
        timeout: null,
        done: false,
    };
    const flagAsDone = () => {
        if (data.done) {
            return;
        }
        if (data.timeout) {
            clearTimeout(data.timeout);
            data.timeout = null;
        }
        data.done = true;
        cleanupFn === null || cleanupFn === void 0 ? void 0 : cleanupFn();
    };
    data.promise = new Promise((resolve, reject) => {
        data.promiseResolve = () => {
            if (data.done) {
                return;
            }
            flagAsDone();
            resolve();
        };
        data.promiseReject = (error) => {
            if (data.done) {
                return;
            }
            flagAsDone();
            reject(error);
        };
    });
    if (timeout) {
        data.timeout = setTimeout(() => {
            data.timeout = null;
            if (data.done) {
                return;
            }
            if (timeoutFn) {
                timeoutFn();
            }
            if (data.promiseReject && !data.done) {
                data.promiseReject(new Error('timeout'));
            }
        }, timeout);
    }
    return data;
}
//# sourceMappingURL=getExternalWaiter.js.map