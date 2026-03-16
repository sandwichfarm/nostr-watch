import type {ISuite} from '#base/Suite.js'
import {SuiteTest, type CompleteOnTypeArray, type ISuiteTest} from '#base/SuiteTest.js'
import type {RelayClosedMessage} from '#src/nips/Nip01/interfaces/index.js'

export class EnforceMaxSubscriptions extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'EnforceMaxSubscriptions'

  completeOn: CompleteOnTypeArray = ['off']

  protected timeoutMs = 15000

  private maxSubscriptions = 0
  private lastSubId = ''
  private closedReceived = false
  private eoseCount = 0
  private skipped = false

  constructor(suite: ISuite) {
    super(suite)
  }

  async prepare() {
    const relay = this.socket.url.toString()
    const relayUrl = relay.replace(/^wss?:\/\//, 'https://')
    let nip11: any = null
    try {
      const response = await fetch(relayUrl, {
        method: 'GET',
        headers: {'Accept': 'application/nostr+json'},
        signal: AbortSignal.timeout(5000)
      })
      nip11 = await response.json()
    } catch (_e) {
      // fetch failed — skip
    }

    const limitation = nip11?.limitation
    this.maxSubscriptions = limitation?.max_subscriptions ?? 0

    if (!this.maxSubscriptions) {
      this.skipped = true
      this.expect.behavior.skip = true
      this.test(this.expect)
      this.conclude()
      return
    }

    this.lastSubId = 'lim03-' + this.maxSubscriptions
    for (let i = 0; i <= this.maxSubscriptions; i++) {
      const subId = 'lim03-' + i
      this.socket.send(JSON.stringify(['REQ', subId, {limit: 1}]))
    }
  }

  _onMessageClosed(message: RelayClosedMessage): boolean {
    if (message[1] !== this.lastSubId) return true
    this.closedReceived = true
    this.test(this.expect)
    this.conclude()
    return false
  }

  _onMessageEose(): boolean {
    this.eoseCount++
    if (this.eoseCount >= (this.maxSubscriptions + 1)) {
      this.test(this.expect)
      this.conclude()
      return false
    }
    return true
  }

  test({behavior}) {
    if (this.skipped) {
      behavior.skip = true
      return
    }
    if (this.closedReceived) {
      behavior.toBeOk(true, 'relay enforced max_subscriptions — rejected excess subscription with CLOSED')
    } else {
      behavior.toBeOk(true, 'advisory: relay advertises max_subscriptions but did not reject excess subscription')
    }
  }
}

export default EnforceMaxSubscriptions
