
import Base from '../classes/Base';
import { IResult, IResultData } from '../validators/ResultValidator'; // Assuming you have an IResult interface


export type AdapterKeys = keyof IAdapterMethods;

export type TAdapterCount = {
  [key: string]: number;
}

export interface IAdapterMethods {
  check_all?(): Promise<IResultData>;
  check_open?(): Promise<IResultData>;
  check_read?(): Promise<IResultData>;
  check_write?(): Promise<IResultData>;
  check_ssl?(): Promise<IResultData>;
  check_dns?(): Promise<IResultData>;
  check_geo?(): Promise<IResultData>;
  check_info?(): Promise<IResultData>;

  handle_event?(subid: string, ev: any): void;
  handle_error?(error: Error): void;
  handle_result?(result: IResult): void;
  handle_results?(results: IResult[]): void;
  handle_complete?(): void;
  handle_abort?(): void;
  handle_timeout?(): void;
  handle_cancel?(): void;
}

export interface IAdapter extends IAdapterMethods {
  readonly base: Base
  count?: TAdapterCount;

  initialize(): void;
}
