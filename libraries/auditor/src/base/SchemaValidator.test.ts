import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

import { SchemaValidator } from '#base/SchemaValidator.js';

describe('SchemaValidator', () => {
  it('compiles schemas with duplicate nested $id', () => {
    const schemaUrl = new URL(
      '../../../schemata/dist/nips/nip-02/kind-3/schema.json',
      import.meta.url
    );
    const schema = JSON.parse(fs.readFileSync(schemaUrl, 'utf8'));

    expect(() => new SchemaValidator(schema)).not.toThrow();
  });
});

