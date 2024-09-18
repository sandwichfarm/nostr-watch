import { ISuiteTest, SuiteTest } from '#base/SuiteTest.js';
import { ISuite } from '#base/Suite.js';

import { Nip01Filter, Note, RelayEventMessage } from '../interfaces/index.js';
import { RangeIngestor } from "../ingestors/RangeIngestor.js";
import { is64CharHex } from '#src/utils/nostr.js';

export class FilterAuthor extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'FilterAuthor';

  maxEvents: number = 3;
  authorsReturned: string[] = [];
  author: string = '';
  limit: number = 1;
  filters: Nip01Filter[] = [{ authors: [ this.author ], limit: this.limit }];

  constructor(suite: ISuite) {
    super(suite, new RangeIngestor());
  }

  async prepare() {
    this.author = this.ingestor.poop()[0]
    this.REQ(this.filters)
    await this.testable();
  }

  onMessageEvent(message: RelayEventMessage){
    const note = message?.[2]; 
    if(!note) return;
    this.authorsReturned.push(message[2].pubkey);
  }

  test({behavior, conditions}){
    conditions.toBeOk(typeof this.author === 'string', 'sampled data is sufficient for test');
    conditions.toBeOk(is64CharHex(this.author), 'author pubkey looks valid');

    const returnedOnlyFromAuthor = this.authorsReturned.every(author => author === this.author);
    behavior.toBeOk(this.authorsReturned.length > 0, 'returned at least one event from author with pubkey ${this.author}');
    behavior.toBeOk(returnedOnlyFromAuthor, 'return only events from author with pubkey ${this.author}');
  }
}

export default FilterAuthor;