import { ProbeTest, RelayConversation, ProbeUnavailable, probeEvents } from '../utils/RelayConversation.js'
import { generateSubId } from '#utils/nostr.js'

export class SubscriptionLifecycle extends ProbeTest {
  readonly slug = 'SubscriptionLifecycle'
  readonly impact = 'low-write' as const
  readonly stress = 'normal' as const

  protected async scenario() {
    const relay = new RelayConversation(await this.openSession())
    const old = probeEvents([{}, {}])
    const current = probeEvents([{}, {}, {}])
    await relay.establish([old[0], current[0]])
    const subId = generateSubId()
    const control = generateSubId()
    await relay.query([{ authors: [old[0].pubkey] }], subId, true)
    await relay.query([{ ids: [old[1].id, current[1].id, current[2].id] }], control, true)
    this.assertIds(await relay.query([{ authors: [current[0].pubkey] }], subId, true), [current[0]],
      'REQ reusing a subscription ID starts a new initial query')
    const afterReplacement = relay.session.messages.length
    for (const event of [old[1], current[1]]) {
      const result = await relay.publish(event)
      if (!result.accepted) throw new ProbeUnavailable(`Live fixture publish rejected: ${result.message}`)
      await relay.nextEvent(control, event.id, afterReplacement)
    }
    await relay.nextEvent(subId, current[1].id, afterReplacement)
    this.expect.behavior.toBeOk(!await relay.hasEvent(subId, old[1].id, afterReplacement),
      'replacement discards the old filter instead of accumulating it')
    relay.session.send(['CLOSE', subId])
    // An EOSE barrier establishes that the relay processed CLOSE before the next publish.
    await relay.query([{ ids: [current[0].id] }])
    const afterClose = relay.session.messages.length
    const result = await relay.publish(current[2])
    if (!result.accepted) throw new ProbeUnavailable(`Live fixture publish rejected: ${result.message}`)
    await relay.nextEvent(control, current[2].id, afterClose)
    this.expect.behavior.toBeOk(!await relay.hasEvent(subId, current[2].id, afterClose),
      'CLOSE stops live delivery while unrelated subscriptions remain active')
  }
}

export default SubscriptionLifecycle
