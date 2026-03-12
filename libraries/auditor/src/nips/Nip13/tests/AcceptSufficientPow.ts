import type {ISuite} from '#base/Suite.js'
import {SuiteTest, type CompleteOnTypeArray, type ISuiteTest} from '#base/SuiteTest.js'
import {generateTestKeypair} from '#utils/signing.js'
import type {RelayOkMessage} from '#src/nips/Nip01/interfaces/index.js'
import {minePow} from 'nostr-tools/nip13'
import {finalizeEvent} from 'nostr-tools/pure'

export class AcceptSufficientPow extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'AcceptSufficientPow'

  completeOn: CompleteOnTypeArray = ['off']

  protected timeoutMs = 30000

  private sentEventId: string | null = null
  private okReceived = false
  private okAccepted = false
  private okMessage = ''

  constructor(suite: ISuite) {
    super(suite)
  }

  async prepare() {
    const relayUrl = this.socket.url.replace(/^wss?:\/\//, 'https://')
    let minPow = 0
    let authRequired = false

    try {
      const res = await fetch(relayUrl, {
        headers: {Accept: 'application/nostr+json'},
        signal: AbortSignal.timeout(5000)
      })
      const info = await res.json()
      minPow = info?.limitation?.min_pow_difficulty ?? 0
      authRequired = info?.limitation?.auth_required ?? false
    } catch {
      // fetch failed — treat as no PoW requirement
    }

    if (!minPow || minPow <= 0 || authRequired) {
      this.expect.behavior.skip = true
      this.test(this.expect)
      this.conclude()
      return
    }

    const {secretKey, pubkey} = generateTestKeypair()
    const unsigned = {
      kind: 1,
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [] as string[][],
      content: 'auditor-nip13-sufficient-pow'
    }
    const mined = minePow(unsigned, minPow)
    const event = finalizeEvent(mined, secretKey)
    this.sentEventId = event.id
    this.socket.send(JSON.stringify(['EVENT', event]))
  }

  _onMessageOk(message: RelayOkMessage): boolean {
    if (message[1] !== this.sentEventId) return true
    this.okReceived = true
    this.okAccepted = message[2]
    this.okMessage = message[3] ?? ''
    this.test(this.expect)
    this.conclude()
    return false
  }

  test({behavior}) {
    behavior.toBeOk(this.okReceived, 'relay responded to sufficient-PoW event')
    behavior.toBeOk(this.okAccepted, 'relay accepted event meeting min_pow_difficulty' + (this.okMessage && !this.okAccepted ? ': ' + this.okMessage : ''))
  }
}

export default AcceptSufficientPow
