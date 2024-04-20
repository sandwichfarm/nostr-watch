import sslChecker from "ssl-checker";
import sslCertificate from 'get-ssl-cert';
import Nocap from "../../../src/classes/Base.ts";

interface SslCheckerResponse {
  daysRemaining?: number;
  valid?: boolean;
  [key: string]: any;
}

interface SslAdapterOptions {
  method: "GET";
  port: number;
}

class SslAdapterDefault {
  private $: Nocap;

  constructor(parent: Nocap) {
    this.$ = parent;
  }

  async check_ssl(): Promise<void> {
    let result: { status: string; message?: string; data?: any };
    const url = new URL(this.$.url);
    const hostname = url.hostname;
    const timeout = this.$.config?.timeout.ssl || 1000;
    
    let sslCheckerResponse: SslCheckerResponse | undefined;
    try {
      sslCheckerResponse = await sslChecker(hostname, this.sslCheckerOptions(url.port));
    } catch (e) {
      result = { status: "error", message: e.message, data: {} };
    }

    let sslCertificateResponse: any;
    try {
      sslCertificateResponse = await sslCertificate.get(hostname, timeout);
    } catch (e) {
      result = { status: "error", message: e.message, data: {} };
    }

    if (!result) {
      const data = {
        days_remaining: sslCheckerResponse?.daysRemaining,
        valid: sslCheckerResponse?.valid,
        ...sslCertificateResponse
      };
      result = { status: "success", data };
    }
    
    this.$.finish('ssl', result);
  }

  sslCheckerOptions(port: string | null): SslAdapterOptions {
    return { method: "GET", port: port ? parseInt(port) : 443 };
  }
}

export default SslAdapterDefault;
