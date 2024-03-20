class SyncBase extends PluginBase {
  public cache: any;
  public limit: number;

  constructor($PluginManager) {
    super($PluginManager)
    this.name = 'SyncBase'
    this.version = '0.0.1'
    this.description = 'SyncBase'
    this.author = 'Sandwich'
    this.limit = -1
    this.manager.activate(this)
  }
}