import type { ISuite } from '#base/Suite.js';
import { SuiteTest, type CompleteOnTypeArray, type ISuiteTest } from '#base/SuiteTest.js';

import { Nip77ClientMessageGenerator } from '../index.js';

import type { INip01Filter } from '#src/nips/Nip01/interfaces/index.js';
import type { NegCloseMessage } from '../interfaces/NegClose.js';
import type { NegErrMessage } from '../interfaces/NegErr.js';
import type { NegMsgMessage } from '../interfaces/NegMsg.js';

const EMPTY_NEGENTROPY_INITIAL_MESSAGE_HEX = '610000017f9c9e31ac8256ca2f258583df262dbc';

export class NegOpen extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'NegOpen';

  private receivedType?: NegMsgMessage[0] | NegErrMessage[0] | NegCloseMessage[0];
  private receivedReason?: NegErrMessage[2];

  protected timeoutMs: number = 7000;
  completeOn: CompleteOnTypeArray = ['off'];

  constructor(suite: ISuite) {
    super(suite);
  }

  protected newSubId() {
    this.subId = String(Math.floor(Math.random() * 1_000_000_000));
  }

  private get negFilter(): INip01Filter {
    return {
      limit: 1,
    };
  }

  async prepare() {
    this.socket.send(
      Nip77ClientMessageGenerator.NEG_OPEN(this.subId, this.negFilter, EMPTY_NEGENTROPY_INITIAL_MESSAGE_HEX)
    );
    await this.testable();
  }

  test({ behavior }) {
    behavior.toBeOk(
      this.receivedType !== undefined,
      `Relay responded to NEG-OPEN${this.receivedType ? ` with ${this.receivedType}` : ''}`
    );

    if (this.receivedType === 'NEG-ERR') {
      behavior.toBeOk(this.receivedReason !== undefined, `NEG-ERR reason: ${this.receivedReason ?? 'unset'}`);
    }
  }

  _onMessageNegMsg(message: NegMsgMessage): boolean {
    if (message[1] !== this.subId) return true;
    this.receivedType = message[0];

    this.socket.send(Nip77ClientMessageGenerator.NEG_CLOSE(this.subId));
    this.test(this.expect);
    this.conclude();
    return false;
  }

  _onMessageNegErr(message: NegErrMessage): boolean {
    if (message[1] !== this.subId) return true;
    this.receivedType = message[0];
    this.receivedReason = message[2];

    this.test(this.expect);
    this.conclude();
    return false;
  }

  _onMessageNegClose(message: NegCloseMessage): boolean {
    if (message[1] !== this.subId) return true;
    this.receivedType = message[0];

    this.test(this.expect);
    this.conclude();
    return false;
  }
}

export default NegOpen;
