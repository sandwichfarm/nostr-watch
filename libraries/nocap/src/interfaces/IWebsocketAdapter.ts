
import { IResultData } from '../validators/ResultValidator';
import { IAdapter } from './IAdapter';
import { IResult } from './IResult';

export interface IWebsocketAdapter extends IAdapter {
  check_open(): Promise<IResultData>;
  check_read(): Promise<IResultData>;
  check_write(): Promise<IResultData>;
}