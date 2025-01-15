import { LocalStorageWrapper } from './LocalStorageWrapper';

export default class {
  private readonly prefix: string = 'checkpoint'
  static measurement: string = 's'
  private localStorage: LocalStorageWrapper = new LocalStorageWrapper(this.prefix)

  constructor(){}

  async init(){}
}