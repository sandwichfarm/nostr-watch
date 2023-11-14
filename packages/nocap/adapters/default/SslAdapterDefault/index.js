import sslValidator from 'ssl-validator'
import sslChecker from "ssl-checker";
import sslCertificate from 'get-ssl-cert'

class SslAdapterDefault {
  constructor(parent){
    this.$ = parent
  }

  async check_ssl(resolve){
    const url = new URL(this.$.url)
    console.log(typeof url.hostname)
    console.log(typeof url.port)
    const response = await sslChecker(this.sslCheckerOptions(url.hostname, url.port))
    response.adapter = 'DefaultSslAdapter'
    response.checked_at = new Date()
    response.cert = await sslCertificate.get(url.hostname, this.$.config?.ssl_timeout || 250, url.port || 443, 'https:') || {}
    response.cert.issuer = response?.cert?.issuer || {}
    response.validFor.push(await sslValidator.validateSSL(response.cert.pemEncoded, { domain: url.hostname }))
    response.validFor = [...new Set(response.validFor)].filter( domain => domain instanceof String && domain !== "" )
    const result = { ssl: response }
    resolve('ssl', result)
    
  }

  sslCheckerOptions(hostname, port){
    return { hostname, options: { method: "GET", port: port || 443 } }
  }

}

export default SslAdapterDefault