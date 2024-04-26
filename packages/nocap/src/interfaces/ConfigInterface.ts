import { Validator } from '../classes/Validator.ts';

interface ConfigDefaults {
  logLevel: string;
  checked_by: string;
  timeout: {
    open: number;
    read: number;
    write: number;
    info: number;
    dns: number;
    geo: number;
    ssl: number;
  };
  tor: Record<string, unknown>;
  adapterOptions: {
    websocket: Record<string, unknown>;
    info: Record<string, unknown>;
    geo: Record<string, unknown>;
    dns: Record<string, unknown>;
    ssl: Record<string, unknown>;
  };
  autoDepsIgnoredInResult: boolean;
  removeFromResult: string[];
  failAllChecksOnConnectFailure: boolean;
  rejectOnConnectFailure: boolean;
  websocketAlwaysTerminate: boolean;
}

export const ConfigDefaults: ConfigDefaults = {
  logLevel: 'info',
  checked_by: '',
  timeout: {
    open: 10000,
    read: 10000,
    write: 10000,
    info: 10000,
    dns: 5000,
    geo: 5000,
    ssl: 5000,
  },
  tor: {},
  adapterOptions: {
    websocket: {},
    info: {},
    geo: {},
    dns: {},
    ssl: {}
  },
  autoDepsIgnoredInResult: true,
  removeFromResult: [],
  failAllChecksOnConnectFailure: true,
  rejectOnConnectFailure: false,
  websocketAlwaysTerminate: true
};

/**
 * ConfigInterface 
 * Configuration class for Check
 */
export class ConfigInterface extends Validator {
  private defaults: ConfigDefaults;

  constructor(config: Partial<ConfigDefaults>) {
    super();
    Object.assign(this, ConfigDefaults, config);
    this.defaults = Object.freeze(ConfigDefaults);
  }

  get(key: keyof ConfigDefaults): any {
    return this._get(key);
  }

  set(key: keyof ConfigDefaults, value: any): void {
    this._set(key, value);
  }

  eq(key: keyof ConfigDefaults, value: any): boolean {
    return this.get(key) === value;
  }

  gt(key: keyof ConfigDefaults, value: any): boolean {
    try {
      return this.get(key) > value;
    } catch (e) {
      console.warn(`the value of "${key}" (arg 1) and the value (arg 2) must both be numbers (int, float)`);
    }
  }

  lt(key: keyof ConfigDefaults, value: any): boolean {
    try {
      return this.get(key) < value;
    } catch (e) {
      console.warn(`the value of "${key}" (arg 1) and the value (arg 2) must both be numbers (int, float)`);
    }
  }

  is(key: keyof ConfigDefaults, value: any): boolean {
    return this.eq(key, value);
  }
}
