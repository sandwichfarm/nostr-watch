import type {ISuite} from '#base/Suite.js'
import {SuiteTest, type CompleteOnTypeArray, type ISuiteTest} from '#base/SuiteTest.js'
import {signAuthEvent, generateTestKeypair} from '#utils/signing.js'
import type {RelayOkMessage} from '#src/nips/Nip01/interfaces/index.js'

export class CompleteHandshake extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'CompleteHandshake'

  completeOn: CompleteOnTypeArray = ['off']

  private okReceived = false
  private okAccepted = false
  private okMessage = ''
  private sentAuthEventId: string | null = null

  constructor(suite: ISuite) {
    super(suite)
  }

  async prepare() {
    const deadline = Date.now() + 3000
    let challenge: string | undefined
    while (Date.now() < deadline) {
      challenge = this.suite.state.get<string>('challenge')
      if (challenge) break
      await new Promise(r => setTimeout(r, 100))
    }

    if (!challenge) {
      this.test(this.expect)
      this.conclude()
      return
    }

    const {secretKey} = generateTestKeypair()
    const relayUrl = this.socket.url
    const authEvent = signAuthEvent(relayUrl, challenge, secretKey)
    this.sentAuthEventId = authEvent.id
    this.socket.send(JSON.stringify(['AUTH', authEvent]))
  }

  _onMessageOk(message: RelayOkMessage): boolean {
    if (message[1] !== this.sentAuthEventId) return true
    this.okReceived = true
    this.okAccepted = message[2]
    this.okMessage = message[3] ?? ''
    this.test(this.expect)
    this.conclude()
    return false
  }

  test({behavior}) {
    behavior.toBeOk(
      this.suite.state.get('challenge') !== undefined,
      'relay sent AUTH challenge'
    )
    behavior.toBeOk(this.okReceived, 'relay responded with OK to AUTH event')
    behavior.toBeOk(
      this.okAccepted,
      'relay accepted valid AUTH (OK true)' + (this.okMessage ? ': ' + this.okMessage : '')
    )
  }
}

export default CompleteHandshake
