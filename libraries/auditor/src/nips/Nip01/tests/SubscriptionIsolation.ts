import { ProbeTest, RelayConversation, ProbeUnavailable, probeEvents } from '../utils/RelayConversation.js'
import { generateSubId } from '#utils/nostr.js'

export class SubscriptionIsolation extends ProbeTest {
  readonly slug = 'SubscriptionIsolation'
  readonly impact = 'low-write' as const
  readonly stress = 'normal' as const

  protected async scenario() {
    const left = new RelayConversation(await this.openSession())
    const right = new RelayConversation(await this.openSession())
    const a = probeEvents([{}, {}, {}])
    const b = probeEvents([{}, {}])
    await left.establish([a[0], b[0]])
    const sharedId = generateSubId()
    this.assertIds(await left.query([{ authors: [a[0].pubkey] }], sharedId, true), [a[0]],
      'first connection owns its subscription')
    this.assertIds(await right.query([{ authors: [b[0].pubkey] }], sharedId, true), [b[0]],
      'same ID on another connection owns an independent subscription')
    const afterLeft = left.session.messages.length
    const afterRight = right.session.messages.length
    for (const event of [a[1], b[1]]) {
      const result = await left.publish(event)
      if (!result.accepted) throw new ProbeUnavailable(`Live fixture publish rejected: ${result.message}`)
    }
    await left.nextEvent(sharedId, a[1].id, afterLeft)
    await right.nextEvent(sharedId, b[1].id, afterRight)
    this.expect.behavior.toBeOk(!await left.hasEvent(sharedId, b[1].id, afterLeft),
      'second connection filter does not leak into first connection')
    this.expect.behavior.toBeOk(!await right.hasEvent(sharedId, a[1].id, afterRight),
      'first connection filter does not leak into second connection')
    right.session.send(['CLOSE', sharedId])
    await right.query([{ ids: [b[0].id] }])
    const after = left.session.messages.length
    const result = await left.publish(a[2])
    if (!result.accepted) throw new ProbeUnavailable(`Live fixture publish rejected: ${result.message}`)
    await left.nextEvent(sharedId, a[2].id, after)
    this.expect.behavior.toBeOk(true, 'closing a subscription on another connection does not close the first')
  }
}

export default SubscriptionIsolation
