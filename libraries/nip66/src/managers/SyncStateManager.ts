import { LocalStorageWrapper } from "@base/core/LocalStorageWrapper";
import { SyncKeys } from "@base/utils/SyncKeys";

export type SyncRange = { since?: number, until?: number } 

export type SyncRangeParameter = {
    kind: number,
    value: number
}

export class SyncStateManager {
    private keyHelper: SyncKeys;
    private localStorage: LocalStorageWrapper = new LocalStorageWrapper('monitor');
  
    constructor(private pubkey: string) {
      this.keyHelper = new SyncKeys(pubkey);
    }

    set lastSyncSince(rangeParameter: SyncRangeParameter) {
      this.setLastSync(rangeParameter.kind, 'since', rangeParameter.value);
    }
  
    set lastSyncUntil(rangeParameter: SyncRangeParameter) {
      this.setLastSync(rangeParameter.kind, 'until', rangeParameter.value);
    }

    setLastSync(kind: number, rangeKey: 'since' | 'until', value: number): void {
        const key = this.keyHelper.generateKey('lastSync', kind, rangeKey);
        this.localStorage.setItem(key, value.toString());
    }

    getLastSync(kind: number): SyncRange | undefined {
      const since = this.getLastSyncSince(kind);
      const until = this.getLastSyncUntil(kind);
      if(since || until){
        return {
          since,
          until
        };
      }
      return undefined;
    }
  
    getLastSyncSince(kind: number): number | undefined {
      return this.getLastSyncValue(kind, 'since');
    }
  
    getLastSyncUntil(kind: number): number | undefined {
      return this.getLastSyncValue(kind, 'until');
    }
  
    getLastSyncValue(kind: number, rangeKey: 'since' | 'until'): number | undefined {
        const key = this.keyHelper.generateKey('lastSync', kind, rangeKey);
        const returnedValue = this.localStorage.getItem(key);
        if(!returnedValue) return undefined;
        const value = parseInt(returnedValue);
        //console.log(`getLastSyncValue: ${key} -> ${returnedValue} === ${value}`);
        return value;
    }
  }