import { IAdapter } from './IAdapter';
import Base from '../classes/Base';
import { AdapterType } from '../classes/AbstractAdapter';

export interface IAdapterConstructor {
  type: AdapterType
  new (base: Base): IAdapter;
}