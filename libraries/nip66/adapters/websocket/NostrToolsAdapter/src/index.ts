import { IWebSocketAdapter } from '../../../../src/interfaces/IWebsocketAdapter';
import { relayInit, Relay } from 'nostr-tools';

export class NostrToolsAdapter implements IWebSocketAdapter {
  private relay?: Relay;

  async connect(url: string): Promise<void> {
    this.relay = relayInit(url);
    await this.relay.connect();
  }

  subscribe(event: any, callback: (data: any) => void): void {
    if (!this.relay) throw new Error('Relay not connected');
    const sub = this.relay.sub(event);
    sub.on('event', callback);
  }

  unsubscribe(event: any): void {
    // Implement unsubscribe logic based on `nostr-tools` API
    // This might require tracking subscriptions
  }

  disconnect(): void {
    this.relay?.close();
  }
}