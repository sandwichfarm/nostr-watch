import Deferred from 'promise-deferred';
import Logger from "@nostrwatch/logger";

export class DeferredWrapper {
  promises: Record<string, Record<string, InstanceType<typeof Deferred>>>; 
  timeout: any;
  $session: any;
  logger: Logger;

  constructor($session: any, $timeout: any) {
    this.promises = {};
    this.timeout = $timeout;
    this.$session = $session;
    this.logger = new Logger(`@nostrwatch/nocap::Deferred: ${this.$session.url}`);
  }

  add(key: string, timeout: number, timeoutCb: (resolve: Function, reject: Function) => void) {
    const deferred = this.create(key);
    if (timeout) {
      this.timeout.create(key, timeout, () => {
        if (timeoutCb instanceof Function) {
          try {
            timeoutCb(deferred.resolve.bind(deferred), deferred.reject.bind(deferred));
          } catch (e) {
            this.logger.err(`error in timeout callback for ${key}: ${(e as Error).message}`);
          }
        } else {
          this.resolve(key, { status: "error", message: `timeout of ${timeout}ms exceeded for ${key}` });
        }
      });
    }
    return deferred;
  }

  async resolve(key: string, result: any) {
    // this.logger.debug(`deferred:resolve("${key}"): has timeout: ${this.timeout.has(key)}`);
    if (this.timeout.has(key)) this.timeout.clear(key);
    return this.get(key).resolve(result);
  }

  reject(key: string, error: any) {
    if (this.timeout.has(key)) this.timeout.clear(key);
    this.get(key).reject(error);
  }

  reflect(key: string) {
    const deferred = this.get(key);
    if (!deferred?.promise) return false;
    const settledState = deferred._state || 'pending';
    const state = {
      isFulfilled: settledState === 'fulfilled',
      isRejected: settledState === 'rejected',
      isPending: settledState === 'pending',
    };
    return { state, reflectedPromise: deferred.promise };
  }

  clearSessionPromises(_session?: string) {
    const session = _session || this.session;
    if (this.promises?.[session]) delete this.promises[session];
  }

  create(key: string) {
    this.setup();
    const deferred = new Deferred();
    deferred._state = 'pending';
    const origResolve = deferred.resolve.bind(deferred);
    const origReject = deferred.reject.bind(deferred);
    deferred.resolve = (...args: any[]) => {
      deferred._state = 'fulfilled';
      return origResolve(...args);
    };
    deferred.reject = (...args: any[]) => {
      deferred._state = 'rejected';
      return origReject(...args);
    };
    this.promises[this.session][key] = deferred;
    return this.get(key);
  }

  exists(key: string) {
    this.logger.debug(`deferred:exists("${key}")`);
    return typeof this.promises?.[this.session]?.[key] === 'object';
  }

  get(key: string) {
    const deferred = this.promises[this.session][key];
    this.logger.debug(`deferred:get("${key}"), exists: ${typeof deferred !== 'undefined'}`);
    return deferred;
  }

  setup() {
    if (!this.promises?.[this.session]) this.promises[this.session] = {};
  }

  get session() {
    return this.$session.get();
  }

  reset() {
    this.promises = {};
  }
}
