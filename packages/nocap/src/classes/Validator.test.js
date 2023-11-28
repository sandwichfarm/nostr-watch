import { describe, it, expect, beforeEach } from 'vitest'
import { Validator } from './Validator.js'

describe('Validator', () => {
  let validator;

  beforeEach(() => {
    validator = new Validator();
    validator.defaults = {
      name: 'defaultName',
      age: 30,
      isActive: false
    };
  });

  it('should set a value correctly', () => {
    validator.set('name', 'John');
    expect(validator.name).toBe('John');
  });

  it('should throw an error for setting value of wrong type', () => {
    expect(() => validator.set('age', '35')).toThrow();
  });

  it('should get a value correctly', () => {
    validator.name = 'Jane';
    expect(validator.get('name')).toBe('Jane');
  });

  it('should throw an error for getting an undefined property', () => {
    expect(() => validator.get('unknown')).toThrow();
  });

  it('should set multiple values correctly', () => {
    validator.setMany({ name: 'Alice', age: 28 });
    expect(validator.name).toBe('Alice');
    expect(validator.age).toBe(28);
  });

  it('should dump all properties except defaults', () => {
    validator.name = 'Bob';
    validator.age = 40;
    const dumped = validator.raw();

    expect(dumped).toEqual({ name: 'Bob', age: 40 });
    expect(dumped.defaults).toBeUndefined();
  });
});
