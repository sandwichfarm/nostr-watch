import * as nip19 from 'nostr-tools/nip19'
import { hexToBytes, bytesToHex } from '@noble/hashes/utils'

/**
 * Convert nsec1 or hex private key to Uint8Array.
 * Throws on invalid input.
 */
export function nsecToBytes(key: string): Uint8Array {
  const trimmed = key.trim()

  if (trimmed.startsWith('nsec1')) {
    const decoded = nip19.decode(trimmed)
    if (decoded.type !== 'nsec') {
      throw new Error('Expected nsec key')
    }
    return decoded.data
  }

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return hexToBytes(trimmed)
  }

  throw new Error('Invalid key format: expected nsec1... or 64-character hex')
}

/**
 * Convert nsec1 or hex private key to hex string.
 * Throws on invalid input.
 */
export function nsecToHex(key: string): string {
  const trimmed = key.trim()

  if (trimmed.startsWith('nsec1')) {
    const decoded = nip19.decode(trimmed)
    if (decoded.type !== 'nsec') {
      throw new Error('Expected nsec key')
    }
    return bytesToHex(decoded.data)
  }

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return trimmed
  }

  throw new Error('Invalid key format: expected nsec1... or 64-character hex')
}

/**
 * Like nsecToHex but returns empty string on failure.
 * Useful for reading from environment variables.
 */
export function tryNsecToHex(key: string | undefined): string {
  if (!key) return ''
  try {
    return nsecToHex(key)
  } catch {
    return ''
  }
}
