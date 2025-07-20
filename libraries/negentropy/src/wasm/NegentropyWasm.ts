import init, { NegentropyWasm as WasmModule, ReconciliationResult } from '../../wasm-pkg/negentropy_wasm';
import { RecordItem } from '../types';

export class NegentropyWasmWrapper {
  private module?: WasmModule;
  private initialized = false;

  async init(frameSizeLimit?: number): Promise<void> {
    if (!this.initialized) {
      await init();
      this.module = new WasmModule(frameSizeLimit);
      this.initialized = true;
    }
  }

  addItem(timestamp: bigint, id: Uint8Array): void {
    if (!this.module) throw new Error('WASM module not initialized');
    this.module.add_item(Number(timestamp), id);
  }

  addItems(items: RecordItem[]): void {
    if (!this.module) throw new Error('WASM module not initialized');
    for (const item of items) {
      this.module.add_item(Number(item.timestamp), item.id);
    }
  }

  seal(): void {
    if (!this.module) throw new Error('WASM module not initialized');
    this.module.seal();
  }

  initiate(): Uint8Array {
    if (!this.module) throw new Error('WASM module not initialized');
    return this.module.initiate();
  }

  reconcile(query: Uint8Array): {
    msg: Uint8Array;
    haveIds: Uint8Array[];
    needIds: Uint8Array[];
  } {
    if (!this.module) throw new Error('WASM module not initialized');
    
    const result = this.module.reconcile(query);
    
    // Convert JS Arrays to Uint8Array arrays
    const haveIds: Uint8Array[] = [];
    for (let i = 0; i < result.have_ids.length; i++) {
      haveIds.push(result.have_ids[i] as Uint8Array);
    }
    
    const needIds: Uint8Array[] = [];
    for (let i = 0; i < result.need_ids.length; i++) {
      needIds.push(result.need_ids[i] as Uint8Array);
    }
    
    return {
      msg: result.msg,
      haveIds,
      needIds
    };
  }

  size(): number {
    if (!this.module) throw new Error('WASM module not initialized');
    return this.module.size();
  }

  free(): void {
    if (this.module) {
      this.module.free();
      this.module = undefined;
      this.initialized = false;
    }
  }
}