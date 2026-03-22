import { nostr_log_raw } from "./nostr";

/** Log a string to the host's debug console */
export function log(msg: string): void {
  const encoded = String.UTF8.encode(msg);
  const ptr = changetype<usize>(encoded);
  nostr_log_raw(<i32>ptr, encoded.byteLength);
}

/**
 * Read a string from a host-returned buffer pointer.
 * Host returns ptr where first 4 bytes = u32_be length, followed by UTF-8 payload.
 */
export function readHostString(ptr: i32): string {
  if (ptr == 0) return "";
  const buf = changetype<ArrayBuffer>(ptr);
  const len = (
    (<u32>load<u8>(changetype<usize>(buf), 0) << 24) |
    (<u32>load<u8>(changetype<usize>(buf), 1) << 16) |
    (<u32>load<u8>(changetype<usize>(buf), 2) << 8)  |
    (<u32>load<u8>(changetype<usize>(buf), 3))
  );
  if (len == 0) return "";
  return String.UTF8.decodeUnsafe(changetype<usize>(buf) + 4, len);
}

/**
 * Get raw pointer and length for a static string constant.
 * Returns [ptr, len] for use with host API calls.
 */
export function strPtrLen(s: string): usize[] {
  const encoded = String.UTF8.encode(s);
  const ptr = changetype<usize>(encoded);
  const result = new Array<usize>(2);
  result[0] = ptr;
  result[1] = <usize>encoded.byteLength;
  return result;
}

/**
 * Check if a 32-byte pubkey buffer at offset in params is all zeroes (not provided).
 */
export function isPubkeyZero(paramsPtr: usize, offset: usize): bool {
  for (let i: usize = 0; i < 32; i++) {
    if (load<u8>(paramsPtr + offset + i) != 0) return false;
  }
  return true;
}

/**
 * Encode a string and pass ptr/len to req_add_tag.
 */
export function encodeString(s: string): ArrayBuffer {
  return String.UTF8.encode(s);
}
