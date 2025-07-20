import { Transport } from './transports/Transport';
import { NegentropyWasmWrapper } from './wasm/NegentropyWasm';
import { hexToUint8Array, uint8ArrayToHex } from './utils/hex';
import { compareUint8Arrays } from './utils/helpers';
import type { RecordItem } from './types';

interface Subscription {
  wasm: NegentropyWasmWrapper;
  filteredRecords: RecordItem[];
}

export class WasmServerHandler {
  private records: RecordItem[];
  private transport: Transport;
  private subscriptions: Map<string, Subscription> = new Map();
  private applyFilter?: (records: RecordItem[], filter: any) => Promise<RecordItem[]> | RecordItem[];
  private frameSizeLimit?: number;

  constructor(
    records: RecordItem[], 
    transport: Transport,
    applyFilter?: (records: RecordItem[], filter: any) => Promise<RecordItem[]> | RecordItem[],
    frameSizeLimit?: number
  ) {
    this.records = records;
    this.transport = transport;
    this.applyFilter = applyFilter;
    this.frameSizeLimit = frameSizeLimit;

    // Set up message handling
    this.transport.onMessage((message) => this.handleMessage(message));
  }

  public async handleMessage(message: string): Promise<void> {
    const parsed = JSON.parse(message);
    const messageType = parsed[0];

    switch (messageType) {
      case "NEG-OPEN":
        await this.handleNegOpen(parsed);
        break;
      case "NEG-MSG":
        await this.handleNegMsg(parsed);
        break;
      case "NEG-CLOSE":
        this.handleNegClose(parsed);
        break;
      default:
        break;
    }
  }

  private async handleNegOpen(parsed: any[]): Promise<void> {
    const subscriptionId = parsed[1];
    const filter = parsed[2];
    const messageHex = parsed[3];

    // Check if subscription already exists and close it
    if (this.subscriptions.has(subscriptionId)) {
      const sub = this.subscriptions.get(subscriptionId)!;
      sub.wasm.free();
      this.subscriptions.delete(subscriptionId);
    }

    // Apply filter to get relevant records
    let filteredRecords: RecordItem[];
    if (this.applyFilter) {
      try {
        filteredRecords = await this.applyFilter(this.records, filter);
      } catch (error) {
        // Send NEG-ERR if filter application fails
        const negErr = ['NEG-ERR', subscriptionId, 'error: filter application failed'];
        this.transport.send(JSON.stringify(negErr));
        return;
      }
    } else {
      // If no filter function provided, use all records
      filteredRecords = this.records;
    }

    // Sort records
    filteredRecords.sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return a.timestamp < b.timestamp ? -1 : 1;
      }
      return compareUint8Arrays(a.id, b.id);
    });

    // Check if query is too large (optional)
    const maxRecords = 100000; // Configurable limit
    if (filteredRecords.length > maxRecords) {
      const negErr = ['NEG-ERR', subscriptionId, 'blocked: this query is too big', maxRecords];
      this.transport.send(JSON.stringify(negErr));
      return;
    }

    // Create WASM instance for this subscription
    const wasm = new NegentropyWasmWrapper();
    await wasm.init(this.frameSizeLimit);
    wasm.addItems(filteredRecords);
    wasm.seal();

    // Store subscription
    this.subscriptions.set(subscriptionId, {
      wasm,
      filteredRecords
    });

    // Process initial message
    const clientMessageBuffer = hexToUint8Array(messageHex);
    const result = wasm.reconcile(clientMessageBuffer);
    
    // Send response
    const responseHex = uint8ArrayToHex(result.msg);
    const negMsg = ['NEG-MSG', subscriptionId, responseHex];
    this.transport.send(JSON.stringify(negMsg));
  }

  private async handleNegMsg(parsed: any[]): Promise<void> {
    const subscriptionId = parsed[1];
    const messageHex = parsed[2];

    if (!this.subscriptions.has(subscriptionId)) {
      // Send NEG-ERR: closed
      const negErr = ['NEG-ERR', subscriptionId, 'closed: subscription not found'];
      this.transport.send(JSON.stringify(negErr));
      return;
    }

    const subscription = this.subscriptions.get(subscriptionId)!;
    
    // Process message with WASM
    const clientMessageBuffer = hexToUint8Array(messageHex);
    const result = subscription.wasm.reconcile(clientMessageBuffer);
    
    // Send response
    const responseHex = uint8ArrayToHex(result.msg);
    const negMsg = ['NEG-MSG', subscriptionId, responseHex];
    this.transport.send(JSON.stringify(negMsg));
  }

  private handleNegClose(parsed: any[]): void {
    const subscriptionId = parsed[1];
    if (this.subscriptions.has(subscriptionId)) {
      const sub = this.subscriptions.get(subscriptionId)!;
      sub.wasm.free();
      this.subscriptions.delete(subscriptionId);
    }
  }

  public destroy(): void {
    // Clean up all subscriptions
    for (const [_, sub] of this.subscriptions) {
      sub.wasm.free();
    }
    this.subscriptions.clear();
  }
}