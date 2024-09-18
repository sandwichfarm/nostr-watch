import { NostrEvent } from '@models/NostrEvent';
import { IAdapter } from './IAdapter';

import { type Filter } from 'nostr-tools';

export interface IWebsocketAdapterCallbacks {
  onNotice?: (notice: any) => void
  onOk?: (status: any) => void
  onEvent?: (event: NostrEvent) => void
  onLimits?: (limits: Record<string, any>) => void
  onEose?: () => void
  onClose?: () => void
}

export interface IWebSocketAdapter  extends IAdapter {
  connect(url: string): Promise<void>;
  subscribe(filters: Filter[], subId?: string): void;
  unsubscribe(event: any): void;
  disconnect(): void;
  terminate(): void;
}