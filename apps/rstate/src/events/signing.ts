/**
 * Event Signing Utility
 *
 * Wraps nostr-tools finalizeEvent for NIP-66 event signing
 */

import { finalizeEvent, type UnsignedEvent, type VerifiedEvent } from 'nostr-tools/pure'
import { hexToBytes } from '@noble/hashes/utils'
import { getPublicKey } from 'nostr-tools/pure'
import * as nip19 from 'nostr-tools/nip19'

export interface EventSigner {
  pubkey: string
  sign(event: UnsignedEvent): VerifiedEvent
}

/**
 * Create a signer from an nsec or hex private key
 */
export function createSigner(key: string): EventSigner {
  const secretKeyBytes = decodeKey(key)
  const pubkey = getPublicKey(secretKeyBytes)

  return {
    pubkey,
    sign(event: UnsignedEvent): VerifiedEvent {
      return finalizeEvent(event, secretKeyBytes)
    },
  }
}

function decodeKey(key: string): Uint8Array {
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
