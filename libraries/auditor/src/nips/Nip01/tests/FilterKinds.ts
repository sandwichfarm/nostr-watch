import { Sampler } from "#base/Sampler.js"; 

import { CompleteOnTypeArray, ISuiteTest, SuiteTest } from '#base/SuiteTest.js';
import { ISuite } from '#base/Suite.js';

import { Nip01ClientMessageGenerator } from '../index.js';
import { Nip01Filter, Note, RelayEventMessage } from '../interfaces/index.js';
import { KindIngestor } from "../ingestors/KindIngestor.js";

export class FilterKinds extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'FilterKinds';
  kindsReturned: number[] = [];
  maxEvents: number = 15;
  limit: number = 5

  filters: Nip01Filter[] = [{ kinds: this.ingestor.poop(), limit: this.limit }];

  constructor(suite: ISuite) {
    super(suite, new KindIngestor());
  }

  onMessageEvent(message: RelayEventMessage){
    const note = message[2];
    this.kindsReturned.push(note.kind);
  }

  test({behavior, conditions}){
    conditions.toBeOk(this.kindsReturned.length > 0, 'sample data size is sufficient for test');

    const returnedOnlyEventKinds = this.kindsReturned.every((item: number) => this.ingestor.poop().includes(item));
    behavior.toBeOk(this.kindsReturned.length > 0, 'returned at least one event');
    behavior.toEqual(this.kindsReturned.length, this.limit, `returned ${this.limit} events as requested`);
    behavior.toBeOk(returnedOnlyEventKinds, 'return only requested event kinds');
  }
}

export default FilterKinds;