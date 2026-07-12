import fetch from 'cross-fetch'
// import Ajv from 'ajv'

const NIP11_MAX_BODY_BYTES = 128 * 1024

const isJsonContentType = (contentType) => {
  const mime = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? ''
  return mime === 'application/json' || mime === 'text/json' || mime.endsWith('+json')
}

const readBodyWithLimit = async (response) => {
  const contentLength = response.headers.get('content-length')
  if(contentLength && Number(contentLength) > NIP11_MAX_BODY_BYTES) {
    throw new Error(`NIP-11 response exceeds ${NIP11_MAX_BODY_BYTES} bytes.`)
  }

  const body = await response.text()
  if(new TextEncoder().encode(body).byteLength > NIP11_MAX_BODY_BYTES) {
    throw new Error(`NIP-11 response exceeds ${NIP11_MAX_BODY_BYTES} bytes.`)
  }
  return body
}

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
          method = 'GET',
          requestInit = {
            method,
            headers,
            signal: this.$.controller.signal,
            redirect: 'error',
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            cache: 'no-store'
          }

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
      await fetch(url.toString(), requestInit)
        .then(async (response) => { 
          const contentType = response.headers.get('content-type')?.trim() ?? ''
          if(!response.ok || response.redirected)
          {
            const message = `NIP-11 request failed with HTTP ${response.status}.`
            this.$.logger.debug(`check_info(): fetch error: ${message}`)
            result = { status: "error", message, data }
          }
          else if(contentType && !isJsonContentType(contentType))
          {
            const message = `Unsupported NIP-11 content-type: ${contentType}`
            this.$.logger.debug(`check_info(): fetch error: ${message}`)
            result = { status: "error", message, data }
          }
          else {
            this.$.logger.debug(`check_info(): response status: ${response}`)
            const body = await readBodyWithLimit(response)
            const parsed = JSON.parse(body)
            if(!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
              result = { status: "error", message: 'NIP-11 response must be a JSON object.', data }
            }
            else {
              data = parsed
            }
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
