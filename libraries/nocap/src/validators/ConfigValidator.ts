import { Validator, IValidator } from '../classes/Validator';
import SampleEvent, { NostrEvent } from '../data/sample_event';

export interface IConfig {
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
  tor: Record<string, any>;
  adapterOptions: {
    websocket: Record<string, any>;
    info: Record<string, any>;
    geo: Record<string, any>;
    dns: Record<string, any>;
    ssl: Record<string, any>;
  };
  tooManyEventsLimit: number;
  autoDepsIgnoredInResult: boolean;
  removeFromResult: string[];
  failAllChecksOnConnectFailure: boolean;
  rejectOnConnectFailure: boolean;
  websocketAlwaysTerminate: boolean;
  event_sample: NostrEvent;
}

export const ConfigDefaults: IConfig = {
  logLevel: 'info',
  checked_by: '',
  timeout: {
    open: 5000,
    read: 5000,
    write: 5000,
    info: 5000,
    dns: 2000,
    geo: 1000,
    ssl: 1000,
  },
  tor: {},
  adapterOptions: {
    websocket: {},
    info: {},
    geo: {},
    dns: {},
    ssl: {},
  },
  tooManyEventsLimit: 10,
  autoDepsIgnoredInResult: true,
  removeFromResult: [],
  failAllChecksOnConnectFailure: true,
  rejectOnConnectFailure: false,
  websocketAlwaysTerminate: true,
  event_sample: SampleEvent
};

export interface ConfigValidatorInterface extends IValidator, IConfig {
  get(key: keyof IConfig): any;
  set(key: keyof IConfig, value: any): void;
  eq(key: keyof IConfig, value: any): boolean;
  gt(key: keyof IConfig, value: number): boolean;
  lt(key: keyof IConfig, value: number): boolean;
  is(key: keyof IConfig, value: any): boolean;
}

/**
 * ConfigValidator
 * 
 * @class
 * @classdesc Configuration class for Check
 * @param {object} config - The configuration object for the check
 */
export class ConfigValidator extends Validator implements ConfigValidatorInterface {
  logLevel!: string;
  checked_by!: string;
  timeout!: IConfig['timeout'];
  tor!: IConfig['tor'];
  adapterOptions!: IConfig['adapterOptions'];
  tooManyEventsLimit!: number;
  autoDepsIgnoredInResult!: boolean;
  removeFromResult!: string[];
  failAllChecksOnConnectFailure!: boolean;
  rejectOnConnectFailure!: boolean;
  websocketAlwaysTerminate!: boolean;
  event_sample: NostrEvent;

  defaults: Readonly<IConfig>;

  constructor(config: Partial<IConfig>) {
    super();
    // Merge defaults and runtime config
    Object.assign(this, ConfigDefaults, config);
    this.defaults = Object.freeze(ConfigDefaults);
  }

  get(key: keyof IConfig): any {
    return this._get(key);
  }

  set(key: keyof IConfig, value: any): void {
    this._set(key, value);
  }

  eq(key: keyof IConfig, value: any): boolean {
    return this._get(key) === value;
  }

  gt(key: keyof IConfig, value: number): boolean {
    try {
      return this._get(key) > value;
    } catch (e) {
      console.warn('The value of "key" (arg 1) and the value (arg 2) must both be numbers (int, float)');
      return false;
    }
  }

  lt(key: keyof IConfig, value: number): boolean {
    try {
      return this._get(key) < value;
    } catch (e) {
      console.warn('The value of "key" (arg 1) and the value (arg 2) must both be numbers (int, float)');
      return false;
    }
  }

  is(key: keyof IConfig, value: any): boolean {
    return this.eq(key, value);
  }
}
