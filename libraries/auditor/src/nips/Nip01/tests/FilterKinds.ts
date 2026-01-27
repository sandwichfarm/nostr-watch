import { Sampler } from "#base/Sampler.js"; 

import { CompleteOnTypeArray, ISuiteTest, SuiteTest } from '#base/SuiteTest.js';
import { ISuite } from '#base/Suite.js';

import { INip01Filter, Note, RelayEventMessage } from '../interfaces/index.js';
import { KindIngestor } from "../ingestors/KindIngestor.js";
import { AssertWrap } from "#src/base/Expect.js";

export class FilterKinds extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'FilterKinds';
  kindsSampled: number[] = [];  
  kindsReturned: number[] = [];
  maxEvents: number = 15;
  limit: number = 5

  constructor(suite: ISuite) {
    super(suite);
    this.suiteIngest(new KindIngestor(1));
  }

  get filters(): INip01Filter[] {
    return [{ kinds: this.kindsSampled, limit: this.limit }];
  }

  digest(){
    this.kindsSampled = this.getSamples<number[]>()
  }

  precheck(conditions: AssertWrap){
    conditions.toBeOk(this.kindsSampled.length > 0, 'sample data size is sufficient for test');
  }

  onMessageEvent(message: RelayEventMessage){
    const note = message[2];
    this.kindsReturned.push(note.kind);
  }

  test({behavior}){
    const moreThanZero = this.kindsReturned.length > 0
    const returnedOnlyEventKinds = this.kindsReturned.every((item: number) => this.kindsSampled.includes(item));
    behavior.toBeOk(moreThanZero, 'returned at least one event');
    behavior.toBeOk(moreThanZero && returnedOnlyEventKinds, 'return only requested event kinds');
  }
}

export default FilterKinds;