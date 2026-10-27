import { describe, expect, it } from 'vitest';

import { SchemaValidator } from '#base/SchemaValidator.js';

describe('SchemaValidator', () => {
  it('compiles schemas with duplicate nested $id', () => {
    const schema = {
      type: 'object',
      properties: {
        first: { $id: 'repeated', type: 'string' },
        second: { $id: 'repeated', type: 'number' },
      },
      required: ['first', 'second'],
    };
    const validator = new SchemaValidator(schema);
    expect(validator.validate({ first: 'value', second: 1 })).toBe(true);
    expect(validator.validate({ first: 'value', second: 'invalid' })).toBe(false);
    expect(schema.properties.first.$id).toBe('repeated');
  });
});

