/// <reference lib="webworker" />

import { handleMsg, insertBatch, WorkerState } from "./worker-utils";

const state: WorkerState = {
  self: self as DedicatedWorkerGlobalScope | SharedWorkerGlobalScope,
  relay: undefined,
  eventWriteQueue: [],
  insertBatchSize: 10,
  insertBatchEvery: 100,
  lastBatch: 0,
}

try {
  setTimeout(() => insertBatch(state), state.insertBatchEvery);
} catch (e) {
  console.error(e);
}

if ("SharedWorkerGlobalScope" in globalThis) {
  onconnect = e => {
    const port = e.ports[0];
    port.onmessage = (msg: MessageEvent) => handleMsg(state, msg, port);
    port.start();
  };
}
if ("DedicatedWorkerGlobalScope" in globalThis) {
  onmessage = e => {
    handleMsg(state, e);
  };
}