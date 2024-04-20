type CheckResult = {
  data: any;
  duration: number
}

interface ResultDefaults {
  url: string;
  network: string;
  adapters: string[];
  checked_at: number;
  checked_by: string;
  open: CheckResult;
  read: CheckResult;
  write: CheckResult;
  info: CheckResult;
  dns: CheckResult;
  geo: CheckResult;
  ssl: CheckResult;
}

export const checkDefaults: CheckResult = {
  data: {},
  duration: -1
}

export const resultDefaults: ResultDefaults = {
  url: "",
  network: "",
  adapters: [],
  checked_at: -1,
  checked_by: "",
  open: checkDefaults,
  read: checkDefaults,
  write: checkDefaults,
  info: checkDefaults,
  dns: checkDefaults,
  geo: checkDefaults,
  ssl: checkDefaults
};

export class ResultInterface extends Validator {
  private header_keys: string[];
  private defaults: ResultDefaults;

  constructor() {
    super();
    Object.assign(this, resultDefaults);
    this.defaults = Object.freeze(resultDefaults);
    this.header_keys = ['url', 'network', 'adapters', 'checked_at', 'checked_by'];
  }

  cleanResult(keys: string | string[], result: any = {}, ignore: string[] = []): any {
    if (typeof keys === 'string') {
      const { data, duration } = this.get(keys);
      result = { [keys]: data, [`${keys}_duration`]: duration };
      return result;
    } else {
      result = {};
      for (const key of keys) {
        if (ignore.includes(key)) continue;
        const { data, duration } = this.get(key);
        result = { ...result, [key]: data, [`${key}_duration`]: duration };
      }
    }
    return result;
  }

  removeFromResult(remove: string[] = []): any {
    if (!remove.length) return;
    const result: any = { ...this };
    for (const key of remove) {
      delete result[key];
      delete result[`${key}_duration`];
    }
    return result;
  }

  get(key: keyof ResultDefaults): any {
    return this._get(key);
  }

  set(key: keyof ResultDefaults, value: any): void {
    this._set(key, value);
  }

  did(key: 'open' | 'read' | 'write'): any {
    switch (key) {
      case 'open':
      case 'read':
      case 'write':
        return this.get(key).data;
    }
  }

  get_ip(protocol: 'ipv4' | 'ipv6' = 'ipv4'): string | null {
    return ResultInterface.getIp(this.get('dns'), protocol);
  }

  get_ips(protocol: 'ipv4' | 'ipv6' = 'ipv4'): string[] {
    return ResultInterface.getIps(this.get('dns'), protocol);
  }

  raw(keys: string[], ignore: string[] = []): any {
    keys = keys.filter(key => !ignore.includes(key));
    return this._raw([...this.header_keys, ...keys]);
  }

  static getIp(dns: any, protocol: 'ipv4' | 'ipv6'): string | null {
    const answer = ResultInterface.getIps(dns, protocol);
    return answer?.[0] || null;
  }

  static getIps(dns: any, protocol: 'ipv4' | 'ipv6'): string[] {
    const answer = dns?.raw?.data?.Answer;
    if (!answer || !answer.length)
      return [];
    const regex = {
      ipv4: /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
      ipv6: /(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))/
    };
    return answer.filter(answer => regex[protocol.toLowerCase()].test(answer.data)).map(answer => answer.data) || [];
  }
}