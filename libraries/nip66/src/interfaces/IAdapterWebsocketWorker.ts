import { AdapterWorkerCommand } from "@base/core";
import { Filter } from "nostr-tools";

export interface AdapterWebsocketWorkerOptions {
  connectToRelays: string[]
}

export type AdapterWebsocketWorkerCommandTypes = "subscribeAndCache" | "subscribeAndReturn" | "subscribeAndCacheAndReturn"

export interface AdapterWebsocketWorkerCommand extends AdapterWorkerCommand {
  type: AdapterWebsocketWorkerCommandTypes;
  filters: Filter[];
  options?: AdapterWebsocketWorkerOptions
  token?: string; 
}