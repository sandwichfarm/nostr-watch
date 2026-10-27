import { ProbeTest, RelayConversation, ProbeUnavailable, probeEvents } from '../utils/RelayConversation.js'
import { generateSubId } from '#utils/nostr.js'

export class LimitLive extends ProbeTest {
  readonly slug = 'LimitLive'
  readonly impact = 'low-write' as const
  readonly stress = 'normal' as const

  protected async scenario() {
    const relay = new RelayConversation(await this.openSession())
    const [stored, ...live] = probeEvents([{}, {}, {}])
    await relay.establish([stored])
    const subId = generateSubId()
    this.assertIds(await relay.query([{ authors: [stored.pubkey], limit: 0 }], subId, true), [],
      'limit zero sends EOSE without returning stored events')
    const limited = generateSubId()
    this.assertIds(await relay.query([{ authors: [stored.pubkey], limit: 1 }], limited, true), [stored],
      'positive initial limit returns the observed stored event')
    const after = relay.session.messages.length
    for (const event of live) {
      const result = await relay.publish(event)
      if (!result.accepted) throw new ProbeUnavailable(`Live fixture publish rejected: ${result.message}`)
      await relay.nextEvent(subId, event.id, after)
      await relay.nextEvent(limited, event.id, after)
    }
    this.expect.behavior.toBeOk(true, 'zero and positive limits remain active for multiple matching live events')
  }
}

export default LimitLive
