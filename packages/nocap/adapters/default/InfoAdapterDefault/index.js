import fetch from 'cross-fetch'

class InfoAdapterDefault {
  constructor(parent){
    this.$ = parent
  }

  async check_info(){
    let result, data = {}
    const controller = new AbortController();
    const { signal } = controller;
    const url = new URL(this.$.url),
          headers = {"Accept": "application/nostr+json"},
          method = 'GET'
    
    url.protocol = 'https:'

    // this.$.timeouts.create('info', this.$.config.timeout.info, () => controller.abort())
    try {
      const response = await fetch(url.toString(), { method, headers, signal })
      data = await response.json()
    }
    catch(e) { 
      result = { status: "error", message: e.message, data }
    }
    if(!result)
      result = { status: "success", data }
    this.$.finish('info', result)
  }
}

export default InfoAdapterDefault