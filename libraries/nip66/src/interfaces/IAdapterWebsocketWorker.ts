import { AdapterWorkerCommand } from "@base/core";
import { Filter } from "nostr-tools";

export interface AdapterWebsocketWorkerOptions {
  connectToRelays: string[]
}

export type AdapterWebsocketWorkerCommandTypes = "subscribe" | "fetch"

export interface AdapterWebsocketWorkerCommand extends AdapterWorkerCommand {
  type: AdapterWebsocketWorkerCommandTypes
  hash: string,
  filters: Filter[];
  options?: AdapterWebsocketWorkerOptions
}