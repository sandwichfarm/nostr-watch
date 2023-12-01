export class RelayCheckResultSsl extends RelayCheck {
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

  constructor(data) {
    super(data);
    if (data.data) {
      this.data = { ...this.data, ...data.data };
    }
  }

  out() {
    const nocapResult = this.setHeadersToNocap(nocapResult);
    nocapResult.data = this.data;

    return nocapResult;
  }

  fromNocap(nocapResult) {
    this.setHeadersFromNocap(nocapResult);

    if (nocapResult.data) {
      this.data = { ...this.data, ...nocapResult.data };
    }
    this.hashData()
  }
}

