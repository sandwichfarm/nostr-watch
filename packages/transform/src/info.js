import { RelayCheck } from './headers.js'

export class RelayCheckInfo extends RelayCheck {
  /**
   * @type {object} The data structure specific to RelayCheckInfo
   */
  data = {
    description: null,
    name: null,
    pubkey: null,
    software: null,
    supported_nips: null,
    retention: null,
    language_tags: null,
    tags: null,
    posting_policy: null,
    relay_countries: null,
    version: null,
    limitation: {
      max_message_length: null,
      max_subscriptions: null,
      max_filters: null,
      max_limit: null, 
      max_subid_length: null,
      min_prefix: null,
      max_content_length: null,
      max_event_tags: null,
      min_pow_difficulty: null,
      auth_required: null,
      payment_required: null
    },
    payments_url: "",
    fees: {
      subscription: []
    }
  };

  constructor(data, format=`rdb`) {
    super(data);
    if (!data?.data) {
      this.data = {}
    }
  }

  toNocap() {
    const nocapResult = this.setHeadersToNocap({});
    nocapResult.info.data = this.data;

    return nocapResult;
  }

  fromNocap(nocapResult) {
    this.setHeadersFromNocap(nocapResult);

    this.detectDroppedFields(nocapResult, Object.keys(this.data));

    if (nocapResult?.info?.data) {
      this.data = { ...this.data, ...nocapResult.info.data };
    }

    // Detect and record dropped fields
    

    this.hashData()
    return this.toJson()
  }
}