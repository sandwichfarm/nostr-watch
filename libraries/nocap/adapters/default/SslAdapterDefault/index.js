class SslAdapterDefault {
  constructor(parent){
    this.$ = parent;
  }

  async check_ssl(){
    if(typeof window !== 'undefined') {
      console.warn('Cannot check SSL from browser.');
      return;
    }
      
    let sslCertificate, sslChecker;
    try {
      // Import Node.js specific modules only in Node.js environment
      const sslCertificateImp = await import('get-ssl-cert');
      sslCertificate = sslCertificateImp.default || sslCertificateImp;

      const sslCheckerImp = await import('ssl-checker');
      sslChecker = sslCheckerImp.default || sslCheckerImp;
    } catch (error) {
      console.error('Failed to import SSL libraries:', error);
      return;
    }

    let result, data = {};
    const url = new URL(this.$.url);
    const hostname = url.hostname;
    const timeout = this.$.config?.timeout.ssl || 1000;

    let sslCheckerResponse, sslCertificateResponse;
    try {
      // Call Node.js specific functions only if available
      if (sslChecker) {
        sslCheckerResponse = await sslChecker(hostname, this.sslCheckerOptions(url.port));
        data.days_remaining = sslCheckerResponse?.daysRemaining || null;
        data.valid = sslCheckerResponse?.valid || null;
      }
    } catch (e) {
      result = { status: "error", message: e.message, data };
    }

    try {
      // Call Node.js specific functions only if available
      if (sslCertificate) {
        sslCertificateResponse = await sslCertificate.get(hostname, timeout);
        data = { ...data, ...sslCertificateResponse };
      }
    } catch (e) {
      result = { status: "error", message: e.message, data };
    }

    if (!result) {
      result = { status: "success", data };
    }

    this.$.finish('ssl', result);
  }
  
  sslCheckerOptions(port){
    return { method: "GET", port: port || 443 };
  }
}

export default SslAdapterDefault;