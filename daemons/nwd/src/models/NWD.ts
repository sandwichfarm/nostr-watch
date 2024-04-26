
import { Config } from '../types/Config'

import { Cron } from '../helpers/Cron'

import { PluginService, CacheService, IdentityService, SigningService, QueueService, WorkerService, SyncService } from '../services/All'

export type NWDServices = {
  plugin: PluginService,
  identity: IdentityService,
  signing: SigningService,
  queue: QueueService,
  worker: WorkerService,
  cache: CacheService,
  sync: SyncService
}

export class NWD {

  private _config: Config;
  private _service: NWDServices;
  private _services: any[] = [PluginService, IdentityService, SigningService, QueueService, WorkerService, CacheService, SyncService]  
  
  protected cron: Cron

  constructor(config: Config){
    this.config = config;
  }

  private _init(){
    this.cron = new Cron();
    this._init_services(); 
    this._init_plugins();
  }

  private _init_services(){
    this._services.forEach((Service: any) => {
      this.service[Service.type] = new Service(this);
    })
    this.populate = this.service.plugin.populate.bind(this.service)
    this.syncIn = this.service.sync.in.bind(this.service)
  }

  private _init_plugins(){
    this.service.plugin.init();
  }
  public run(){
    this._init();  
    this.schedule();
    this.populate();
    this.syncIn();
    this.start();
  }

  private schedule(){
    const populateInterval = this.service.plugin.plugins.queue.populateInterval
    const syncInInterval = this.service.plugin.sync.inInterval
    this.cron.add(`*/${populateInterval} * * * * *`, populator)
    this.cron.add(`*${syncInInterval} * * * * *`, syncIn)
  }

  private set service(service: any){
    this._service = service
  }

  private get service(): any {
    return this._service
  }

  protected set config (config: Config){
    this._config = config
  }

  public get config(): Config {
    return this._config
  }
}

