import { ProbeTest, RelayConversation, ProbeUnavailable, probeEvents } from '../utils/RelayConversation.js'

export class ReplaceableEvents extends ProbeTest {
  readonly slug = 'ReplaceableEvents'
  readonly impact = 'low-write' as const
  readonly stress = 'normal' as const

  protected async scenario() {
    const relay = new RelayConversation(await this.openSession())
    const now = Math.floor(Date.now() / 1000) - 30
    const events = probeEvents([0, 1, 1, -1].map(offset => ({ kind: 10001, created_at: now + offset })))
    const ties = events.slice(1, 3).sort((a, b) => a.id.localeCompare(b.id))
    // Send the lexically larger tied ID first, then the winner, then an older arrival.
    for (const event of [events[0], ties[1], ties[0]]) {
      const result = await relay.publish(event)
      if (!result.accepted) throw new ProbeUnavailable(`Replaceable fixture publish rejected: ${result.message}`)
    }
    await relay.publish(events[3]) // Rejecting an outdated replacement is acceptable.
    this.assertIds(await relay.query([{ authors: [events[0].pubkey], kinds: [10001] }]), [ties[0]],
      'replaceable queries return the newest event and the lowest ID for timestamp ties')
  }
}

export default ReplaceableEvents
