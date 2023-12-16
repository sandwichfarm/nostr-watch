import { RelayCheck } from './headers.js'

export class RelayCheckSsl extends RelayCheck {
  /**
   * @type {object} The data structure specific to RelayCheckResultSsl
   */
  data = {
    days_remaining: 57,
    valid: true,
    subject: { CN: '' },
    issuer: {
      C: '',
      O: '',
      CN: ''
    },
    subjectaltname: '',
    infoAccess: {
      ' ': ['']
    },
    ca: false,
    modulus: '',
    bits: 2048,
    exponent: '',
    pubkey: {},
    valid_from: '',
    valid_to: '',
    fingerprint: '',
    fingerprint256: '',
    fingerprint512: '',
    ext_key_usage: [''],
    serialNumber: '',
    raw: Buffer.alloc(0),  // assuming Node.js Buffer
    pemEncoded: ''
  };

  constructor(headers, result) {
    super(headers, result);
   
  }

  toNocap() {
    const nocapResult = this.setHeadersToNocap();
    nocapResult.data = this.data;
    return nocapResult;
  }

  fromNocap(headers, result) {
    console.log('WTF!', !result || !result?.data || Object.keys(result.data).length === 0)
    console.log('HEADER KEYS!', Object.keys(headers))
    console.log('RESULT KEYS!', Object.keys(result), Object.keys(result.data))
    this.setHeadersFromNocap(headers);
    if (!result || !result?.data || Object.keys(result.data).length === 0)
      this.data = {}
    else 
      this.data = { ...this.data, ...result.data }
    this.hashData()
    return this.toJSON()
  }
}