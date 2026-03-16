import type {ISuite} from '#base/Suite.js'
import {SuiteTest, type CompleteOnTypeArray, type ISuiteTest} from '#base/SuiteTest.js'
import {generateTestKeypair, signTestEvent, signAuthEvent, type TestKeypair} from '#utils/signing.js'
import type {RelayOkMessage} from '#src/nips/Nip01/interfaces/index.js'

export class AcceptAuthenticated extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'AcceptAuthenticated'

  completeOn: CompleteOnTypeArray = ['off']

  private phase: 'awaiting-auth-ok' | 'awaiting-event-ok' | 'done' = 'awaiting-auth-ok'
  private keypair: TestKeypair | null = null
  private authEventId: string | null = null
  private protectedEventId: string | null = null
  private authOkAccepted = false
  private eventOkAccepted = false

  constructor(suite: ISuite) {
    super(suite)
  }

  async prepare() {
    // Clear stale challenge from a previous test's connection
    this.suite.state.set('challenge', undefined)

    const deadline = Date.now() + 3000
    let challenge: string | undefined
    while (Date.now() < deadline) {
      challenge = this.suite.state.get<string>('challenge')
      if (challenge) break
      await new Promise(r => setTimeout(r, 100))
    }

    if (!challenge) {
      // Relay does not support AUTH — skip gracefully
      this.expect.behavior.skip = true
      this.test(this.expect)
      this.conclude()
      return
    }

    this.keypair = generateTestKeypair()
    const authEvent = signAuthEvent(this.socket.url, challenge, this.keypair.secretKey)
    this.authEventId = authEvent.id
    this.socket.send(JSON.stringify(['AUTH', authEvent]))
  }

  _onMessageOk(message: RelayOkMessage): boolean {
    if (this.phase === 'awaiting-auth-ok' && message[1] === this.authEventId) {
      this.authOkAccepted = message[2]
      if (!this.authOkAccepted) {
        // Relay rejected our AUTH — test now
        this.test(this.expect)
        this.conclude()
        return false
      }
      // AUTH accepted — send protected event with same keypair
      this.phase = 'awaiting-event-ok'
      const protectedEvent = signTestEvent(
        {
          kind: 1,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['-']],
          content: 'auditor-nip70-auth-test'
        },
        this.keypair!.secretKey
      )
      this.protectedEventId = protectedEvent.id
      this.socket.send(JSON.stringify(['EVENT', protectedEvent]))
      return false
    }

    if (this.phase === 'awaiting-event-ok' && message[1] === this.protectedEventId) {
      this.eventOkAccepted = message[2]
      this.phase = 'done'
      this.test(this.expect)
      this.conclude()
      return false
    }

    return true
  }

  test({behavior}) {
    behavior.toBeOk(this.authOkAccepted, 'AUTH handshake succeeded with matching pubkey')
    behavior.toBeOk(this.eventOkAccepted, 'relay accepted protected event when authenticated with matching pubkey')
  }
}

export default AcceptAuthenticated
