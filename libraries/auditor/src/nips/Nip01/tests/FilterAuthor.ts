import { ISuiteTest, SuiteTest } from '#base/SuiteTest.js';
import { ISuite } from '#base/Suite.js';

import { INip01Filter, Note, RelayEventMessage } from '../interfaces/index.js';
import { is64CharHex } from '#src/utils/nostr.js';
import { AuthorIngestor } from '../ingestors/AuthorIngestor.js';
import { AssertWrap } from '#src/base/Expect.js';

export class FilterAuthor extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'FilterAuthor';

  maxEvents: number = 3;
  authorsReturned: string[] = [];
  author?: string;
  limit: number = 1;

  constructor(suite: ISuite) {
    super(suite);
    this.suiteIngest(new AuthorIngestor(10));
  }

  get filters(): INip01Filter[] {
    return [{ authors: [ this.author ], limit: this.limit }];
  }

  digest(){
    const samples = this.getSamples<string[]>()
    this.author = samples[0];
  }

  precheck(conditions: AssertWrap){
    conditions.toBeOk(typeof this.author === 'string', 'sampled data is sufficient for test');
    conditions.toBeOk(is64CharHex(this.author), 'author hex pubkey looks valid');
  }

  onMessageEvent(message: RelayEventMessage){
    const note = message?.[2]; 
    if(!note) return;
    this.authorsReturned.push(note.pubkey);
  }

  test({behavior}){
    const returnedNum = this.authorsReturned.length
    const returnedAtLeastOne = returnedNum > 0;
    const returnedOnlyFromAuthor = this.authorsReturned.every(author => author === this.author);
    behavior.toBeOk(returnedAtLeastOne, `returned at least one event from author`);
    behavior.toBeOk(returnedAtLeastOne && returnedOnlyFromAuthor, `return only events from author`);
  }
}

export default FilterAuthor;