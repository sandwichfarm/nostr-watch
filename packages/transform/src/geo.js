import { RelayCheck } from './headers.js'

export class RelayCheckGeo extends RelayCheck {
  /**
   * @type {object} The data structure specific to RelayCheckResultGeo
   */
  data = {
    country: '',
    countryCode: '',
    region: '',
    regionName: '',
    city: '',
    zip: '',
    lat: -1.1,
    lon: -1.1,
    timezone: '',
    isp: '',
    org: '',
    as: ''
  };

  constructor(data) {
    super(data);
    if (data.data) {
      // Only copy relevant fields, excluding 'status' and 'query'
      for (const key of Object.keys(this.data)) {
        if (data.data[key] !== undefined) {
          this.data[key] = data.data[key];
        }
      }
    }
  }

  toNocap() {
    const nocapResult = this.setHeadersToNocap({});

    // Include the relevant fields only, excluding 'status' and 'query'
    nocapResult.data = { ...this.data };

    return nocapResult;
  }

  fromNocap(nocapResult) {
    this.setHeadersFromNocap(nocapResult);

    if (nocapResult.data) {
      // Update the class data, excluding 'status' and 'query'
      for (const key of Object.keys(this.data)) {
        if (nocapResult.data[key] !== undefined) {
          this.data[key] = nocapResult.data[key];
        }
      }
    }
    this.hashData()
    return this.toJSON()
  }
}