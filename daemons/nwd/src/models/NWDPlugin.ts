// import { NWDCache } from './NWDCache'
// import { WorkerBase } from './WorkerBase'
// import { SyncBase } from './NWDSync'
// import { QueueBase } from './NWDQueue'
// import { QueueEventsBase } from './QueueEventsBase'

// export type Plugin = CacheBase | WorkerBase | SyncBase | QueueBase | QueueEventsBase
export type PluginDataAccess { [key: string]: string[] }

export class NWDPlugin {
  
  protected static _limit: number;
  protected static _name: string;
  protected static _type: string;
  protected static _version: string;
  protected static _requires: string[] = [];

  protected _service: PluginService;

  protected static _access: PluginDataAccess;

  constructor(){}

  setup(){

  }

  get requires(): string[] {
    return this._class()._requires
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

  get limit(): number{
    return this._class()._limit
  }

  public static get type(): string{
    return this._type
  }

  protected _class(): any {  
    return (<typeof NWDPlugin> this.constructor)
  }

  protected getIdentityValue(key: string): string | undefined {
    if(!this._class().restricted?.[key]) return undefined
    return this.identity?.[key]
  }

  protected get services(): NWD {
    const access = this._class().access
    const services:  = this.service
    const filtered = {}
    Object.keys(services).forEach((service: string) => {
      if(access[service]) filtered[service] = services[service]
    })
    return filtered
  }
  
}a