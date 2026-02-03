import type { ISuite } from '#base/Suite.js';
import { SuiteTest, type ISuiteTest } from '#base/SuiteTest.js';

import type { INip01Filter, Note } from '#src/nips/Nip01/interfaces/index.js';

export class RelayListMetadata extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'RelayListMetadata';

  constructor(suite: ISuite) {
    super(suite);
  }

  get filters(): INip01Filter[] {
    return [
      {
        kinds: [10002],
        limit: 1,
      },
    ];
  }

  test({ behavior }) {
    const events = this.events as Note[];
    if (events.length === 0) {
      behavior.skip = true;
      behavior.toBeOk(true, 'Skipped: no kind 10002 (relay list metadata) events found');
      return;
    }

    const event = events[0];
    behavior.toBe(event.kind, 10002, 'returned event kind is 10002');
    behavior.toBeOk(
      Array.isArray(event.tags) && event.tags.some((tag) => Array.isArray(tag) && tag[0] === 'r'),
      'relay list metadata contains at least one r tag'
    );
  }
}

export default RelayListMetadata;

