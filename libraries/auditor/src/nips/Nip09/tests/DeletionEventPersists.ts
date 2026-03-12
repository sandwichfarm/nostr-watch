import type {ISuite} from '#base/Suite.js'
import {SuiteTest, type CompleteOnTypeArray, type ISuiteTest} from '#base/SuiteTest.js'
import {generateTestKeypair, signTestEvent} from '#utils/signing.js'
import type {RelayOkMessage, RelayEventMessage} from '#src/nips/Nip01/interfaces/index.js'
import type {TestKeypair} from '#utils/signing.js'

export class DeletionEventPersists extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'DeletionEventPersists'

  completeOn: CompleteOnTypeArray = ['off']

  private keypair: TestKeypair | null = null
  private publishedEventId: string | null = null
  private deletionEventId: string | null = null
  private phase: 'awaiting-publish-ok' | 'awaiting-delete-ok' | 'querying' | 'done' = 'awaiting-publish-ok'
  private publishOkAccepted = false
  private deletionEventReturned = false

  constructor(suite: ISuite) {
    super(suite)
  }

  async prepare() {
    this.keypair = generateTestKeypair()
    const testEvent = signTestEvent(
      {kind: 1, created_at: Math.floor(Date.now() / 1000), tags: [], content: 'auditor-nip09-persistence-test'},
      this.keypair.secretKey
    )
    this.publishedEventId = testEvent.id
    this.phase = 'awaiting-publish-ok'
    this.socket.send(JSON.stringify(['EVENT', testEvent]))
  }

  _onMessageOk(message: RelayOkMessage): boolean {
    if (this.phase === 'awaiting-publish-ok') {
      if (message[1] !== this.publishedEventId) return true
      this.publishOkAccepted = message[2]
      if (!message[2]) {
        this.test(this.expect)
        this.conclude()
        return false
      }
      this.phase = 'awaiting-delete-ok'
      const deletionEvent = signTestEvent(
        {kind: 5, created_at: Math.floor(Date.now() / 1000), tags: [['e', this.publishedEventId!]], content: ''},
        this.keypair!.secretKey
      )
      this.deletionEventId = deletionEvent.id
      this.socket.send(JSON.stringify(['EVENT', deletionEvent]))
      return false
    }
    if (this.phase === 'awaiting-delete-ok') {
      if (message[1] !== this.deletionEventId) return true
      this.phase = 'querying'
      setTimeout(() => {
        this.REQ([{ids: [this.deletionEventId!]}])
      }, 300)
      return false
    }
    return true
  }

  _onMessageEvent(message: RelayEventMessage): boolean {
    if (this.phase === 'querying') {
      this.deletionEventReturned = true
    }
    return true
  }

  _onMessageEose(): boolean {
    if (this.phase === 'querying') {
      this.phase = 'done'
      this.test(this.expect)
      this.conclude()
      return false
    }
    return true
  }

  test({behavior}) {
    behavior.toBeOk(this.publishOkAccepted, 'relay accepted test event publication')
    behavior.toBeOk(this.deletionEventReturned, 'relay returned the kind-5 deletion event when queried')
  }
}

export default DeletionEventPersists
