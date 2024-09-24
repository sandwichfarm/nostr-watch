
import { IResultData } from '../validators/ResultValidator';
import { IAdapter } from './IAdapter';

export interface IInfoAdapter extends IAdapter {
  check_info(): Promise<IResultData>;
}