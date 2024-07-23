import fetch from 'cross-fetch'
// import Ajv from 'ajv'

class InfoAdapterDefault {
  constructor(parent){
    this.$ = parent
    // this.ajv = new Ajv()
  }

  async check_info(){
    let result, data = {}
    const controller = new AbortController(),
          { signal } = controller,
          url = new URL(this.$.url),
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
      const response = await fetch(url.toString(), { method, headers, signal })
      data = await response.json()
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