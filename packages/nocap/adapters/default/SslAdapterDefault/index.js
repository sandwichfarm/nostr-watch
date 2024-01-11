import sslValidator from 'ssl-validator'
import sslChecker from "ssl-checker";
import sslCertificate from 'get-ssl-cert'

class SslAdapterDefault {
  constructor(parent){
    this.$ = parent
  }

  async check_ssl(){
    let result, data = {}
    const url = new URL(this.$.url)
    const hostname = url.hostname 
    const timeout = this.$.config?.timeout.ssl? this.$.config.timeout.ssl: 1000
    const sslCheckerResponse = await sslChecker(hostname, this.sslCheckerOptions(url.port)).catch( (e) => { result = { status: "error", status: "error", message: e.message, data } } )
    const sslCertificateResponse = await sslCertificate.get(hostname, timeout).catch( (e) => { result = { status: "error", message: e.message, data } } )
    data.days_remaining = sslCheckerResponse?.daysRemaining? sslCheckerResponse.daysRemaining: null
    data.valid = sslCheckerResponse?.valid? sslCheckerResponse.valid: null
    data = {...data, ...sslCertificateResponse }
    if(!result)
      result = { status: "success", data }
    this.$.finish('ssl', result)
  }
  
  sslCheckerOptions(port){
    return { method: "GET", port: port || 443 } 
  }
}

export default SslAdapterDefault