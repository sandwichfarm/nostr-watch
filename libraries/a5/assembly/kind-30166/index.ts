/**
 * NIP-A5 WASM: Kind 30166 — Relay Liveness (Online / Offline / Dead)
 *
 * Queries kind 30166 events with time-windowed filters to classify relay liveness.
 *
 * Classification:
 *   ONLINE:  since = now - (frequency * staleness),  until = now
 *   OFFLINE: since = now - dead_threshold,            until = now - (frequency * staleness)
 *   DEAD:    since = 0,                               until = now - dead_threshold
 *
 * Optionally filters by up to 5 monitor pubkeys (authors). Zero-filled slots are skipped.
 *
 * Parameters (in order):
 *   1. mode           (number, required)     — 0 = online, 1 = offline, 2 = dead
 *   2. frequency      (number, required)     — monitor check frequency in seconds
 *   3. staleness      (number, optional)     — multiplier (default 1, min 1). 0 = use default.
 *   4. dead_threshold (number, optional)     — dead cutoff in seconds (default 2592000 = 30d). 0 = use default.
 *   5. now            (timestamp, required)  — current unix timestamp
 *   6. monitor1       (public_key, optional) — filter by this monitor
 *   7. monitor2       (public_key, optional) — additional monitor
 *   8. monitor3       (public_key, optional) — additional monitor
 *   9. monitor4       (public_key, optional) — additional monitor
 *  10. monitor5       (public_key, optional) — additional monitor
 *
 * Buffer layout: 4+4+4+4+4 + 5×32 = 180 bytes
 */
import {
  req_new,
  req_add_kind,
  req_add_author,
  req_set_limit,
  req_set_since,
  req_set_until,
  req_close_on_eose,
  subscribe,
  display,
  drop
} from "../common/nostr";
import { log, isPubkeyZero } from "../common/utils";

// Defaults
const DEFAULT_STALENESS: i32 = 1;
const DEFAULT_DEAD_THRESHOLD: i32 = 2592000; // 30 days

// Modes
const MODE_ONLINE: i32 = 0;
const MODE_OFFLINE: i32 = 1;
const MODE_DEAD: i32 = 2;

// Monitor slots
const MAX_MONITORS: i32 = 5;
const MONITORS_OFFSET: usize = 20; // after mode(4)+freq(4)+stale(4)+dead(4)+now(4)

/** Read a big-endian i32 from the params buffer at a byte offset */
function readI32(ptr: usize, offset: usize): i32 {
  return (
    (<i32>load<u8>(ptr + offset, 0) << 24) |
    (<i32>load<u8>(ptr + offset, 1) << 16) |
    (<i32>load<u8>(ptr + offset, 2) << 8)  |
    (<i32>load<u8>(ptr + offset, 3))
  );
}

export function alloc(size: usize): usize {
  return heap.alloc(size);
}

export function run(paramsPtr: usize): void {
  // Read numeric params
  const mode = readI32(paramsPtr, 0);
  const frequency = readI32(paramsPtr, 4);
  let staleness = readI32(paramsPtr, 8);
  let deadThreshold = readI32(paramsPtr, 12);
  const now = readI32(paramsPtr, 16);

  // Validate
  if (frequency <= 0) {
    log("error: frequency must be > 0");
    return;
  }
  if (mode < MODE_ONLINE || mode > MODE_DEAD) {
    log("error: mode must be 0 (online), 1 (offline), or 2 (dead)");
    return;
  }
  if (now <= 0) {
    log("error: now timestamp must be provided");
    return;
  }

  // Apply defaults
  if (staleness < 1) staleness = DEFAULT_STALENESS;
  if (deadThreshold <= 0) deadThreshold = DEFAULT_DEAD_THRESHOLD;

  const onlineCutoff: i32 = now - (frequency * staleness);
  const deadCutoff: i32 = now - deadThreshold;

  const req = req_new();
  req_add_kind(req, 30166);

  // Add monitor pubkey filters (skip zero-filled slots)
  let monitorCount: i32 = 0;
  for (let i: i32 = 0; i < MAX_MONITORS; i++) {
    const pkOffset: usize = MONITORS_OFFSET + <usize>i * 32;
    if (!isPubkeyZero(paramsPtr, pkOffset)) {
      req_add_author(req, <i32>(paramsPtr + pkOffset));
      monitorCount++;
    }
  }

  // Set time window based on mode
  if (mode == MODE_ONLINE) {
    log("querying online relays...");
    req_set_since(req, onlineCutoff);
    req_set_until(req, now);
  } else if (mode == MODE_OFFLINE) {
    log("querying offline relays...");
    req_set_since(req, deadCutoff);
    req_set_until(req, onlineCutoff);
  } else {
    log("querying dead relays...");
    req_set_since(req, 0);
    req_set_until(req, deadCutoff);
  }

  req_set_limit(req, 500);
  req_close_on_eose(req);
  subscribe(req);
}

export function on_event(_sub: i32, event: i32, _eosed: i32): void {
  if (event == 0) return;
  display(event);
  drop(event);
}

export function on_eose(_sub: i32): void {
  log("relay status query complete");
}
