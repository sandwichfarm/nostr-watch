/**
 * NIP-A5 WASM: Kind 1066 — Relay Status Delta Viewer
 *
 * Subscribes to kind 1066 (relay status delta) events filtered by relay URL (r tag).
 * Displays historical state changes and deltas for a relay.
 *
 * Parameters:
 *   - relay (relay, required): the relay URL to look up
 *
 * NIP-A5 event tags:
 *   ["name", "nip66-relay-deltas"]
 *   ["description", "View NIP-66 relay status deltas (historical changes)"]
 *   ["param", "relay", "relay URL to check", "relay", "required"]
 */
import {
  req_new,
  req_add_kind,
  req_add_tag,
  req_set_limit,
  req_close_on_eose,
  subscribe,
  display,
  drop
} from "../common/nostr";
import { log, encodeString } from "../common/utils";

export function alloc(size: usize): usize {
  return heap.alloc(size);
}

export function run(paramsPtr: usize): void {
  log("fetching kind-1066 relay status deltas...");

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
  req_add_kind(req, 1066);

  // Filter by r tag (relay URL reference)
  const rTag = encodeString("r");
  const rTagPtr = changetype<usize>(rTag);
  req_add_tag(req, <i32>rTagPtr, rTag.byteLength, <i32>relayPtr, <i32>relayLen);

  req_set_limit(req, 100);
  req_close_on_eose(req);
  subscribe(req);
}

export function on_event(_sub: i32, event: i32, _eosed: i32): void {
  if (event == 0) return;
  display(event);
  drop(event);
}

export function on_eose(_sub: i32): void {
  log("relay status deltas loaded");
}
