import { IAdapter, TAdapterCount } from '../interfaces/IAdapter';
import Base from '../classes/Base';
import { ICounts } from './Counter';

export abstract class AbstractAdapter implements IAdapter {
  protected _base: Base;
  public count: TAdapterCount;

  constructor(base: Base) {
    this._base = base;
    this.initialize();
  }

  get base(): Base {
    return this._base;
  }

  abstract initialize(): void;
}