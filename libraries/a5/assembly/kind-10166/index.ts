/**
 * NIP-A5 WASM: Kind 10166 — Monitor Announcement Viewer
 *
 * Subscribes to kind 10166 (relay monitor announcements) and displays them.
 *
 * Parameters:
 *   - monitor_pubkey (public_key, optional): filter by a specific monitor's pubkey
 *
 * NIP-A5 event tags:
 *   ["name", "nip66-monitors"]
 *   ["description", "View NIP-66 relay monitor announcements"]
 *   ["param", "monitor_pubkey", "monitor to view", "public_key", ""]
 */
import {
  req_new,
  req_add_kind,
  req_add_author,
  req_set_limit,
  req_close_on_eose,
  subscribe,
  display,
  drop
} from "../common/nostr";
import { log, isPubkeyZero } from "../common/utils";

export function alloc(size: usize): usize {
  return heap.alloc(size);
}

export function run(paramsPtr: usize): void {
  log("fetching kind-10166 monitor announcements...");

  const req = req_new();
  req_add_kind(req, 10166);

  // If monitor_pubkey param is provided (first 32 bytes), filter by author
  if (!isPubkeyZero(paramsPtr, 0)) {
    req_add_author(req, <i32>paramsPtr);
    log("filtering by monitor pubkey");
  }

  req_set_limit(req, 50);
  req_close_on_eose(req);
  subscribe(req);
}

export function on_event(_sub: i32, event: i32, _eosed: i32): void {
  if (event == 0) return;
  display(event);
  drop(event);
}

export function on_eose(_sub: i32): void {
  log("monitor announcements loaded");
}
