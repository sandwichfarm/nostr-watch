if (!window || typeof localStorage === "undefined" || localStorage === null) {
  var LocalStorage = require('node-localstorage').LocalStorage;
  localStorage = new LocalStorage('@nostrwatch/nip66');
}

export class LocalStorageWrapper {
  constructor(private prefix: string) {}

  setItem(key: string, value: any): void {  
    localStorage.setItem(`${this.prefix}:${key}`, value)
  }

  getItem(key: string, _default?: any): any {
    const item = localStorage.getItem(`${this.prefix}:${key}`)
    if(item === '' || null) return _default;
    return item?.split(':')[1]
  }

  removeItem(key: string): void {
    localStorage.removeItem(key)
  }

  clear(): void {
    localStorage.clear()
  }

  length(): number {  
    return localStorage.length
  }

  key(index: number): string | null {  
    return localStorage.key(index)
  }

}