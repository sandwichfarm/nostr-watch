import { Sampler } from "#base/Sampler.js"; 

import { CompleteOnTypeArray, ISuiteTest, SuiteTest } from '#base/SuiteTest.js';
import { ISuite } from '#base/Suite.js';

import { Nip01ClientMessageGenerator } from '../index.js';
import { Nip01Filter, Note, RelayEventMessage } from '../interfaces/index.js';
import { KindIngestor } from "../ingestors/KindIngestor.js";
import { SingleTagIngestor } from "../ingestors/SingleTagIngestor.js";

export class FilterTags extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'FilterTags';

  protected timeoutMs: number = 15000;
  singleLetterTagsReturned: string[][] = [];
  maxEvents: number = 5;
  limit: number = 1;

  constructor(suite: ISuite) {
    super(suite, new SingleTagIngestor());
  }

  async prepare() {
    const tag: string[] = this.ingestor.poop() as string[];
    const filter = { [`#${tag[0]}`]: [tag[1]]  } as Partial<Nip01Filter>
    // console.log('filter', filter)
    const filters: Nip01Filter[] = [{ ...filter, limit: this.limit }];
    const message = Nip01ClientMessageGenerator.REQ(this.subId, filters);
    this.socket.send(message);
    while(this.socket.CONNECTED){
      await new Promise(resolve => setTimeout(resolve, 500));
    };
  }

  onMessageOk(){
    // this.suite.logCode('behavior', 'should not return ok', false);
  }

  onMessageEvent(message: RelayEventMessage){
    const note = message[2];
    const tags = note.tags
    tags.filter(tag => tag[0].length === 1).forEach(tag => this.singleLetterTagsReturned.push(tag))
  }

  test({behavior, conditions}){
    conditions.toBeOk(this.singleLetterTagsReturned.length > 0, 'sample data size is sufficient for test');

    const returnedOnlyTagsRequested = this.singleLetterTagsReturned.some((item: string[]) => {
      const key = this.ingestor.poop()[0] 
      const value = this.ingestor.poop()[1]
      return item[0] === key && item[1] === value
    });
    behavior.toBeOk(returnedOnlyTagsRequested, `returned only requested tags: ${this.singleLetterTagsReturned}`); 
    behavior.toEqual(this.singleLetterTagsReturned.length, 1, 'returned only one event');
  }
}

export default FilterTags;