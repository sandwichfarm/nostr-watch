/**
 * NIP-A5 WASM: Kind 10166 — Monitor Announcement Viewer
 *
 * Subscribes to kind 10166 (relay monitor announcements) and displays them.
 * Kind 10166 is replaceable (one per pubkey) — declares a monitor's existence,
 * frequency, networks, check types, timeouts, and location.
 *
 * Supports filtering by:
 *   - Up to 5 monitor pubkeys (authors)
 *   - Network type (#n): clearnet, tor, i2p
 *   - Check type (#c): open, read, write, ssl, dns, geo, info, nip11, ws
 *
 * Parameters (in order):
 *   1. monitor1 (public_key, optional) — filter by this monitor
 *   2. monitor2 (public_key, optional) — additional monitor
 *   3. monitor3 (public_key, optional) — additional monitor
 *   4. monitor4 (public_key, optional) — additional monitor
 *   5. monitor5 (public_key, optional) — additional monitor
 *   6. network    (string, optional)   — network type: "clearnet", "tor", "i2p"
 *   7. check_type (string, optional)   — check performed: "open", "read", "write", "ssl", "dns", "geo", "info"
 *
 * Buffer layout: 5×32 + 2 string params = 160 + variable
 *
 * NIP-A5 event tags:
 *   ["param", "monitor1", "monitor pubkey to filter by", "public_key", ""]
 *   ["param", "monitor2", "additional monitor pubkey", "public_key", ""]
 *   ["param", "monitor3", "additional monitor pubkey", "public_key", ""]
 *   ["param", "monitor4", "additional monitor pubkey", "public_key", ""]
 *   ["param", "monitor5", "additional monitor pubkey", "public_key", ""]
 *   ["param", "network", "network type: clearnet, tor, or i2p", "string", ""]
 *   ["param", "check_type", "check performed: open, read, write, ssl, dns, geo, info", "string", ""]
 */
import {
  req_new,
  req_add_kind,
  req_add_author,
  req_add_tag,
  req_set_limit,
  req_close_on_eose,
  subscribe,
  display,
  drop
} from "../common/nostr";
import { log, isPubkeyZero, encodeString } from "../common/utils";

const MAX_MONITORS: i32 = 5;
const STRINGS_OFFSET: usize = 160; // after 5 × 32-byte pubkeys

/** Read a string param (u32_be length + UTF-8 bytes) and return [ptr, len, nextOffset] */
function readStringParam(basePtr: usize, offset: usize): usize[] {
  const len: u32 = (
    (<u32>load<u8>(basePtr + offset, 0) << 24) |
    (<u32>load<u8>(basePtr + offset, 1) << 16) |
    (<u32>load<u8>(basePtr + offset, 2) << 8)  |
    (<u32>load<u8>(basePtr + offset, 3))
  );
  const result = new Array<usize>(3);
  result[0] = basePtr + offset + 4;
  result[1] = <usize>len;
  result[2] = offset + 4 + <usize>len;
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

export function alloc(size: usize): usize {
  return heap.alloc(size);
}

export function run(paramsPtr: usize): void {
  log("fetching kind-10166 monitor announcements...");

  const req = req_new();
  req_add_kind(req, 10166);

  // Add monitor pubkey filters (skip zero-filled slots)
  for (let i: i32 = 0; i < MAX_MONITORS; i++) {
    const pkOffset: usize = <usize>i * 32;
    if (!isPubkeyZero(paramsPtr, pkOffset)) {
      req_add_author(req, <i32>(paramsPtr + pkOffset));
    }
  }

  // Add string-based tag filters
  let off: usize = STRINGS_OFFSET;
  off = addTagFilter(req, "n", paramsPtr, off); // network
  off = addTagFilter(req, "c", paramsPtr, off); // check type

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
