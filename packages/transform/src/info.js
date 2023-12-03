import { RelayCheck } from './headers.js'

export class RelayCheckInfo extends RelayCheck {
  /**
   * @type {object} The data structure specific to RelayCheckInfo
   */
  data = {
    description: "",
    name: "",
    pubkey: "",
    software: "",
    supported_nips: [],
    retention: [{ kinds: [-1, [-1]], time: -1 }],
    language_tags: [""],
    tags: [""],
    posting_policy: "",
    relay_countries: [""],
    version: "",
    limitation: {
      payment_required: true,
      max_message_length: -1,
      max_event_tags: -1,
      max_subscriptions: -1,
      auth_required: false
    },
    payments_url: "",
    fees: {
      subscription: [{ amount: -1, unit: "", period: -1 }]
    }
  };

  constructor(data, format=`rdb`) {
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

    // Detect and record dropped fields
    this.detectDroppedFields(nocapResult, ['data']);

    this.hashData()
  }
}