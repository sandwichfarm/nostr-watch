import { verifyEvent } from 'nostr-tools/pure'
import type { EventTemplate } from 'nostr-tools/pure'
import { ConversationTest } from '#base/ConversationTest.js'
import { MessageSession, MessageTimeoutError } from '#base/MessageSession.js'
import { generateSubId } from '#utils/nostr.js'
import { generateTestKeypair, signTestEvent } from '#utils/signing.js'
import type { INip01Filter, Note } from '../interfaces/index.js'

/** A prerequisite prevented a behavioral experiment; never a successful assertion. */
export class ProbeUnavailable extends Error {}

export class SubscriptionRejected extends Error {
  constructor(readonly reason: string) {
    super(`Relay refused the subscription: ${reason}`)
  }
}

/** NIP-01 semantics on top of the transport-independent conversation session. */
export class RelayConversation {
  constructor(readonly session: MessageSession) {}

  async query(filters: INip01Filter[], subId = generateSubId(), keepOpen = false, timeoutMs?: number): Promise<Note[]> {
    const after = this.session.messages.length
    this.session.send(['REQ', subId, ...filters])
    try {
      const terminal = await this.session.waitFor(
        message => (message[0] === 'EOSE' || message[0] === 'CLOSED') && message[1] === subId,
        { after, timeoutMs }
      )
      if (terminal[0] === 'CLOSED') {
        if (terminal.length !== 3 || typeof terminal[2] !== 'string' || !/^[\w-]+:\s*\S/.test(terminal[2])) {
          throw new Error('Malformed CLOSED response')
        }
        throw new SubscriptionRejected(terminal[2])
      }
      if (terminal.length !== 2) throw new Error('Malformed EOSE response')
      const end = this.session.messages.indexOf(terminal, after)
      return this.session.messages.slice(after, end)
        .filter(message => message[0] === 'EVENT' && message[1] === subId)
        .map(message => this.event(message))
    } finally {
      if (!keepOpen) this.session.send(['CLOSE', subId])
    }
  }

  event(message: any[]): Note {
    if (message.length !== 3 || typeof message[1] !== 'string' || !message[2] || !verifyEvent(message[2])) {
      throw new Error('Malformed or invalid EVENT response')
    }
    return message[2] as Note
  }

  async publish(event: Note): Promise<{ accepted: boolean, message: string }> {
    const after = this.session.messages.length
    this.session.send(['EVENT', event])
    const message = await this.session.waitFor(frame => frame[0] === 'OK' && frame[1] === event.id, { after })
    if (message.length !== 4 || typeof message[2] !== 'boolean' || typeof message[3] !== 'string' ||
        (!message[2] && !/^[\w-]+:\s*\S/.test(message[3]))) {
      throw new Error('Malformed OK response')
    }
    return { accepted: message[2], message: message[3] }
  }

  async establish(events: Note[]): Promise<void> {
    for (const event of events) {
      const result = await this.publish(event)
      if (!result.accepted) throw new ProbeUnavailable(`Fixture publish rejected: ${result.message}`)
    }
    let stored: Note[]
    try {
      stored = await this.query([{ ids: events.map(event => event.id) }])
    } catch (error) {
      if (error instanceof SubscriptionRejected) throw new ProbeUnavailable(error.message)
      throw error
    }
    if (!events.every(event => stored.some(note => note.id === event.id))) {
      throw new ProbeUnavailable('Accepted fixture events were not observable in the baseline query')
    }
  }

  async nextEvent(subId: string, eventId: string, after: number): Promise<Note> {
    const message = await this.session.waitFor(frame =>
      (frame[0] === 'EVENT' && frame[1] === subId && frame[2]?.id === eventId) ||
      (frame[0] === 'CLOSED' && frame[1] === subId), { after })
    if (message[0] === 'CLOSED') throw new Error(`Subscription ended before live delivery: ${message[2]}`)
    return this.event(message)
  }

  async hasEvent(subId: string, eventId: string, after: number, timeoutMs = 200): Promise<boolean> {
    try {
      await this.session.waitFor(frame => frame[0] === 'EVENT' && frame[1] === subId && frame[2]?.id === eventId,
        { after, timeoutMs })
      return true
    } catch (error) {
      if (error instanceof MessageTimeoutError) return false
      throw error
    }
  }
}

/** Keep conditional probe skips explicit and distinct from execution failures. */
export abstract class ProbeTest extends ConversationTest {
  protected abstract scenario(): Promise<void>

  protected async execute(): Promise<void> {
    try {
      await this.scenario()
    } catch (error) {
      if (!(error instanceof ProbeUnavailable)) throw error
      this.skip(error.message)
    }
  }

  protected assertIds(actual: Note[], expected: Note[], message: string): void {
    this.expect.behavior.toDeepEqual(actual.map(event => event.id).sort(), expected.map(event => event.id).sort(), message)
  }
}

export function probeEvents(templates: Partial<EventTemplate>[] = [{}]): Note[] {
  const { secretKey } = generateTestKeypair()
  const marker = `auditor-nip01-${generateSubId(16)}`
  const now = Math.floor(Date.now() / 1000)
  return templates.map((template, index) => signTestEvent({
    kind: 1,
    created_at: now - 30 + index,
    content: `${marker}:${index}`,
    ...template,
    tags: [['t', marker], ...(template.tags ?? [])],
  }, secretKey))
}
