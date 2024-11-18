import { MonitorPriority, MonitorService, RelayService } from "@base/services";
import { LocalStorageWrapper } from "./LocalStorageWrapper";

const LOCALSTORAGE_PREFIX = 'sync'

export enum SyncStatus {
  Error = -1,
  Idle = 0,
  Syncing = 1,
  Synced = 10
}

export enum SyncStage {
  Init          = 0,
  SeedMonitors  = 1,
  SeedRelays    = 10,
  SeedMeta      = 20,
  SeedUptime    = 30,
  Seeded        = 100
}

export interface Nip66Services{
  relays: RelayService,
  monitors: MonitorService
}

export type SyncMethods = Record<SyncStage, () => void>;

export class Sync {
  private _status: SyncStatus = SyncStatus.Idle
  private _stage: SyncStage = SyncStage.Init 
  private _methods: SyncMethods = {} as SyncMethods
  private _services: Nip66Services;
  private ls: LocalStorageWrapper = new LocalStorageWrapper(LOCALSTORAGE_PREFIX)
  
  constructor(services: Nip66Services) {
    this._services = services
    this._status = this.ls.getItem('syncStatus', this._status) as SyncStatus
    this._stage = this.ls.getItem('syncStage', this._stage) as SyncStage
    this.registerMethods()
  }
  
  get services(): Nip66Services { 
    return this._services
  }

  get methods(): SyncMethods {
    return this._methods
  }

  get status(): SyncStatus {
    return this._status
  }

  set status(status: SyncStatus) {
    this._status = status
    this.ls.setItem('syncStatus', status)
  }

  get stage(): SyncStage {
    return this._stage
  }

  set stage(stage: SyncStage) {
    this._stage = stage
    this.ls.setItem('syncStage', stage)
  }

  is(key: SyncStage): boolean {
    return this.stage >= key
  }

  registerMethods(): void {
    this.methods[SyncStage.Init] = this._stage_init.bind(this)
    this.methods[SyncStage.SeedMonitors] = this._stage_seed_monitors.bind(this)
    this.methods[SyncStage.SeedRelays] = this._stage_seed_relays.bind(this)
    this.methods[SyncStage.SeedMeta] = this._stage_seed_meta.bind(this)
    this.methods[SyncStage.SeedUptime] = this._stage_seed_uptime.bind(this)
    this.methods[SyncStage.Seeded] = this._stage_seeded.bind(this)
  }

  async _stage_init(): Promise<void> {
    this.stage = SyncStage.Init
  }

  async _stage_seed_monitors(): Promise<void> {
    this.stage = SyncStage.SeedMonitors
    await this.services.monitors.bootstrapMonitors()
    await this.services.monitors.ensureMonitorsActive()
    await Promise.allSettled([
      this.services.monitors.bootstrapMonitorData(),
      // this.services.monitors.prioritizeMonitors(MonitorPriority.Checks)
      this.services.monitors.prioritizeMonitors()
    ])
  }

  async _stage_seed_relays(): Promise<void> {
    this.stage = SyncStage.SeedRelays
    await this.services.monitors.bootstrapMonitorChecks()
  }

  async _stage_seed_meta(): Promise<void> {
    this.stage = SyncStage.SeedMeta
  }

  async _stage_seed_uptime(): Promise<void> {
    this.stage = SyncStage.SeedUptime
  }

  async _stage_seeded(): Promise<void> {
    this.stage = SyncStage.Seeded
  }

  static stages(): [string, SyncStage][] {
    return Object.entries(SyncStage)
      .filter(([key, value]) => isNaN(Number(key)))
      .map(([key, value]) => [key, value as SyncStage] as [string, SyncStage])
      .sort((a, b) => a[1] - b[1]);
  }

  async run(): Promise<void> {
    this.status = SyncStatus.Syncing

    const stages = Sync.stages()
    for (const [key, value] of stages) {
      if (this.stage > value) continue
      const method = this.methods[value]
      if (method) {
        await method()
      } else {
        console.warn(`No method defined for stage: ${key}`)
      }
    }
    this.status = SyncStatus.Synced
  }
}