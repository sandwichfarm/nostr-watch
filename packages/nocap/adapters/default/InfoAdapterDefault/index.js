import fetch from 'cross-fetch'

class InfoAdapterDefault {
  constructor(parent){
    this.$ = parent
  }

  async check_info(){
    const controller = new AbortController();
    const { signal } = controller;
    const url = new URL(this.$.url),
          headers = {"Accept": "application/nostr+json"},
          method = 'GET'
    
    url.protocol = 'https:'

    this.$.timeouts.create('info', this.$.config.info_timeout, () => controller.abort())

    try {
      const response = await fetch(url.toString(), { method, headers, signal })
      const json = await response.json()
      const result = { info: json }
      this.$.finish('info', result)
    }
    catch(e) { return this.$.throw(e) }
  }
}

export default InfoAdapterDefault