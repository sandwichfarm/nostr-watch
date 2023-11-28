export class Validator {
  protected defaults: { [key: string]: any }; // TODO: Define a more specific type

  setDefaults(defaults: { [key: string]: any }): void {
    this.defaults = defaults;
  }
  
  validate(key: string, value?: any): void {
    if (typeof this.defaults?.[key] === 'undefined') {
      throw new Error(`${this.constructor.name} does not have property '${key}'`);
    }
    if (value !== undefined && value !== null && typeof this.defaults[key] !== typeof value) {
      throw new Error(`${this.constructor.name} property ${key} is not of type ${typeof value}`);
    }
  }

  set(key: string, value: any): void {
    this.validate(key, value);
    this[key as keyof this] = value;
  }

  get(key: string): any {
    this.validate(key);
    return this[key as keyof this];
  }

  setMany(obj: { [key: string]: any }): void {
    Object.keys(obj).forEach(key => {
      this.set(key, obj[key]);
    });
  }

  dump(): { [key: string]: any } {
    return { ...Object.keys(this.defaults).reduce((acc, key) => {
      acc[key] = this[key as keyof this];
      return acc;
    }, {} as { [key: string]: any }) };
  }
}
