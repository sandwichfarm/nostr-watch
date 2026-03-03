import { finalizeEvent, getPublicKey, type UnsignedEvent, type VerifiedEvent } from 'nostr-tools/pure'
import { nsecToBytes } from './keys'

export interface EventSigner {
  pubkey: string
  sign(event: UnsignedEvent): VerifiedEvent
}

/**
 * Create an EventSigner from an nsec or hex private key.
 */
export function createSigner(key: string): EventSigner {
  const secretKeyBytes = nsecToBytes(key)
  const pubkey = getPublicKey(secretKeyBytes)

  return {
    pubkey,
    sign(event: UnsignedEvent): VerifiedEvent {
      return finalizeEvent(event, secretKeyBytes)
    },
  }
}
