import { ISuiteTest, SuiteTest } from '#base/SuiteTest.js';
import { ISuite } from '#base/Suite.js';

import { INip01Filter, Note, RelayEventMessage } from '../interfaces/index.js';
import { SingleTagIngestor } from "../ingestors/SingleTagIngestor.js";
import { truncate } from "#src/utils/string.js";
import { AssertWrap } from '#src/base/Expect.js';

export class FilterTags extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'FilterTags';

  protected timeoutMs: number = 15000;
  tagsSampled: string[] = [];
  singleLetterTagsReturned: string[][] = [];
  maxEvents: number = 5;
  limit: number = 1;

  constructor(suite: ISuite) {
    super(suite);
    this.suiteIngest(new SingleTagIngestor(1));
  }

  digest(){
    this.tagsSampled = this.getSamples<string[]>();
  }

  precheck(conditions: AssertWrap): void {
    conditions.toBeOk(this.tagsSampled.length > 0, 'sample data size is sufficient for test');
  }

  get filters(): INip01Filter[] {
    const tag = this.tagsSampled
    const filter = { [`#${tag[0]}`]: [tag[1]] } as Partial<INip01Filter>
    return [{ ...filter, limit: this.limit }];
  }

  onMessageEvent(message: RelayEventMessage){
    const note = message[2];
    const tags = note.tags
    tags.filter(tag => tag[0].length === 1).forEach(tag => this.singleLetterTagsReturned.push(tag))
  }

  test({behavior}){
    const returnedOnlyTagsRequested = this.singleLetterTagsReturned.some((item: string[]) => {
      const key = this.tagsSampled[0] 
      const value = this.tagsSampled[1]
      return item[0] === key && item[1] === value
    });
    behavior.toBeOk(returnedOnlyTagsRequested, `returned only requested tags: ${truncate(JSON.stringify(this.singleLetterTagsReturned))}`); 
    behavior.toEqual(this.totalEvents, this.limit, 'returned only requested number of events');
  }
}

export default FilterTags;