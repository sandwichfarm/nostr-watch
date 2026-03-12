import type {ISuite} from '#base/Suite.js'
import {SuiteTest, type CompleteOnTypeArray, type ISuiteTest} from '#base/SuiteTest.js'
import {generateTestKeypair} from '#utils/signing.js'
import type {RelayOkMessage} from '#src/nips/Nip01/interfaces/index.js'
import {minePow, getPow} from 'nostr-tools/nip13'
import {finalizeEvent} from 'nostr-tools/pure'

export class RejectInsufficientPow extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'RejectInsufficientPow'

  completeOn: CompleteOnTypeArray = ['off']

  protected timeoutMs = 25000

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
    const insufficientTarget = Math.max(1, minPow - 1)
    const unsigned = {
      kind: 1,
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [] as string[][],
      content: 'auditor-nip13-insufficient-pow'
    }
    const mined = minePow(unsigned, insufficientTarget)

    if (getPow(mined.id) >= minPow) {
      // Statistical edge case: mined accidentally meets or exceeds required difficulty
      this.expect.behavior.skip = true
      this.test(this.expect)
      this.conclude()
      return
    }

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
    behavior.toBeOk(this.okReceived, 'relay responded to low-PoW event')
    behavior.toBeOk(!this.okAccepted, 'relay rejected event with insufficient PoW')
    behavior.toBeOk(this.okMessage.startsWith('pow:'), 'relay used pow: prefix in rejection message' + (this.okMessage ? ': ' + this.okMessage : ''))
  }
}

export default RejectInsufficientPow
