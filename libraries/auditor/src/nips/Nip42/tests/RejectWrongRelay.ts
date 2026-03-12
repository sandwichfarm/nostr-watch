import type {ISuite} from '#base/Suite.js'
import {SuiteTest, type CompleteOnTypeArray, type ISuiteTest} from '#base/SuiteTest.js'
import {signTestEvent, generateTestKeypair} from '#utils/signing.js'
import type {RelayOkMessage} from '#src/nips/Nip01/interfaces/index.js'
import type {EventTemplate} from 'nostr-tools/pure'

export class RejectWrongRelay extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'RejectWrongRelay'

  completeOn: CompleteOnTypeArray = ['off']

  private okReceived = false
  private okAccepted = false
  private okMessage = ''
  private sentAuthEventId: string | null = null
  private capturedChallenge: string | undefined

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

    this.capturedChallenge = challenge

    if (!challenge) {
      this.test(this.expect)
      this.conclude()
      return
    }

    const {secretKey} = generateTestKeypair()
    const template: EventTemplate = {
      kind: 22242,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['relay', 'wss://wrong-relay.example.com'], ['challenge', challenge]],
      content: ''
    }
    const authEvent = signTestEvent(template, secretKey)
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
      this.capturedChallenge !== undefined,
      'relay sent AUTH challenge'
    )
    behavior.toBeOk(this.okReceived, 'relay responded with OK to wrong-relay AUTH')
    behavior.toBeOk(
      !this.okAccepted,
      'relay rejected AUTH with wrong relay URL (OK false)' + (this.okMessage ? ': ' + this.okMessage : '')
    )
  }
}

export default RejectWrongRelay
