
import { IResultData } from '../validators/ResultValidator';
import { IAdapter } from './IAdapter';
import { IResult } from './IResult';

export interface ISslAdapter extends IAdapter {
  check_ssl(): Promise<void>;
}