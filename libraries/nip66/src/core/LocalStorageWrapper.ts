let localStorage: Storage | undefined;

(async () => {
  if (typeof window === "undefined") {
    const { LocalStorage } = await import('node-localstorage');
    localStorage = new LocalStorage('./@nostrwatch/nip66');
  } else {
    // Use the browser's localStorage
    localStorage = window.localStorage;
  }
})

export class LocalStorageWrapper {
  private _prefix: string

  constructor(prefix: string | string[]) {
    this._prefix = '';
    this.prefix = prefix
  }

  get prefix(): string {
    return this._prefix
  }

  set prefix(prefix: string | string[]) {
    this._prefix = this.arrToString(prefix);
  }

  private formatKey(key: string | string[]): string {
    return `${this.prefix}:${this.arrToString(key)}`
  }

  private arrToString(input: string | string[]): string {
    return Array.isArray(input) ? input.join(':') : input
  }

  setItem(key: string | string[], value: any): void {  
    if(!localStorage) throw new Error('No localStorage found')
    key = this.formatKey(key)
    localStorage.setItem(key, value)
  }

  getItem(key: string | string[], _default?: any): any {
    if(!localStorage) throw new Error('No localStorage found')
    key = this.formatKey(key)
    const item = localStorage.getItem(key)
    if(item === '' || null) return _default;
    return item?.split(':')[1]
  }

  removeItem(key:  string | string[]): void {
    if(!localStorage) throw new Error('No localStorage found')
    try {
      key = this.formatKey(key)
      localStorage.removeItem(key)
    }
    catch(e) {
      console.error(e)
    }
  }

  clear(): void {
    if(!localStorage) throw new Error('No localStorage found')
    localStorage.clear()
  }

  length(): number {  
    if(!localStorage) throw new Error('No localStorage found')
    return localStorage.length
  }

  key(index: number): string | null {  
    if(!localStorage) throw new Error('No localStorage found')
    return localStorage.key(index)
  }

}