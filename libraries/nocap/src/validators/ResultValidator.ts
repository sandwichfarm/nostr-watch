import { Validator, IValidator } from '../classes/Validator';
import { CheckKey, DurationCheckKey, StrictCheckKey } from '../types/CheckTypes';
import { IConfig } from './ConfigValidator';

export interface IResultData {
  data: null | boolean | any[] | Record<string, any>;
  duration: number;
  status?: string;
  message?: string;
}

type IResultCheck = IStrictKeyCheck & IDurationKeyCheck;

type IStrictKeyCheck = {
  [K in CheckKey]?: IResultData;
}

type IDurationKeyCheck = {
  [K in DurationCheckKey]?: number;
}

export interface IResult extends IResultCheck {
  url: string;
  network?: string;
  hostname?: string;
  protocol?: string;
  parent?:any | null;
  ignore?: boolean;
  adapters?: string[];
  checked_at?: number;
  checked_by?: string;
  audit?: any[];
  limits?: Record<string, any>;
}

const defaultResultData = { 
  data: null, 
  duration: -1 
}

export const ResultDefaults: IResult = {
  url: "",
  network: "",
  hostname: "",
  protocol: "",
  parent: null,
  ignore: false,
  adapters: [],
  checked_at: -1,
  checked_by: "",
  audit: [],
  open: defaultResultData,
  read: defaultResultData,
  write: defaultResultData,
  info: defaultResultData,
  dns: defaultResultData,
  geo: defaultResultData,
  ssl: defaultResultData,
  limits: {},
};

export interface ResultValidatorInterface extends IValidator {
  cleanResult(k: keyof IResult | string[], result?: Record<string, any>, ignore?: string[]): Record<string, any>;
  removeFromResult(remove?: string[]): Record<string, any> | undefined;
  get(key: keyof IResult): any;
  set(key: keyof IResult, value: any): void;
  did(key: 'open' | 'read' | 'write'): any;
  get_ip(protocol?: string): any;
  get_ips(protocol?: string): any[];
  raw(keys: string[], ignore?: string[]): Record<string, any>;
}

export class ResultValidator extends Validator implements ResultValidatorInterface {
  defaults: Readonly<IResult>;
  header_keys: string[];

  constructor() {
    super();
    Object.assign(this, ResultDefaults);
    this.header_keys = ['url', 'network', 'hostname', 'protocol', 'parent', 'ignore', 'adapters', 'checked_at', 'checked_by'];
    this.defaults = Object.freeze(ResultDefaults);
  }

  cleanResult(k: keyof IResult | string[], result: Record<string, any> = {}, ignore: string[] = []): Record<string, any> {
    if (typeof k === 'string') {
      const { data, duration } = this.get(k as keyof IResult); 
      result = { [k]: data, [`${k}_duration`]: duration };
      return result;
    } else {
      result = {};
      for (const key of k) {
        if (ignore.includes(key)) continue;
        const { data, duration } = this.get(key as keyof IResult);
        result = { ...result, [key]: data, [`${key}_duration`]: duration };
      }
    }
    return result;
  }

  removeFromResult(remove: string[] = []): Record<string, any> | undefined {
    if (!remove.length) return;
    const result = { ...this.defaults }; 
    for (const key of remove) {
      const durationKey: DurationCheckKey = `${key as StrictCheckKey}_duration`;
      delete result[key as StrictCheckKey]; 
      delete result[durationKey];
    }
    return result;
  }

  get(key: keyof IResult): any {
    return this._get(key); 
  }

  set(key: keyof IResult, value: any): void {
    return this._set(key, value);
  }

  did(key: 'open' | 'read' | 'write'): any {
    return this.get(key).data;
  }

  get_ip(protocol: string = 'ipv4'): any {
    return ResultValidator.getIp(this.get('dns'), protocol);
  }

  get_ips(protocol: string = 'ipv4'): any[] {
    return ResultValidator.getIps(this.get('dns'), protocol);
  }

  raw(keys: string[], ignore: string[] = []): Record<string, any> {
    keys = keys.filter((key) => !ignore.includes(key));
    return this._raw([...this.header_keys, ...keys]);
  }

  static getIp(dns: any, protocol: string): any {
    const answer = ResultValidator.getIps(dns, protocol);
    return answer?.[0] || null;
  }

  static getIps(dns: any, protocol: string): any[] {
    const answer = dns?.raw?.data?.Answer;
    if (!answer || !answer.length) return [];
    const regex: Record<string, RegExp> = {
      ipv4: /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
      ipv6: /(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))/,
    };
    return answer.filter((answer: any) => regex[protocol.toLowerCase()].test(answer.data)).map((answer: any) => answer.data) || null;
  }
}
