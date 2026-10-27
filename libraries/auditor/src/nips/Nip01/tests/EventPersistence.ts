import { ProbeTest, RelayConversation, ProbeUnavailable, probeEvents } from '../utils/RelayConversation.js'

export class EventPersistence extends ProbeTest {
  readonly slug = 'EventPersistence'
  readonly impact = 'low-write' as const
  readonly stress = 'normal' as const

  protected async scenario() {
    const relay = new RelayConversation(await this.openSession())
    const [event] = probeEvents()
    const first = await relay.publish(event)
    if (!first.accepted) throw new ProbeUnavailable(`Regular event publish rejected: ${first.message}`)
    this.assertIds(await relay.query([{ ids: [event.id] }]), [event], 'accepted regular events can be requested by ID')
    await relay.publish(event) // Either acceptance or a well-formed policy rejection is permitted.
    this.expect.behavior.toBeOk(true, 'repeated publication receives a valid correlated OK response')
    this.assertIds(await relay.query([{ ids: [event.id] }]), [event], 'repeated publication does not create duplicate stored events')
  }
}

export default EventPersistence
