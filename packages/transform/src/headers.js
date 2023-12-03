
import hash from 'object-hash'

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

  constructor(data, format=`rdb`) {
    switch(format){
      case 'rdb':
        this.relay_id = data.relay_id || '';
        this.checked_at = data.checked_at || -1;
        this.checked_by = data.checked_by || '';
        this.adapters = data.adapters || [];
        this.dropped_fields = data.dropped_fields || [];
        this.duration = data.duration || -1;
        this.data = { ...this.data, ...data.data };
        break;
      case 'nocap':
        this.fromNocap(data)
        break;
    }
  }

  // Method to set headers from NocapResult to the class
  setHeadersFromNocap(nocapResult) {
    this.relay_id = nocapResult.relay_id;
    this.checked_at = nocapResult.checked_at;
    this.checked_by = nocapResult.checked_by;
    this.adapters = nocapResult.adapters;
    this.dropped_fields = nocapResult.dropped_fields;
    this.duration = nocapResult.duration;
  }

  // Method to set headers from the class to NocapResult
  setHeadersToNocap(nocapResult) {
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
    this.hash = hash(data)
  }
}