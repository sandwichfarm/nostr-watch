
import { ISuiteTest, SuiteTest } from '#base/SuiteTest.js';
import { ISuite } from '#base/Suite.js';
;
import { Nip01Filter, RelayEventMessage } from '../interfaces/index.js';
import { RangeIngestor } from "../ingestors/RangeIngestor.js";

export class FilterRange extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'FilterRange';

  maxEvents: number = 15;
  timestampsReturned: number[] = [];
  range: { since: number, until: number } | null = null;
  filters: Nip01Filter[] = [{ ...this.range, limit: 10 }];

  constructor(suite: ISuite) {
    super(suite, new RangeIngestor());
  }

  async prepare() {
    this.range = this.selectRangeFromSample(this.ingestor.poop());
    this.REQ(this.filters);
    await this.testable();
  }

  onMessageEvent(message: RelayEventMessage){
    const note = message[2];
    this.timestampsReturned.push(note.created_at);
  }

  test({behavior, conditions}){
    conditions.toBeOk(this?.range?.since && this?.range?.until && this.range.since != this.range.until, 'sample data to be sufficient')
    
    behavior.toEqual(this.timestampsReturned.length, 10, 'returned 10 events');
    behavior.toBeOk(this.timestampsReturned.length > 0, 'returned at least one event');
    behavior.toBeOk(this.withinRange(), 'return only events within range')
  }

  private withinRange(): boolean {
    return this.timestampsReturned
        .every(timestamp => {
            return timestamp >= this.range.since
                   && timestamp <= this.range.until;
        });
  }

  private selectRangeFromSample(timestamps: number[]): { since: number, until: number } | null {
    const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
    if (sortedTimestamps.length < 4) return null;
    //TODO: Determine how to handle ambiguity.
    const since = sortedTimestamps[1];
    const until = sortedTimestamps[sortedTimestamps.length - 2]; 
    return { since, until };
  }
}

export default FilterRange;