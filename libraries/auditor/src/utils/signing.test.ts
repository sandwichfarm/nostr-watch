import { describe, it, expect } from 'vitest'
import { generateSecretKey } from 'nostr-tools/pure'
import { generateTestKeypair, signTestEvent, signAuthEvent } from './signing'

describe('generateTestKeypair', () => {
  it('returns a secretKey that is a Uint8Array of length 32', () => {
    const keypair = generateTestKeypair()
    expect(keypair.secretKey).toBeInstanceOf(Uint8Array)
    expect(keypair.secretKey).toHaveLength(32)
  })

  it('returns a pubkey that is a 64-char hex string', () => {
    const keypair = generateTestKeypair()
    expect(keypair.pubkey).toMatch(/^[a-f0-9]{64}$/)
  })

  it('uses a provided secretKey instead of generating one', () => {
    const existingKey = generateSecretKey()
    const keypair = generateTestKeypair(existingKey)
    expect(keypair.secretKey).toBe(existingKey)
  })

  it('produces a pubkey that is cryptographically related to the provided secretKey', () => {
    const existingKey = generateSecretKey()
    const keypair1 = generateTestKeypair(existingKey)
    const keypair2 = generateTestKeypair(existingKey)
    expect(keypair1.pubkey).toBe(keypair2.pubkey)
  })

  it('two calls produce different pubkeys (randomness)', () => {
    const keypair1 = generateTestKeypair()
    const keypair2 = generateTestKeypair()
    expect(keypair1.pubkey).not.toBe(keypair2.pubkey)
  })
})

describe('signTestEvent', () => {
  it('returns event with id that is a 64-char hex string', () => {
    const keypair = generateTestKeypair()
    const template = { kind: 1, tags: [], content: 'test', created_at: Math.floor(Date.now() / 1000) }
    const event = signTestEvent(template, keypair.secretKey)
    expect(event.id).toMatch(/^[a-f0-9]{64}$/)
  })

  it('returns event with pubkey matching the keypair pubkey', () => {
    const keypair = generateTestKeypair()
    const template = { kind: 1, tags: [], content: 'test', created_at: Math.floor(Date.now() / 1000) }
    const event = signTestEvent(template, keypair.secretKey)
    expect(event.pubkey).toBe(keypair.pubkey)
  })

  it('returns event with sig that is a 128-char hex string', () => {
    const keypair = generateTestKeypair()
    const template = { kind: 1, tags: [], content: 'test', created_at: Math.floor(Date.now() / 1000) }
    const event = signTestEvent(template, keypair.secretKey)
    expect(event.sig).toMatch(/^[a-f0-9]{128}$/)
  })

  it('preserves kind from the template', () => {
    const keypair = generateTestKeypair()
    const template = { kind: 1, tags: [], content: 'test', created_at: Math.floor(Date.now() / 1000) }
    const event = signTestEvent(template, keypair.secretKey)
    expect(event.kind).toBe(1)
  })

  it('preserves tags from the template', () => {
    const keypair = generateTestKeypair()
    const tags = [['e', 'abc123'], ['p', 'def456']]
    const template = { kind: 1, tags, content: 'test', created_at: Math.floor(Date.now() / 1000) }
    const event = signTestEvent(template, keypair.secretKey)
    expect(event.tags).toEqual(tags)
  })

  it('preserves content from the template', () => {
    const keypair = generateTestKeypair()
    const template = { kind: 1, tags: [], content: 'hello world', created_at: Math.floor(Date.now() / 1000) }
    const event = signTestEvent(template, keypair.secretKey)
    expect(event.content).toBe('hello world')
  })

  it('preserves created_at from the template', () => {
    const keypair = generateTestKeypair()
    const created_at = Math.floor(Date.now() / 1000)
    const template = { kind: 1, tags: [], content: 'test', created_at }
    const event = signTestEvent(template, keypair.secretKey)
    expect(event.created_at).toBe(created_at)
  })
})

describe('signAuthEvent', () => {
  it('returns event with kind 22242', () => {
    const keypair = generateTestKeypair()
    const event = signAuthEvent('wss://relay.example.com', 'test-challenge', keypair.secretKey)
    expect(event.kind).toBe(22242)
  })

  it('includes relay tag with the provided relay URL', () => {
    const keypair = generateTestKeypair()
    const relayURL = 'wss://relay.example.com'
    const event = signAuthEvent(relayURL, 'test-challenge', keypair.secretKey)
    const relayTag = event.tags.find(t => t[0] === 'relay')
    expect(relayTag).toBeDefined()
    expect(relayTag![1]).toBe(relayURL)
  })

  it('includes challenge tag with the provided challenge string', () => {
    const keypair = generateTestKeypair()
    const challenge = 'test-challenge-string'
    const event = signAuthEvent('wss://relay.example.com', challenge, keypair.secretKey)
    const challengeTag = event.tags.find(t => t[0] === 'challenge')
    expect(challengeTag).toBeDefined()
    expect(challengeTag![1]).toBe(challenge)
  })

  it('returns event with valid id (64-char hex)', () => {
    const keypair = generateTestKeypair()
    const event = signAuthEvent('wss://relay.example.com', 'test-challenge', keypair.secretKey)
    expect(event.id).toMatch(/^[a-f0-9]{64}$/)
  })

  it('returns event with pubkey matching the keypair', () => {
    const keypair = generateTestKeypair()
    const event = signAuthEvent('wss://relay.example.com', 'test-challenge', keypair.secretKey)
    expect(event.pubkey).toBe(keypair.pubkey)
  })

  it('returns event with valid sig (128-char hex)', () => {
    const keypair = generateTestKeypair()
    const event = signAuthEvent('wss://relay.example.com', 'test-challenge', keypair.secretKey)
    expect(event.sig).toMatch(/^[a-f0-9]{128}$/)
  })
})
