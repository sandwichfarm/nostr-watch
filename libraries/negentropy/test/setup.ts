import { RecordItem } from '../src/types';

export function createMockRecords(count: number, seed = 0): RecordItem[] {
  const records: RecordItem[] = [];
  for (let i = 0; i < count; i++) {
    const id = new Uint8Array(32);
    // Create deterministic IDs based on seed and index
    for (let j = 0; j < 32; j++) {
      id[j] = (seed + i + j) % 256;
    }
    records.push({
      timestamp: BigInt(1000 + i * 100),
      id
    });
  }
  return records;
}

export class MockTransport {
  private messageHandlers: ((message: string) => void)[] = [];
  private sentMessages: string[] = [];
  private peerTransport?: MockTransport;

  send(message: string): void {
    this.sentMessages.push(message);
    // Simulate async message delivery to peer
    if (this.peerTransport) {
      setTimeout(() => {
        this.peerTransport!.receiveMessage(message);
      }, 0);
    }
  }

  onMessage(handler: (message: string) => void): void {
    this.messageHandlers.push(handler);
  }

  receiveMessage(message: string): void {
    this.messageHandlers.forEach(handler => handler(message));
  }

  getSentMessages(): string[] {
    return this.sentMessages;
  }

  clearSentMessages(): void {
    this.sentMessages = [];
  }

  connectToPeer(peer: MockTransport): void {
    this.peerTransport = peer;
    peer.peerTransport = this;
  }
}

export function parseMessage(message: string): any[] {
  return JSON.parse(message);
}

export function createIdFromNumber(num: number): Uint8Array {
  const id = new Uint8Array(32);
  id.fill(0);
  // Store number in first 4 bytes
  id[0] = (num >> 24) & 0xff;
  id[1] = (num >> 16) & 0xff;
  id[2] = (num >> 8) & 0xff;
  id[3] = num & 0xff;
  return id;
}