
import Base from '../classes/Base';
import { IResult, IResultData } from '../validators/ResultValidator'; // Assuming you have an IResult interface


export type AdapterKeys = keyof IAdapterMethods;

export type TAdapterCount = {
  [key: string]: number;
}

export interface IAdapterMethods {
  check_all?(): Promise<void>;
  check_open?(): Promise<void>;
  check_read?(): Promise<void>;
  check_write?(): Promise<void>;
  check_ssl?(): Promise<void>;
  check_dns?(): Promise<void>;
  check_geo?(): Promise<void>;
  check_info?(): Promise<void>;

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
  readonly base: Base;
  readonly slug: string;

  count?: TAdapterCount;

  initialize(): void;
}
