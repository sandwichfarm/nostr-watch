import Deferred from 'promise-deferred';
import Logger from "@nostrwatch/logger";

export class DeferredWrapper {
  private promises: Record<string, Record<string, Deferred<any>>>;
  private timeout: any; // Assuming `timeout` has methods like `create`, `clear`, and `has`
  private $session: any; // Assuming `$session` has method `get`
  private logger: Logger;

  constructor($session: any, $timeout: any) {
    this.promises = {};
    this.timeout = $timeout;
    this.$session = $session;
    this.logger = new Logger(this.$session.url);
  }

  add(key: string, timeout: number, timeoutCb: (resolve: (value?: any) => void, reject: (reason?: any) => void) => void): Deferred<any> {
    const deferred = this.create(key);
    if (timeout) {
      this.timeout.create(key, timeout, () => {
        if (timeoutCb instanceof Function) {
          try {
            timeoutCb(deferred.resolve, deferred.reject);
          } catch (e) {
            this.logger.error(`error in timeout callback for ${key}: ${e.message}`);
          }
        } else {
          this.resolve(key, { status: "error", message: `timeout of ${timeout}ms exceeded for ${key}` });
        }
      });
    }
    return deferred;
  }

  async resolve(key: string, result: any): Promise<void> {
    this.logger.debug(`deferred:resolve("${key}")`, `has timeout: ${this.timeout.has(key)}`);
    if (this.timeout.has(key)) {
      this.timeout.clear(key);
    }
    return this.get(key).resolve(result);
  }

  reject(key: string, error: any): void {
    if (this.timeout.has(key)) {
      this.timeout.clear(key);
    }
    this.get(key).reject(error);
  }

  reflect(key: string): { state: { isFulfilled: boolean; isRejected: boolean; isPending: boolean }, reflectedPromise: Promise<any> } | false {
    const promise = this.get(key).promise;
    if (!promise)
      return false;
    const state = { isFulfilled: false, isRejected: false, isPending: true };
    const reflectedPromise = promise.then(
      (value) => { state.isFulfilled = true; state.isPending = false; return value; },
      (error) => { state.isRejected = true; state.isPending = false; throw error; }
    );
    return { state, reflectedPromise };
  }

  clearSessionPromises(_session?: any): void {
    const session = _session || this.session();
    if (this.promises?.[session])
      delete this.promises[session];
  }

  create(key: string): Deferred<any> {
    this.setup();
    this.promises[this.session()][key] = new Deferred();
    return this.get(key);
  }

  exists(key: string): boolean {
    this.logger.debug(`deferred:exists("${key}")`);
    return typeof this.promises?.[this.session()]?.[key] === 'object';
  }

  get(key: string): Deferred<any> {
    const session = this.session();
    const deferred = this.promises[session][key];
    this.logger.debug(`deferred:get("${key}"), exists: ${typeof deferred !== 'undefined'}`);
    return deferred;
  }

  setup(): void {
    if (!this.promises?.[this.session()])
      this.promises[this.session()] = {};
  }

  session(): string {
    return this.$session.get();
  }

  reset(): void {
    this.promises = {};
  }
}
