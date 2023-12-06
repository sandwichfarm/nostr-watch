import { RelayCheck } from './headers.js'

export class RelayCheckDns extends RelayCheck {
  /**
   * @type {object} The data structure specific to RelayCheckResultDns
   */
  data = {
    status: '',
    TC: false,
    RD: true,
    RA: true,
    AD: false,
    CD: false,
    Question: [{ name: '', type: -1 }],
    Answer: [{}]
  };

  constructor(data) {
    super(data);
    if (data.data) {
      this.data = { ...this.data, ...data.data };
    }
  }

  toNocap() {
    const nocapResult = this.setHeadersToNocap({});
    nocapResult.data = this.data;

    return nocapResult;
  }

  fromNocap(nocapResult) {
    this.setHeadersFromNocap(nocapResult);
    if (nocapResult.data) {
      this.data = { ...this.data, ...nocapResult.data };
    }
    this.hashData()
    return this.toJSON()
  }
}