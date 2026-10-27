import { MessageTimeoutError } from '#base/MessageSession.js'
import { generateSubId } from '#utils/nostr.js'
import { ProbeTest, RelayConversation, SubscriptionRejected } from '../utils/RelayConversation.js'
import type { Note } from '../interfaces/index.js'

/** A finite read probe can find possible aliases, never prove relay identity. */
export class ChildPath extends ProbeTest {
  readonly slug = 'ChildPath'
  readonly impact = 'read' as const
  readonly stress = 'normal' as const
  protected timeoutMs = 15000

  protected async scenario(): Promise<void> {
    const parent = new RelayConversation(await this.openSession())
    const filters = [{ limit: 5 }]
    const before = await parent.query(filters, undefined, false, 2000)
    const childUrl = new URL(this.socket.url)
    childUrl.pathname = `${childUrl.pathname.replace(/\/$/, '')}/auditor-${generateSubId(16)}`
    // Preserve query parameters: they may select a tenant or authenticate the endpoint.
    this.data.childPath = childUrl.pathname
    let child: RelayConversation
    try {
      child = new RelayConversation(await this.openSession(childUrl.href))
    } catch (error) {
      await parent.query(filters, undefined, false, 2000)
      this.data.observation = 'child connection unavailable while parent remains responsive'
      this.data.detail = error instanceof Error ? error.message : String(error)
      // An opaque connection error could be a timeout, proxy, TLS or network failure.
      // Without an HTTP rejection status it cannot prove endpoint conformance.
      this.skip('Child connection unavailable; transport does not establish an explicit endpoint rejection')
      return
    }

    let childEvents: Note[]
    try {
      childEvents = await child.query(filters, undefined, false, 1000)
    } catch (error) {
      if (error instanceof SubscriptionRejected) {
        this.data.observation = 'child has a distinct subscription policy'
        this.expect.behavior.toBeOk(true, 'child path changes subscription behavior')
        return
      }
      if (error instanceof MessageTimeoutError) {
        this.data.observation = 'child connected but did not complete its query'
        this.skip('Child did not complete a query; endpoint behavior is inconclusive')
        return
      }
      throw error
    }

    const after = await parent.query(filters, undefined, false, 2000)
    const fingerprint = (events: Note[]) => JSON.stringify(events.map(event => event.id).sort())
    if (fingerprint(before) !== fingerprint(after)) {
      this.data.observation = 'parent changed during comparison'
      this.skip('Parent result changed during child-path comparison')
      return
    }
    if (fingerprint(before) !== fingerprint(childEvents)) {
      this.data.observation = 'child returned a different event set'
      this.expect.behavior.toBeOk(true, 'child path changes query results')
      return
    }
    if (before.length === 0) {
      this.data.observation = 'both queries returned no events'
      this.skip('Empty parent and child responses cannot identify a relay alias')
      return
    }

    // Re-query exact event IDs to avoid confusing unrelated relays sharing a top feed.
    const ids = before.map(event => event.id)
    const parentExact = await parent.query([{ ids }], undefined, false, 2000)
    const childExact = await child.query([{ ids }], undefined, false, 1000)
    if (fingerprint(parentExact) !== fingerprint(before)) {
      this.skip('Parent baseline events no longer observable during endpoint confirmation')
      return
    }
    this.data.observation = fingerprint(parentExact) === fingerprint(childExact)
      ? 'child accepted two queries with identical nonempty results'
      : 'child exact-ID query differs'
    if (fingerprint(parentExact) === fingerprint(childExact)) {
      this.data.possibleAlias = true
      this.skip('Possible child-path alias: identical reads cannot rule out a separate relay or other changed behavior')
    } else {
      this.expect.behavior.toBeOk(true, 'child path changes exact-ID query results')
    }
  }
}

export default ChildPath
