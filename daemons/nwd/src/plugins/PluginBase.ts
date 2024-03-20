import { PluginService } from '../services/PluginService'

import { CacheBase } from './CacheBase'
import { WorkerBase } from './WorkerBase'
import { SyncBase } from './SyncBase'
import { QueueBase } from './QueueBase'
import { QueueEventsBase } from './QueueEventsBase'

type Plugin = CacheBase | WorkerBase | SyncBase | QueueBase | QueueEventsBase

export class PluginBase {
  
  protected static _limit: number;
  protected static _name: string;
  protected static _version: string;

  protected _$service: PluginService;

  constructor($PluginService: PluginService){
    this.service = $PluginService
  }

  setup(){

  }

  get service(): any {
    return this._$service
  }

  set service(pluginService: any){
    this._$service = pluginService
  }

  public static limit(): number{
    return this._limit
  }

  private _class(): any {  
    return (<typeof PluginBase> this.constructor)
  }
  
}