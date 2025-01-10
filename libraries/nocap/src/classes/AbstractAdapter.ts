import { IAdapter, TAdapterCount } from '../interfaces/IAdapter';
import Base from '../classes/Base';
import { ICounts } from './Counter';

export type AdapterType = 'websocket' | 'dns' | 'geo' | 'info' | 'ssl';

export abstract class AbstractAdapter implements IAdapter {
  protected _base: Base;
  readonly slug: string = 'unset!'; 

  static type: AdapterType;
  public count!: TAdapterCount;
  
  constructor(base: Base) {
    this._base = base;
    this.initialize();
  }

  get base(): Base {
    return this._base;
  }

  abstract initialize(): void;
}