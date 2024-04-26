import { NWD } from './NWD'

export class NWDService {
  
  private _plugins: any = {}
  private _pluginInstances: any = {}
  private _pluginTypeCounts: TypeCounts = {}  
  private _pluginRequirements: PluginRequirements = {}

  protected $: NWD

  constructor($nwd: NWD){
    this.$ = $nwd
  }

  get instances(): any {
    return this._pluginInstances
  }

  get totalInstances(): number {
    return Object.keys(this._pluginInstances).length
  }

  get plugins(): any {
    return this._plugins
  }

  get active(): string[] {
    return Object.keys(this._plugins)
  }

  get plugin(plugin: string): any | null {
    return this._plugins?.[plugin] || null
  }

  get typeCounts(): TypeCounts {
    return this._pluginTypeCounts
  }

  get typeCount(): TypeCounts {
    return this.typeCounts || {} as TypeCounts
  }

  set typeCount( type: TypeCounts ){
    this._pluginTypeCounts = {...this.typeCounts, ...type}
  }

  set typeCountIncrement( type: PluginType ){
    this._pluginTypeCounts[type] = this.typeCount[type] + 1
  }

  set typeCountDecrement( type: PluginType ){
    this._pluginTypeCounts[type] = this.typeCount[type] - 1
  }

  get pluginInstances(): any {
    return this._pluginInstances
  }

  get pluginsByType(type: PluginType ): any {  
    return Object.keys(this._plugins).filter((plugin: string) => this._plugins[plugin].type === type)
  }

  protected _add_plugin(Plugin: any): void{
    const name = Plugin.name
    const type = Plugin.type as PluginType
    
    if(this._plugin_active(Plugin)) return console.warn(`PluginService: Plugin with name "${name}" already exists`)
    if(this._type_limit_reached(Plugin)) return console.warn(`PluginService: Limit reached for plugin "${name}" [maximum ${Plugin.limit()} active ${Plugin.type} plugins]`))

    this.plugins[name] = Plugin
    this._set_plugin_requirements(Plugin)
    this._pluginInstances[name] = new this.plugins[name]()
    this.typeCountIncrement = type
  }
  private _remove_plugin(Plugin: any): void { 
    const name = Plugin.name
    const type = Plugin.type as PluginType

    if(!this._plugin_active(Plugin)) return console.warn(`PluginService: Plugin with name "${name}" is not active`)

    delete this.plugins[name]
    delete this._pluginInstances[name]
    this.typeCountDecrement = type
  }

  private _set_plugin_requirements(Plugin: any): void {
    const requirements: string[] = Plugin?.requires
    requirements.forEach((requirement: string) => {
      if(!this._pluginRequirements[requirement]) this._pluginRequirements[requirement] = [] as string[]
      this._pluginRequirements[requirement].push(Plugin.name)
    })
  }

  private _plugin_active(Plugin: any): boolean { 
    return this.active.includes(Plugin.name)
  }

  private _type_limit_reached(Plugin: any): boolean {
    const limit = Plugin.limit
    const hasLimit: boolean = limit && limit > 0
    if(!hasLimit) return false
    const instances: any = this.getInstanceCount(Plugin.name)
    if(instances < limit) return false
    return true
  }
}