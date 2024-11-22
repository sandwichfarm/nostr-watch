import { IResultData } from '../validators/ResultValidator';
import { IAdapter } from './IAdapter';
import { IResult } from './IResult';

export interface IGeoAdapter extends IAdapter {
  check_geo(): Promise<void>;
}