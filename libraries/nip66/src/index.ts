import Nip11Schema from '@nostrwatch/nip11-schema'

import { Types as Nip11Type } from './types';
import * as Serialize from './serialize';

export { Nip11Type, Serialize };

import Ajv, { ValidateFunction } from 'ajv';

type Schema = object;

export class Nip11 {
  private ajv: Ajv;
  private schema: Schema | null = Nip11Schema;
  private validator: ValidateFunction<any> | null | undefined;
  private json: string | null = null;
  private serialized: Nip11Type | null = null

  constructor(nip11Json?: string) {
    this.ajv = new Ajv();
    if(nip11Json) this.json = nip11Json
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
      if(!this?.json) {
        throw new Error('No NIP-11 JSON provided as argument and no NIP-11 schema was provided during instantiation. Cannot validate (either instantiate with NIP-11 json or call this method with NIP-11 json).')
      }
      json = this.json
    }
    if (!this.validator) {
      throw new Error('Validator not initialized. Ensure schema is loaded correctly.');
    }
    const valid = this.validator(json);
    return { valid, errors: this.validator.errors };
  }

  async serialize(json?: string): Promise<Nip11Type | null> {
    if(json)
      this.json = json
    if(!this.json) return null
    this.serialized = await Nip11.fromJSON(this.json)
    return this.serialized
  }

  async deserialize(nip11?: Nip11Type): Promise<string | null> {
    if(nip11)
      this.serialized = nip11
    if(!this.serialized) 
      return null
    this.json = await Nip11.toJSON(this.serialized);
    return this.json
  }

  static async toJSON(nip11?: Nip11Type): Promise<string | null> {
    if(!nip11) return null
    return Serialize.Convert.serializeToJson(nip11);
  }

  static async fromJSON(json?: string): Promise<Nip11Type | null> {
    if(!json) return null
    return Serialize.Convert.toSerialize(json);
  }
  
}