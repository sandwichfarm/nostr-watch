import type {ISuite} from '#base/Suite.js'
import {SuiteTest, type CompleteOnTypeArray, type ISuiteTest} from '#base/SuiteTest.js'
import {generateTestKeypair, signTestEvent} from '#utils/signing.js'
import type {RelayOkMessage, RelayEventMessage} from '#src/nips/Nip01/interfaces/index.js'
import type {TestKeypair} from '#utils/signing.js'

export class DeleteByATag extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'DeleteByATag'

  completeOn: CompleteOnTypeArray = ['off']

  private keypair: TestKeypair | null = null
  private publishedEventId: string | null = null
  private deletionEventId: string | null = null
  private aTag: string | null = null
  private phase: 'awaiting-publish-ok' | 'awaiting-delete-ok' | 'querying' | 'done' = 'awaiting-publish-ok'
  private publishOkAccepted = false
  private eventReturnedAfterDeletion = false

  constructor(suite: ISuite) {
    super(suite)
  }

  async prepare() {
    this.keypair = generateTestKeypair()
    this.aTag = `${10001}:${this.keypair.pubkey}:`
    const testEvent = signTestEvent(
      {kind: 10001, created_at: Math.floor(Date.now() / 1000), tags: [], content: ''},
      this.keypair.secretKey
    )
    this.publishedEventId = testEvent.id
    this.phase = 'awaiting-publish-ok'
    this.socket.send(JSON.stringify(['EVENT', testEvent]))
  }

  _onMessageOk(message: RelayOkMessage): boolean {
    if (this.phase === 'awaiting-publish-ok') {
      if (message[1] !== this.publishedEventId) return true
      if (!message[2]) {
        this.expect.behavior.skip = true
        this.expect.behavior.toBeOk(true, 'Skipped: relay rejected kind 10001 replaceable event')
        this.conclude()
        return false
      }
      this.publishOkAccepted = message[2]
      this.phase = 'awaiting-delete-ok'
      const deletionEvent = signTestEvent(
        {kind: 5, created_at: Math.floor(Date.now() / 1000), tags: [['a', this.aTag!]], content: ''},
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
        this.REQ([{kinds: [10001], authors: [this.keypair!.pubkey]}])
      }, 300)
      return false
    }
    return true
  }

  _onMessageEvent(message: RelayEventMessage): boolean {
    if (this.phase === 'querying') {
      this.eventReturnedAfterDeletion = true
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
    behavior.toBeOk(this.publishOkAccepted, 'relay accepted kind 10001 replaceable event publication')
    behavior.toBeOk(!this.eventReturnedAfterDeletion, 'relay did not serve replaceable event after kind-5 a-tag deletion')
  }
}

export default DeleteByATag
