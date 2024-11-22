import fetch from 'cross-fetch'
// import Ajv from 'ajv'

class InfoAdapterDefault {
  uses = ['AbortController']

  constructor(parent){
    this.$ = parent

    // this.ajv = new Ajv()
  }

  async check_info(){
    let result, data = {}
    const url = new URL(this.$.url),
          headers = {"Accept": "application/nostr+json"},
          method = 'GET'

    if( this.$.results.get('network') === 'tor' ) 
    {
      url.protocol = 'onion:';
    }
    else if(url.protocol === 'ws:') 
    {
      url.protocol = 'http:';
    }
    else if (url.protocol === 'wss:') 
    {
      url.protocol = 'https:';
    }

    try 
    {
      await fetch(url.toString(), { method, headers, signal: this.$.controller.signal })
        .then(async (response) => { 
          if(!response.ok) 
          {
            this.$.logger.debug(`check_info(): fetch error: ${e.message}`)
            result = { status: "error", message: e.message, data }
          }
          else {
            this.$.logger.debug(`check_info(): response status: ${response}`)
            data = await response.json()
          }
          return response
        })
        .catch((e) => {
          this.$.logger.debug(`check_info(): fetch error: ${e.message}`)
          result = { status: "error", message: e.message, data }
        })
    }

    catch(e) 
    { 
      result = { status: "error", message: e.message, data }
    }
    
    if(!result) 
    {
      result = { status: "success", data }
    }
      
    // else {
    //   // const validate = this.ajv.compile(data)
    //   // const valid = validate(data)
    //   // result = { status: "error", message: this.ajv.errorsText(validate.errors), data }
    // } 

    this.$.finish('info', result)
  }
}

export default InfoAdapterDefault