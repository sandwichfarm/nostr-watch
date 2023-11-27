import sslValidator from 'ssl-validator'
import sslChecker from "ssl-checker";
import sslCertificate from 'get-ssl-cert'

class SslAdapterDefault {
  constructor(parent){
    this.$ = parent
  }

  async check_ssl(resolve){
    const url = new URL(this.$.url)
    const hostname = url.hostname 
    const timeout = this.$.config?.ssl_timeout? this.$.config.ssl_timeout: 1000
    console.log(this.sslCheckerOptions(hostname, url.port))
    const response = await sslChecker(hostname, this.sslCheckerOptions(url.port))
    response.adapter = 'DefaultSslAdapter'
    response.checked_at = new Date()
    response.cert = await sslCertificate.get(hostname, timeout)
    response.cert.issuer = response?.cert?.issuer || {}
    response.validFor.push(await sslValidator.validateSSL(response.cert.pemEncoded, { domain: url.hostname }))
    response.validFor = [...new Set(response.validFor)].filter( domain => domain instanceof String && domain !== "" )
    const result = { ssl: response }
    resolve('ssl', result)
    
  }

  sslCheckerOptions(port){
    return { method: "GET", port: port || 443 } 
  }

}

export default SslAdapterDefault