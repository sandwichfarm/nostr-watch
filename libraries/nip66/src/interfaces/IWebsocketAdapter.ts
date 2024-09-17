import { NostrEvent } from '@models/NostrEvent';
import { IAdapter } from './IAdapter';

export interface IWsAdapterCallbacks {
  onNotice: (notice: any) => void
  onOk: (status: any) => void
  onEvent(event: NostrEvent): void
  onLimits(limits: Record<string, any>): void
  onEose(): void
  onClose(): void
}

export interface IWebSocketAdapter  extends IAdapter {
  connect(url: string): Promise<void>;
  subscribe(event: any, callbacks: IWsAdapterCallbacks): void;
  unsubscribe(event: any): void;
  disconnect(): void;
  terminate(): void;
}