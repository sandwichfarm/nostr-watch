
import hash from 'object-hash'
import { relayId } from '@nostrwatch/utils'

export class RelayCheck {
  /**
   * @type {string} Unique identifier for the relay
   */
  relay_id = '';

  /**
   * @type {number} Timestamp when the check was performed
   */
  checked_at = -1;

  /**
   * @type {string} Identifier of the entity that performed the check
   */
  checked_by = '';

  /**
   * @type {Array<string>} List of adapters used
   */
  adapters = [];

  /**
   * @type {Array<string>} List of fields that were dropped in the response
   */
  dropped_fields = [];

  /**
   * @type {number} Total duration of the check
   */
  duration = -1;

  constructor() {}

  fromRdb(headers, result) {
    this.relay_id = headers?.relay_id? headers.relay_id: '';
    this.checked_at = headers?.checked_at? headers.checked_at: -1;
    this.checked_by = headers?.checked_by? headers.checked_by: '';
    this.adapters = headers?.adapters? headers.adapters: [];
    this.dropped_fields = headers?.dropped_fields? headers.dropped_fields: [];
    this.duration = headers?.duration? headers.duration: -1;
    this.data = result?.data? { ...this.data, ...result.data }: {};
  }

  // fromNocap(){
  //   console.warn(`fromNocap() not implemented in ${this.constructor.name} transformer`)
  // }

  // Method to set headers from NocapResult to the class
  setHeadersFromNocap(nocapResult) {
    this.relay_id = relayId(nocapResult.url);
    this.checked_at = nocapResult.checked_at;
    this.checked_by = nocapResult.checked_by;
    this.adapters = nocapResult.adapters;
    this.dropped_fields = nocapResult.dropped_fields;
    this.duration = nocapResult.duration;
  }

  // Method to set headers from the class to NocapResult
  setHeadersToNocap(nocapResult={}) {
    nocapResult.relay_id = this.relay_id;
    nocapResult.checked_at = this.checked_at;
    nocapResult.checked_by = this.checked_by;
    nocapResult.adapters = this.adapters;
    nocapResult.dropped_fields = this.dropped_fields;
    nocapResult.duration = this.duration;
    return nocapResult;
  }

  detectDroppedFields(nocapResult, definedFields) {
    const allFields = new Set(Object.keys(nocapResult));
    definedFields.forEach(field => allFields.delete(field));
    this.dropped_fields = [...allFields];
  }

  hashData() { 
    this.hash = hash(this.data)
  }

  toJson(){
    const result = {}
    Object.keys(this).forEach(key => {
      if(typeof this[key] !== 'function') 
        result[key] = this[key]
    })
    return result
  }
}