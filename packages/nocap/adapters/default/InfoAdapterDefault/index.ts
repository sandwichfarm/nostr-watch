import Nocap from "../../../src/classes/Base.ts";
import fetch from 'cross-fetch';

interface InfoResult {
  status: string;
  message?: string;
  data: any;
}

class InfoAdapterDefault {
  private $: Nocap;  // Assuming Nocap is the correct type for the parent

  constructor(parent: Nocap) {
    this.$ = parent;
  }

  async check_info(): Promise<void> {
    let result: InfoResult;
    const controller = new AbortController();
    const { signal } = controller;
    const url = new URL(this.$.url);
    url.protocol = 'https:';

    const headers = { "Accept": "application/nostr+json" },
          method = 'GET';

    // this.$.timeouts.create('info', this.$.config.timeout.info, () => controller.abort())
    try {
      const response = await fetch(url.toString(), { method, headers, signal });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      result = { status: "success", data };
    } catch (e) {
      result = { status: "error", message: e.message, data: {} };
    }

    this.$.finish('info', result);
  }
}

export default InfoAdapterDefault;
