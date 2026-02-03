import type { ISuite } from '#base/Suite.js';
import { SuiteTest, type ISuiteTest } from '#base/SuiteTest.js';

import type { INip01Filter, Note } from '#src/nips/Nip01/interfaces/index.js';

export class ContactList extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'ContactList';

  constructor(suite: ISuite) {
    super(suite);
  }

  get filters(): INip01Filter[] {
    return [
      {
        kinds: [3],
        limit: 1,
      },
    ];
  }

  test({ behavior }) {
    const events = this.events as Note[];
    if (events.length === 0) {
      behavior.skip = true;
      behavior.toBeOk(true, 'Skipped: no kind 3 (contact list) events found');
      return;
    }

    const event = events[0];
    behavior.toBe(event.kind, 3, 'returned event kind is 3');
    behavior.toBeOk(Array.isArray(event.tags), 'contact list tags is an array');
  }
}

export default ContactList;

