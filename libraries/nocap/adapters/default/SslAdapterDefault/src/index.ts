/// <reference path="./types/global.d.ts" />
import { AbstractAdapter, type IResultData, type IAdapter, type Nocap as Base, AdapterType } from '@nostrwatch/nocap';
import { isBrowser } from '@nostrwatch/utils';

const resultTpl: IResultData = { data: {}, duration: -1 };

export class SslAdapterDefault extends AbstractAdapter implements IAdapter {

  static type: AdapterType = 'ssl';
  readonly slug: string = 'SslAdapterDefault';

  constructor(parent: Base) {
    super(parent);
  }

  initialize(): void {}

  async check_ssl(): Promise<void> {

    if (isBrowser()) {
      const message = 'Cannot check SSL from browser.'
      console.warn('Cannot check SSL from browser.');
      this.base.finish('ssl', { ...resultTpl, status: "error", message });
      return
    }

    let result: IResultData | undefined;
    let data: Record<string, any> = {};
    const url = new URL(this.base.url);
    const hostname = url.hostname;
    const timeout = this.base.config?.timeout?.ssl || 1000;

    if (url.protocol === 'ws:') {
      const message = "Cannot check SSL for unsecured websocket."
      this.base.logger?.warn(message);
      this.base.finish('ssl', { 
        ...resultTpl,  
        status: "error", 
        message 
      });
      return 
    }

    let sslCertificate: any;
    let sslChecker: any;

    try {
      const sslCertificateImp = await import('get-ssl-cert');
      sslCertificate = sslCertificateImp.default || sslCertificateImp;

      const sslCheckerImp = await import('ssl-checker');
      sslChecker = sslCheckerImp.default || sslCheckerImp;
    } catch (error) {
      console.error('Failed to import SSL libraries:', error);
      return;
    }

    let sslCheckerResponse: any;
    let sslCertificateResponse: any;

    try {
      if (sslChecker) {
        sslCheckerResponse = await sslChecker(hostname, this.sslCheckerOptions(url.port));
        data.days_remaining = sslCheckerResponse?.daysRemaining || null;
        data.valid = sslCheckerResponse?.valid || null;
      }
    } catch (e: any) {
      result = { ...resultTpl, status: "error", message: e.message, data };
    }

    try {
      if (sslCertificate) {
        sslCertificateResponse = await sslCertificate.get(hostname, timeout);
        data = { ...resultTpl, ...data, ...sslCertificateResponse };
      }
    } catch (e: any) {
      result = { ...resultTpl, status: "error", message: e.message, data };
    }

    if (!result) {
      result = { ...resultTpl, status: "success", data };
    }

    this.base.finish('ssl', result);
  }

  sslCheckerOptions(port?: string | number): { method: string, port: string | number } {
    return { method: "GET", port: port || 443 };
  }
}

export default SslAdapterDefault;
