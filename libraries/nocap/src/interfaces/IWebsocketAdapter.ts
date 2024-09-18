
import { IResultData } from '../validators/ResultValidator';
import { IAdapter } from './IAdapter';
import { IResult } from './IResult';

export interface IWebsocketAdapter extends IAdapter {
  check_open(): Promise<void>;
  check_read(): Promise<void>;
  check_write(): Promise<void>;
}