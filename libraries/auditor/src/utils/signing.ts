import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure'
import type { EventTemplate } from 'nostr-tools/pure'
import { makeAuthEvent } from 'nostr-tools/nip42'

export interface TestKeypair {
  secretKey: Uint8Array
  pubkey: string
}

export function generateTestKeypair(secretKey?: Uint8Array): TestKeypair {
  const sk = secretKey ?? generateSecretKey()
  const pubkey = getPublicKey(sk)
  return { secretKey: sk, pubkey }
}

export function signTestEvent(template: EventTemplate, secretKey: Uint8Array) {
  return finalizeEvent(template, secretKey)
}

export function signAuthEvent(relayURL: string, challenge: string, secretKey: Uint8Array) {
  const template = makeAuthEvent(relayURL, challenge)
  return finalizeEvent(template, secretKey)
}
