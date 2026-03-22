/**
 * NIP-A5 WASM: Kind 10166 — Monitor Announcement Viewer
 *
 * Subscribes to kind 10166 (relay monitor announcements) and displays them.
 * Kind 10166 is replaceable (one per pubkey) — declares a monitor's existence,
 * frequency, networks, check types, timeouts, and location.
 *
 * Optionally filters by up to 5 monitor pubkeys. Zero-filled slots are skipped.
 * When no pubkeys are provided, returns all monitors.
 *
 * Parameters (in order):
 *   1. monitor1 (public_key, optional) — filter by this monitor
 *   2. monitor2 (public_key, optional) — additional monitor
 *   3. monitor3 (public_key, optional) — additional monitor
 *   4. monitor4 (public_key, optional) — additional monitor
 *   5. monitor5 (public_key, optional) — additional monitor
 *
 * Buffer layout: 5 × 32 = 160 bytes
 *
 * NIP-A5 event tags:
 *   ["name", "nip66-monitors"]
 *   ["description", "View NIP-66 relay monitor announcements"]
 *   ["param", "monitor1", "monitor to view", "public_key", ""]
 *   ["param", "monitor2", "additional monitor", "public_key", ""]
 *   ["param", "monitor3", "additional monitor", "public_key", ""]
 *   ["param", "monitor4", "additional monitor", "public_key", ""]
 *   ["param", "monitor5", "additional monitor", "public_key", ""]
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

const MAX_MONITORS: i32 = 5;

export function alloc(size: usize): usize {
  return heap.alloc(size);
}

export function run(paramsPtr: usize): void {
  log("fetching kind-10166 monitor announcements...");

  const req = req_new();
  req_add_kind(req, 10166);

  // Add monitor pubkey filters (skip zero-filled slots)
  let monitorCount: i32 = 0;
  for (let i: i32 = 0; i < MAX_MONITORS; i++) {
    const pkOffset: usize = <usize>i * 32;
    if (!isPubkeyZero(paramsPtr, pkOffset)) {
      req_add_author(req, <i32>(paramsPtr + pkOffset));
      monitorCount++;
    }
  }

  if (monitorCount > 0) {
    log("filtering by monitor pubkeys");
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
