export class LocalStorageWrapper {
  private _prefix: string;
  private static TYPE_KEY_SUFFIX = ":_types";

  constructor(prefix: string | string[]) {
    this._prefix = '';
    this.prefix = prefix;
  }

  get prefix(): string {
    return this._prefix;
  }

  set prefix(prefix: string | string[]) {
    this._prefix = this.arrToString(prefix);
  }

  private formatKey(key: string | string[]): string {
    return `${this.prefix}:${this.arrToString(key)}`;
  }

  private arrToString(input: string | string[]): string {
    return Array.isArray(input) ? input.join(':') : input;
  }

  private getTypeKey(): string {
    return `${this.prefix}${LocalStorageWrapper.TYPE_KEY_SUFFIX}`;
  }

  private saveKeyType(key: string, type: string): void {
    const typeKey = this.getTypeKey();
    const types = JSON.parse(localStorage.getItem(typeKey) || '{}');
    types[key] = type;
    localStorage.setItem(typeKey, JSON.stringify(types));
  }

  private getKeyType(key: string): string | null {
    const typeKey = this.getTypeKey();
    const types = JSON.parse(localStorage.getItem(typeKey) || '{}');
    return types[key] || null;
  }

  setItem(key: string | string[], value: any): void {
    if (!localStorage) throw new Error('No localStorage found');
    const formattedKey = this.formatKey(key);

    let type = !value? 'null': typeof value;
    if (value === null || value === undefined) {
      value = null;
      type = 'null';
    } else if (type === 'object') {
      value = JSON.stringify(value); // Serialize objects and arrays
    } else if (type === 'boolean' || type === 'number') {
      value = value.toString(); // Store booleans and numbers as strings
    }

    this.saveKeyType(formattedKey, type);
    localStorage.setItem(formattedKey, value);
  }

  getItem(key: string | string[], _default?: any): any {
    if (!localStorage) throw new Error('No localStorage found');
    const formattedKey = this.formatKey(key);
    const item = localStorage.getItem(formattedKey);

    if (item === null || item === '') return _default;

    const type = this.getKeyType(formattedKey);
    switch (type) {
      case 'number':
        return Number(item);
      case 'boolean':
        return item === 'true';
      case 'object':
        try {
          return JSON.parse(item); // Parse objects and arrays
        } catch {
          return _default; // Fallback to default on parse failure
        }
      case 'null':
        return null;
      default:
        return item; // Return as-is for strings or unknown types
    }
  }

  removeItem(key: string | string[]): void {
    if (!localStorage) throw new Error('No localStorage found');
    const formattedKey = this.formatKey(key);
    localStorage.removeItem(formattedKey);

    const typeKey = this.getTypeKey();
    const types = JSON.parse(localStorage.getItem(typeKey) || '{}');
    delete types[formattedKey];
    localStorage.setItem(typeKey, JSON.stringify(types));
  }

  clear(): void {
    if (!localStorage) throw new Error('No localStorage found');
    localStorage.clear();
  }

  length(): number {
    if (!localStorage) throw new Error('No localStorage found');
    return localStorage.length;
  }

  key(index: number): string | null {
    if (!localStorage) throw new Error('No localStorage found');
    return localStorage.key(index);
  }
}
