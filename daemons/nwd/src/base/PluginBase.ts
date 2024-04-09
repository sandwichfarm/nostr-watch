import { PluginService } from '../services/PluginService'
import { IdentityService } from '../services/IdentityService'

import { CacheBase } from './CacheBase'
import { WorkerBase } from './WorkerBase'
import { SyncBase } from './SyncBase'
import { QueueBase } from './QueueBase'
import { QueueEventsBase } from './QueueEventsBase'



export type Plugin = CacheBase | WorkerBase | SyncBase | QueueBase | QueueEventsBase
export type PluginDataAccess { [key: string]: string[] }

export class PluginBase {
  
  protected static _limit: number;
  protected static _name: string;
  protected static _type: string;
  protected static _version: string;

  protected _$service: PluginService;
  private _$identity: IdentityService;

  private static _access: PluginDataAccess;

  constructor($PluginService: PluginService, $IdentityService: IdentityService){
    this.service = $PluginService
    this.identity = $IdentityService
  }

  setup(){

  }

  get service(): any {
    return this._$service
  }

  set service(pluginService: any){
    this._$service = pluginService
  }

  private get identity(): any {
    return this._$identity
  }

  private set identity(identityService: any){
    this._$identity = identityService
  }

  public static limit(): number{
    return this._limit
  }

  public static get type(): string{
    return this._type
  }

  private _class(): any {  
    return (<typeof PluginBase> this.constructor)
  }

  protected getIdentityValue(key: string): string | undefined {
    if(!this._class().restricted?.[key]) return undefined
    return this.identity?.[key]
  }
  
}a