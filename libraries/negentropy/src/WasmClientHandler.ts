import { Transport } from './transports/Transport';
import { NegentropyWasmWrapper } from './wasm/NegentropyWasm';
import { hexToUint8Array, uint8ArrayToHex } from './utils/hex';
import { compareUint8Arrays } from './utils/helpers';
import type { RecordItem } from './types';

export class WasmClientHandler {
  private records: RecordItem[];
  private transport: Transport;
  private subscriptionId: string;
  private filter: any;
  private wasm: NegentropyWasmWrapper;
  private clientHasIds: Set<string> = new Set();
  private clientNeedsIds: Set<string> = new Set();
  private isSealed = false;

  constructor(records: RecordItem[], transport: Transport, filter: any, subscriptionId: string) {
    this.records = records;
    this.transport = transport;
    this.filter = filter;
    this.subscriptionId = subscriptionId;
    this.wasm = new NegentropyWasmWrapper();

    // Sort records once
    this.records.sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return a.timestamp < b.timestamp ? -1 : 1;
      }
      return compareUint8Arrays(a.id, b.id);
    });

    // Set up message handling
    this.transport.onMessage((message) => this.handleMessage(message));
  }

  public async init(frameSizeLimit?: number): Promise<void> {
    await this.wasm.init(frameSizeLimit);
    this.wasm.addItems(this.records);
    this.wasm.seal();
    this.isSealed = true;
  }

  public startSync(): void {
    if (!this.isSealed) throw new Error('Handler not initialized. Call init() first.');
    
    const initialMessage = this.wasm.initiate();
    const messageHex = uint8ArrayToHex(initialMessage);

    const negOpenMessage = [
      "NEG-OPEN",
      this.subscriptionId,
      this.filter,
      messageHex,
    ];

    this.transport.send(JSON.stringify(negOpenMessage));
  }

  public getClientHasIds(): string[] {
    return Array.from(this.clientHasIds);
  }

  public getClientNeedsIds(): string[] {
    return Array.from(this.clientNeedsIds);
  }

  public handleMessage(message: string): void {
    const parsed = JSON.parse(message);
    const messageType = parsed[0];

    switch (messageType) {
      case "NEG-MSG":
        this.handleNegMsg(parsed);
        break;
      case "NEG-ERR":
        this.handleNegErr(parsed);
        break;
      case "NEG-CLOSE":
        this.handleNegClose(parsed);
        break;
      default:
        break;
    }
  }

  private handleNegMsg(parsed: any[]): void {
    const subscriptionId = parsed[1];
    const messageHex = parsed[2];
    if (subscriptionId !== this.subscriptionId) return;

    const messageBuffer = hexToUint8Array(messageHex);
    
    // Use WASM to reconcile
    const result = this.wasm.reconcile(messageBuffer);
    
    // Process the IDs
    for (const id of result.haveIds) {
      this.clientHasIds.add(uint8ArrayToHex(id));
    }
    
    for (const id of result.needIds) {
      this.clientNeedsIds.add(uint8ArrayToHex(id));
    }
    
    // Send next message if needed
    if (result.msg.length > 0) {
      const messageHex = uint8ArrayToHex(result.msg);
      const negMsg = ["NEG-MSG", this.subscriptionId, messageHex];
      this.transport.send(JSON.stringify(negMsg));
    } else {
      this.sendNegClose();
    }
  }

  private handleNegErr(parsed: any[]): void {
    const subscriptionId = parsed[1];
    const reason = parsed[2];
    if (subscriptionId !== this.subscriptionId) return;

    console.error(`NEG-ERR received: ${reason}`);
  }

  private handleNegClose(parsed: any[]): void {
    const subscriptionId = parsed[1];
    if (subscriptionId !== this.subscriptionId) return;

    console.log(`NEG-CLOSE received for subscription ${subscriptionId}`);
  }

  private sendNegClose(): void {
    const negCloseMessage = ["NEG-CLOSE", this.subscriptionId];
    this.transport.send(JSON.stringify(negCloseMessage));
  }

  public destroy(): void {
    this.wasm.free();
  }
}