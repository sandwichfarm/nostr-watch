
import { IResultData } from '../validators/ResultValidator';
import { IAdapter } from './IAdapter';

export interface IDnsAdapter extends IAdapter {
  check_dns(): Promise<void>;
}