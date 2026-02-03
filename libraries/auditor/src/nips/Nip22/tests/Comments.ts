import type { ISuite } from '#base/Suite.js';
import { SuiteTest, type ISuiteTest } from '#base/SuiteTest.js';

import type { INip01Filter, Note } from '#src/nips/Nip01/interfaces/index.js';

export class Comments extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'Comments';

  constructor(suite: ISuite) {
    super(suite);
  }

  get filters(): INip01Filter[] {
    return [
      {
        kinds: [1111],
        limit: 1,
      },
    ];
  }

  test({ behavior }) {
    const events = this.events as Note[];
    if (events.length === 0) {
      behavior.skip = true;
      behavior.toBeOk(true, 'Skipped: no kind 1111 (NIP-22 comments) events found');
      return;
    }

    const event = events[0];
    behavior.toBe(event.kind, 1111, 'returned event kind is 1111');
    behavior.toBeOk(Array.isArray(event.tags), 'comments tags is an array');
  }
}

export default Comments;

