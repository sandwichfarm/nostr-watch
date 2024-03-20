//manages plugins

enum PluginType {
  cache = 'Cache',
  worker = 'Worker',
  sync = 'Sync',
  queue = 'Queue',
  queueEvents = 'QueueEvents'
}

export class PluginService {

  private _plugins: any = {}
  private _pluginNames: Set<string> = new Set()
  private _pluginInstances: any = {}
  private _pluginTypeCounts: any = {}  

  constructor(){
    
  }

  activate(Plugin: any, config: NWDConfig){
    this._add_plugin(Plugin)
  }

  getInstance(pluginName: string){

  }

  getInstances(): any {
    
  }

  getInstanceCount(Plugin: any): number {
    return 0
  }

  get plugins(): any {
    return this._plugins
  }

  set plugins(plugins: any){
    this._plugins = plugins
  }

  get plugin(plugin: string): any | null {
    return this._plugins?.[plugin] || null
  }

  get typeCounts(): any {
    return this._pluginTypeCounts
  }


  setTypeCount(type: string, count: number){
    this._pluginTypeCounts[type] = count
  }

  getTypeCount(type: string): number {
    return this.typeCounts?.[type] || 0
  }

  get pluginNames(): string[] {
    return Array.from(this._pluginNames)
  }

  set pluginNames(pluginNames: string[]) {
    this._pluginNames = new Set(pluginNames)
  }

  set pluginName(pluginName: string){
    this._pluginNames.add(pluginName)
  }

  get pluginInstances(): any {
    return this._pluginInstances
  }

  private _add_plugin(Plugin: any): void{
    const name = Plugin.name
    
    if(this._plugin_exists(Plugin)) return console.warn(`PluginService: Plugin with name "${name}" already exists`)
    if(this._limit_reached(Plugin)) return console.warn(`PluginService: Limit reached for plugin "${name}" [maximum ${Plugin.limit()} active ${Plugin.type} plugins]`))

    this.plugins[name] = Plugin
    this._pluginTypeCounts[Plugin.type as PluginType] = this.getTypeCount(Plugin.type) + 1
    this._pluginInstances[name] = new this.plugins[name](this)
  }

  private _remove_plugin(Plugin: any): void { 
    const name = Plugin.name
    if(!this._plugin_exists(Plugin)) return console.warn(`PluginService: Plugin with name "${name}" does not exist`)
    this._pluginTypeCounts[Plugin.type as PluginType] = this.getTypeCount(Plugin.type) - 1
    delete this.plugins[name]
    delete this._pluginInstances[name]
  }

  private _plugin_exists(Plugin: any): boolean { 
    return this._pluginNames.has(Plugin.name)
  }

  private _limit_reached(Plugin: any): boolean {
    const limit = Plugin.limit()
    const hasLimit: boolean = limit > 0
    if(!hasLimit) return false
    const instances: any = this.getInstanceCount(Plugin.name)
    if(instances < limit) return false
    return true
  }
  
}