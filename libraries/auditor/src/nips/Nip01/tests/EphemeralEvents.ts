import { ProbeTest, RelayConversation, ProbeUnavailable, probeEvents } from '../utils/RelayConversation.js'
import { generateSubId } from '#utils/nostr.js'

export class EphemeralEvents extends ProbeTest {
  readonly slug = 'EphemeralEvents'
  readonly impact = 'low-write' as const
  readonly stress = 'normal' as const

  protected async scenario() {
    const relay = new RelayConversation(await this.openSession())
    const [control, event] = probeEvents([{}, { kind: 20001 }])
    await relay.establish([control])
    const subId = generateSubId()
    await relay.query([{ authors: [event.pubkey], kinds: [event.kind] }], subId, true)
    const after = relay.session.messages.length
    const result = await relay.publish(event)
    if (!result.accepted) throw new ProbeUnavailable(`Ephemeral fixture publish rejected: ${result.message}`)
    await relay.nextEvent(subId, event.id, after)
    this.expect.behavior.toBeOk(true, 'matching ephemeral event is delivered to a live subscription')
    this.assertIds(await relay.query([{ ids: [event.id] }]), [], 'ephemeral events are not returned as stored history')
  }
}

export default EphemeralEvents
