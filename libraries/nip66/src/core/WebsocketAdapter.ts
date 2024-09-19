import { type Filter } from 'nostr-tools';

import { Adapter, IAdapter } from '@base/core/Adapter'
import { NostrEvent } from '@models/NostrEvent';

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

export class WebsocketAdapter extends Adapter {

  get dedicatedWorker(): Worker | undefined {
    return this.workers?.websocketDedicated
  }

  get sharedWorker(): SharedWorker | undefined {
    return this.workers?.websocketShared
  }
  
}