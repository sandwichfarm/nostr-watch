import Deferred from 'promise-deferred'

interface DeferredMap {
  [key: string]: Deferred;
}

export class DeferredWrapper {
  private promises: Record<string, DeferredMap>;
  private timeout: any; // TODO: Define specific type for $timeout
  private $session: any; // TODO: Define specific type for $session

  constructor($session: any, $timeout: any) {
    this.promises = {};
    this.timeout = $timeout;
    this.$session = $session;
  }

  add(key: string, timeout?: number, timeoutCb?: () => void): Promise<any> {
    this.create(key);
    if (timeout) {
      this.timeout.create(key, timeout, () => {
        this.reject(key, { timeout: true });
        if (timeoutCb instanceof Function) {
          try {
            timeoutCb();
          } catch (e: any) { // TODO: Define specific error type if available
            this.logger.error(`error in timeout callback for ${key}: ${e.message}`);
          }
        }
      });
    }
    return this.get(key).promise;
  }

  resolve(key: string, result: any): void { // TODO: Define specific type for result
    if (this.timeout.has(key))
      clearTimeout(this.timeout.get(key));
    this.get(key).resolve(result);
  }

  reject(key: string, error: any): void { // TODO: Define specific type for error
    if (this.timeout.has(key))
      clearTimeout(this.timeout.get(key));
    this.get(key).reject(error);
  }

  reflect(key: string): { state: any, reflectedPromise: Promise<any> } { // TODO: Define specific type for state
    const promise = this.get(key).promise;
    const state = { isFulfilled: false, isRejected: false, isPending: true };
    const reflectedPromise = promise
      .then(
        (value: any) => { state.isFulfilled = true; state.isPending = false; return value; },
        (error: any) => { state.isRejected = true; state.isPending = false; throw error; }
      );
    return { state, reflectedPromise };
  }

  clearSessionPromises(_session?: any): void { // TODO: Define specific type for _session
    const session = _session || this.session();
    if (this.promises[session])
      delete this.promises[session];
  }

  create(key: string): void {
    this.setup();
    this.promises[this.session()][key] = new Deferred();
  }

  get(key: string): Deferred {
    return this.promises[this.session()][key];
  }

  setup(): void {
    if (!this.promises[this.session()])
      this.promises[this.session()] = {};
  }

  session(): string { // Assuming session() returns a string
    return this.$session.get();
  }

  reset(): void {
    this.promises = {};
  }
}
