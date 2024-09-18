import { IAdapter } from './IAdapter';
import Base from '../classes/Base';

export interface IAdapterConstructor {
  new (base: Base): IAdapter;
}