export class Validator {
  private defaults: Record<string, any>;

  validate(key: string, value: any): void {
    if (typeof this.defaults?.[key] === 'undefined')
      throw new Error(`${this.constructor.name} does not have property '${key}'`);
    if (value && typeof this.defaults[key] !== typeof value)
      throw new Error(`${this.constructor.name} property ${key} is not of type ${typeof value}`);
  }

  _set(key: string, value: any): void {
    this.validate(key, value);
    this[key] = value;
  }

  setMany(obj: Record<string, any>): void {
    Object.keys(obj).forEach(key => {
      this._set(key, obj[key]);
    });
  }

  _get(key: string): any {
    this.validate(key);
    return this[key];
  }

  getMany(keys: string[]): Record<string, any> {
    return keys.reduce((acc, key) => {
      acc[key] = this._get(key);
      return acc;
    }, {});
  }

  _raw(keys: string[] | null = null): Record<string, any> {
    keys = keys || Object.keys(this);
    return { ...keys.reduce((acc, key) => {
      if (key !== 'defaults')
        acc[key] = this[key];
      return acc;
    }, {}) };
  }

  reset(initialValues: Record<string, any> = {}): void {
    Object.assign(this, this.defaults, initialValues);
  }
}