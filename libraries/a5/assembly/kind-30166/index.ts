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
 * Supports filtering by:
 *   - Up to 5 monitor pubkeys (authors)
 *   - Network type (#n): clearnet, tor, i2p
 *   - Supported NIP (#N): any NIP number as string
 *   - Relay requirements (#R): "requires auth" → R:auth, "does_not_require payment" → R:!payment
 *   - Software (#s): relay software name
 *   - Geohash (#g): location prefix match
 *   - NIP-32 labels (#L namespace + #l value): generic label filter
 *     e.g. L="countryCode" l="US", L="host.isp" l="Contabo GmbH",
 *          L="dns.ipv4" l="207.244.244.88", L="nip11.version" l="0.9.6"
 *
 * Parameters (in order):
 *   1.  mode            (number, required)     — 0 = online, 1 = offline, 2 = dead
 *   2.  frequency       (number, required)     — monitor check frequency in seconds
 *   3.  staleness       (number, optional)     — multiplier (default 1, min 1). 0 = use default.
 *   4.  dead_threshold  (number, optional)     — dead cutoff in seconds (default 2592000 = 30d). 0 = use default.
 *   5.  now             (timestamp, required)  — current unix timestamp
 *   6.  monitor1        (public_key, optional) — filter by this monitor
 *   7.  monitor2        (public_key, optional) — additional monitor
 *   8.  monitor3        (public_key, optional) — additional monitor
 *   9.  monitor4        (public_key, optional) — additional monitor
 *  10.  monitor5        (public_key, optional) — additional monitor
 *  11.  network         (string, optional)     — network type: "clearnet", "tor", "i2p"
 *  12.  supported_nips  (string, optional)     — supported NIP number (e.g. "42")
 *  13.  requires        (string, optional)     — relay must require: "auth", "payment", "pow", "ssl"
 *  14.  does_not_require (string, optional)    — relay must NOT require: "auth", "payment", "pow", "ssl"
 *  15.  software        (string, optional)     — relay software name (e.g. "strfry", "nostr-rs-relay")
 *  16.  geohash         (string, optional)     — geohash location prefix
 *  17.  label_namespace (string, optional)     — NIP-32 label namespace (e.g. "countryCode", "host.isp", "dns.ipv4")
 *  18.  label_value     (string, optional)     — NIP-32 label value (e.g. "US", "Contabo GmbH")
 */
import {
  req_new,
  req_add_kind,
  req_add_author,
  req_add_tag,
  req_set_limit,
  req_set_since,
  req_set_until,
  req_close_on_eose,
  subscribe,
  display,
  drop
} from "../common/nostr";
import { log, isPubkeyZero, encodeString } from "../common/utils";

// Defaults
const DEFAULT_STALENESS: i32 = 1;
const DEFAULT_DEAD_THRESHOLD: i32 = 2592000; // 30 days

// Modes
const MODE_ONLINE: i32 = 0;
const MODE_OFFLINE: i32 = 1;
const MODE_DEAD: i32 = 2;

// Layout constants
const MAX_MONITORS: i32 = 5;
const MONITORS_OFFSET: usize = 20; // after mode(4)+freq(4)+stale(4)+dead(4)+now(4)
const STRINGS_OFFSET: usize = 180; // after monitors (20 + 5*32)

/** Read a big-endian i32 from the params buffer at a byte offset */
function readI32(ptr: usize, offset: usize): i32 {
  return (
    (<i32>load<u8>(ptr + offset, 0) << 24) |
    (<i32>load<u8>(ptr + offset, 1) << 16) |
    (<i32>load<u8>(ptr + offset, 2) << 8)  |
    (<i32>load<u8>(ptr + offset, 3))
  );
}

/** Read a string param (u32_be length + UTF-8 bytes) and return [ptr, len, nextOffset] */
function readStringParam(basePtr: usize, offset: usize): usize[] {
  const len: u32 = (
    (<u32>load<u8>(basePtr + offset, 0) << 24) |
    (<u32>load<u8>(basePtr + offset, 1) << 16) |
    (<u32>load<u8>(basePtr + offset, 2) << 8)  |
    (<u32>load<u8>(basePtr + offset, 3))
  );
  const result = new Array<usize>(3);
  result[0] = basePtr + offset + 4; // ptr to string data
  result[1] = <usize>len;           // string length
  result[2] = offset + 4 + <usize>len; // next param offset
  return result;
}

/** Add a single-letter tag filter if the string param is non-empty */
function addTagFilter(req: i32, tagName: string, basePtr: usize, offset: usize): usize {
  const param = readStringParam(basePtr, offset);
  const strPtr = param[0];
  const strLen = param[1];
  const nextOffset = param[2];
  if (strLen > 0) {
    const tag = encodeString(tagName);
    const tagPtr = changetype<usize>(tag);
    req_add_tag(req, <i32>tagPtr, tag.byteLength, <i32>strPtr, <i32>strLen);
  }
  return nextOffset;
}

/** Add a negated tag filter: prepends "!" to the value before adding as tag filter */
function addNegatedTagFilter(req: i32, tagName: string, basePtr: usize, offset: usize): usize {
  const param = readStringParam(basePtr, offset);
  const strLen = param[1];
  const nextOffset = param[2];
  if (strLen > 0) {
    // Read the raw string value from params buffer
    const rawValue = String.UTF8.decodeUnsafe(param[0], strLen);
    // Prepend "!" and encode
    const negated = "!" + rawValue;
    const negBuf = encodeString(negated);
    const negPtr = changetype<usize>(negBuf);
    const tag = encodeString(tagName);
    const tagPtr = changetype<usize>(tag);
    req_add_tag(req, <i32>tagPtr, tag.byteLength, <i32>negPtr, negBuf.byteLength);
  }
  return nextOffset;
}

export function alloc(size: usize): usize {
  return heap.alloc(size);
}

export function run(paramsPtr: usize): void {
  // Read numeric params (first 20 bytes)
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
  for (let i: i32 = 0; i < MAX_MONITORS; i++) {
    const pkOffset: usize = MONITORS_OFFSET + <usize>i * 32;
    if (!isPubkeyZero(paramsPtr, pkOffset)) {
      req_add_author(req, <i32>(paramsPtr + pkOffset));
    }
  }

  // Add string-based tag filters
  let off: usize = STRINGS_OFFSET;
  off = addTagFilter(req, "n", paramsPtr, off); // network
  off = addTagFilter(req, "N", paramsPtr, off); // supported_nips
  off = addTagFilter(req, "R", paramsPtr, off); // requires (value passed as-is)
  off = addNegatedTagFilter(req, "R", paramsPtr, off); // does_not_require (prepends "!")
  off = addTagFilter(req, "s", paramsPtr, off); // software
  off = addTagFilter(req, "g", paramsPtr, off); // geohash
  off = addTagFilter(req, "L", paramsPtr, off); // NIP-32 label namespace
  off = addTagFilter(req, "l", paramsPtr, off); // NIP-32 label value

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
