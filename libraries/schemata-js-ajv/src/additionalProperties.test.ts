import { describe, it, expect } from 'vitest';
import { validate } from './index.js';

// Make validate function accessible for testing
export { validate };

describe('additional property warnings', () => {
  it('should warn but not error when schema allows additional props', () => {
    const data = { name: 'relay', extra: 1 };
    const schema = { 
      type: 'object', 
      properties: { 
        name: { type: 'string' } 
      } 
    }; // no additionalProperties:false
    
    const r = validate(schema, data);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
    expect(r.warnings).toContainEqual(expect.objectContaining({
      keyword: 'additionalProperties',
      params: { additionalProperty: 'extra' }
    }));
  });

  it('should not produce warnings for additional properties when additionalProperties is false', () => {
    const data = { name: 'relay', extra: 1 };
    const schema = { 
      type: 'object', 
      properties: { 
        name: { type: 'string' } 
      },
      additionalProperties: false
    };
    
    const r = validate(schema, data);
    expect(r.valid).toBe(false);
    expect(r.errors).toContainEqual(expect.objectContaining({
      keyword: 'additionalProperties',
      params: { additionalProperty: 'extra' }
    }));
    expect(r.warnings).toHaveLength(0);
  });

  it('should find nested additional properties', () => {
    const data = { 
      name: 'relay', 
      config: { 
        port: 8080, 
        extraConfig: true 
      } 
    };
    const schema = { 
      type: 'object', 
      properties: { 
        name: { type: 'string' },
        config: {
          type: 'object',
          properties: {
            port: { type: 'number' }
          }
        }
      }
    };
    
    const r = validate(schema, data);
    expect(r.valid).toBe(true);
    expect(r.warnings).toContainEqual(expect.objectContaining({
      keyword: 'additionalProperties',
      params: { additionalProperty: 'extraConfig' }
    }));
  });
}); 