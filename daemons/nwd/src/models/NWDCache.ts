import { NWDPlugin, PluginDataAccess } from './NWDPlugin'
import { PluginService } from '../services/PluginService'
import { IdentityService } from '../services/IdentityService'

export class NWDCache extends NWDPlugin {
  
  protected static _limit: number = 1;
  protected static _type: string = "cache";

  protected static _access: PluginDataAccess = { "identity": [ "pubkey" ] };
  // protected static _limit: number;
  // protected static _name: string;
  // protected static _version: string;

  constructor($PluginService: PluginService, $IdentityService: IdentityService) {
    super($PluginService, $IdentityService)
  }

  private _id(key: string): string{
    return `${this.service?.identity.pubkey.length(12)}:${this._class().type}:${key}`
  }

  public getLastCache(key: string): any {
    return this._getLastCache(key)
  }

  public setLastCache(key: string, value: any) {
    this._setLastCache(key, value)
  }

  public relayExists(relayUrl: string): boolean {
    const _record: string | undefined = this.relayGet(relayUrl)
    if(typeof _record !== 'undefined' ) return true
    return false
  }

  public relayGet(relay: string): string | undefined {
    return this._relayGet(relay)
  }

  public relayGetOnline(relay: string): string[] | undefined[] {
    return this._relayGetOnline(relay)  
  }

  public relayGetMeta(relay: string, key: string): string | undefined {
    return this._relayGetMeta(relay, key)
  }

  public relayInsert(relay: string, value: any){ 
    return this._relayInsert(relay)
  }

  public relayInsertIfNotExists( relay: string, value: any ): string | number | undefined {
    return !this.relayExists(relay)? this.relayInsert(relay, value): undefined
  }

  public relayUpsert(relay: string, value: any){
    if(this.relayExists(relay)) 
      return this?._relayUpdate(relay, value) 
    else
      return this?._relayInsert(relay, value)
  }

  public relayUpdate(){
    return this?._relayUpdate(relay, value)
  }

  public relayPatch(relay: string, value: any){
    return this?._relayPatch(relay, value)
  }

  //overloads 
  private _relayExists(relayUrl: string): boolean {}
  private _relayGet(relay: string): string | undefined {}
  private _relayGetOnline(relay: string): string[] | undefined[] {}
  private _relayGetMeta(relay: string): any | undefined {}
  private _relayInsert(relay: string, value: any): string | number | undefined {}
  private _relayInsertIfNotExists( relay: string, value: any ): string | number | undefined {}
  private _relayUpdate(): boolean {}
  private _relayPatch(relay: string, value: any): boolean {}
  private _relayDelete(): boolean {}
  private _relayDeleteIfExists(relay: string): boolean {}

  private _getLastCache(key: string): any {}
  private _setLastCache(key: string, value: any): any {}
}