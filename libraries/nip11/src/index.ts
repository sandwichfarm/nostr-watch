import Nip11Schema from '@nostrwatch/nip11-schema'

import { Types as Nip11Type } from './types';
import * as Serialize from './serialize';

export { Nip11Type, Serialize };

import Ajv, { ValidateFunction } from 'ajv';

type Schema = object;

class Nip11 {
  private ajv: Ajv;
  private schema: Schema | null = Nip11Schema;
  private validator: ValidateFunction<any> | null | undefined;
  private nip11: Nip11Type | null = null;

  constructor(nip11?: Nip11Type) {
    this.ajv = new Ajv();
    if(nip11) this.nip11 = nip11
    if(!this.schema) return 
    this.validator = this.ajv.compile(this.schema);
  }

  /**
   * Validate a NIP-11 "Information Document" JSON. Will validate the NIP-11 schema provided during instantiation if it exists, otherwise, accepts JSON as a parameter 
   * 
   * @param data (optional) 
   * 
   * @returns 
   */
  async validate(json?: any): Promise<{ valid: boolean; errors: ValidateFunction<any>['errors'] }> {
    if(json === undefined) {
      if(!this?.nip11) {
        throw new Error('No NIP-11 JSON provided as argument and no NIP-11 schema was provided during instantiation. Cannot validate (either instantiate with NIP-11 json or call this method with NIP-11 json).')
      }
      json = this.nip11
    }
    if (!this.validator) {
      throw new Error('Validator not initialized. Ensure schema is loaded correctly.');
    }
    const valid = this.validator(json);
    return { valid, errors: this.validator.errors };
  }

  async deserialize(json: string): Promise<Nip11Type | null> {
    return Serialize.Convert.toSerialize(json);
  }

  async serialize(json: Nip11Type): Promise<string> {
    return Serialize.Convert.serializeToJson(json);
  }
  
}