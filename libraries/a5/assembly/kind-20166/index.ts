/**
 * NIP-A5 WASM: Kind 20166 — Live Relay State Changes
 *
 * Subscribes to kind 20166 (ephemeral relay state) events filtered by relay URL.
 * Displays real-time state transitions (init/down/up) as they happen.
 * This is a live subscription — it does NOT close on EOSE.
 *
 * Parameters:
 *   - relay (relay, required): the relay URL to monitor
 *
 * NIP-A5 event tags:
 *   ["name", "nip66-relay-live"]
 *   ["description", "Live NIP-66 relay state changes (ephemeral)"]
 *   ["param", "relay", "relay URL to monitor live", "relay", "required"]
 */
import {
  req_new,
  req_add_kind,
  req_add_tag,
  subscribe,
  display,
  drop
} from "../common/nostr";
import { log, encodeString } from "../common/utils";

export function alloc(size: usize): usize {
  return heap.alloc(size);
}

export function run(paramsPtr: usize): void {
  log("subscribing to kind-20166 live relay state...");

  // Read relay URL param: u32_be length + UTF-8 bytes
  const relayLen: u32 = (
    (<u32>load<u8>(paramsPtr, 0) << 24) |
    (<u32>load<u8>(paramsPtr, 1) << 16) |
    (<u32>load<u8>(paramsPtr, 2) << 8)  |
    (<u32>load<u8>(paramsPtr, 3))
  );

  if (relayLen == 0) {
    log("error: relay URL parameter is required");
    return;
  }

  const relayPtr = paramsPtr + 4;

  const req = req_new();
  req_add_kind(req, 20166);

  // Filter by r tag (relay URL reference)
  const rTag = encodeString("r");
  const rTagPtr = changetype<usize>(rTag);
  req_add_tag(req, <i32>rTagPtr, rTag.byteLength, <i32>relayPtr, <i32>relayLen);

  // NOTE: No req_close_on_eose — this is a live subscription for ephemeral events
  subscribe(req);

  log("live subscription active");
}

export function on_event(_sub: i32, event: i32, _eosed: i32): void {
  if (event == 0) return;
  display(event);
  drop(event);
}

export function on_eose(_sub: i32): void {
  log("initial state received, listening for live changes...");
}
