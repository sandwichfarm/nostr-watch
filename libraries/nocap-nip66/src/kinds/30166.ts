// Kind30166.ts
import { Transform } from '../Transform';
import ngeotags from 'nostr-geotags';
import { CheckData } from '../Transform';
import { GeoData } from '../Transform';

export class Kind30166 extends Transform {
  constructor(pubkey: string) {
    super(30166, pubkey);
  }

  generateTags(check: CheckData): string[][] {
    let tags: string[][] = [];
    const { protocol } = new URL(check.url);

    this.addBasicTags(tags, check);
    this.addNetworkTags(tags, check);
    this.addInfoTags(tags, check.info?.data);
    this.addSslTags(tags, check.ssl?.data, protocol);
    this.addDnsTags(tags, check.dns?.data);
    this.addGeoTags(tags, check.geo?.data);

    tags.push(['l', 'draft7', 'nip66.draft']);

    return this.dedupLabels(tags);
  }

  private addBasicTags(tags: string[][], check: CheckData): void {
    tags.push(['d', check.url]);

    const durations: Array<'open' | 'read' | 'write'> = ['open', 'read', 'write'];
    durations.forEach((type) => {
      const duration = check[type]?.duration;
      if (duration && duration > 0) {
        tags.push([`rtt-${type}`, String(Math.round(duration))]);
      }
    });
  }

  private addNetworkTags(tags: string[][], check: CheckData): void {
    if (check.network) {
      tags.push(['n', check.network]);
    }
  }

  private addInfoTags(tags: string[][], info?: any): void {
    if (!info) return;

    this.addPubkeyTag(tags, info.pubkey);
    this.addSupportedNips(tags, info.supported_nips);
    this.addLanguageTags(tags, info.language_tags);
    this.addCustomTags(tags, info.tags);
    this.addLimitationTags(tags, info.limitation);
    this.addSoftwareTags(tags, info.software, info.version);
  }

  private addPubkeyTag(tags: string[][], pubkey?: string): void {
    if (pubkey && /^[0-9a-f]{64}$/.test(pubkey)) {
      tags.push(['p', pubkey]);
    }
  }

  private addSupportedNips(tags: string[][], nips?: number[]): void {
    if (nips) {
      nips.forEach((nip) => tags.push(['N', String(nip)]));
    }
  }

  private addLanguageTags(tags: string[][], languages?: string[]): void {
    if (languages) {
      tags.push(['L', 'ISO-639-1']);
      languages.forEach((lang) => tags.push(['l', lang, 'ISO-639-1']));
    }
  }

  private addCustomTags(tags: string[][], customTags?: string[]): void {
    if (customTags) {
      customTags.forEach((tag) => tags.push(['t', tag]));
    }
  }

  private addLimitationTags(
    tags: string[][],
    limitation?: { auth_required?: boolean; payment_required?: boolean }
  ): void {
    if (limitation) {
      tags.push(['R', limitation.auth_required ? 'auth' : '!auth']);
      tags.push(['R', limitation.payment_required ? 'payment' : '!payment']);
    }
  }

  private addSoftwareTags(
    tags: string[][],
    software?: string,
    version?: string
  ): void {
    if (software) {
      tags.push(['s', software]);
    }
    if (version) {
      tags.push(['L', 'nip11.version']);
      tags.push(['l', version, 'nip11.version']);
    }
  }

  private addSslTags(
    tags: string[][],
    sslData: any,
    protocol: string
  ): void {
    if (protocol === 'wss:' && sslData) {
      const validFrom = new Date(sslData.valid_from).getTime();
      const validTo = new Date(sslData.valid_to).getTime();
      const isValid = validFrom < Date.now() && validTo > Date.now();
      tags.push(['R', isValid ? 'ssl' : '!ssl']);
    } else {
      tags.push(['R', '!ssl']);
    }
  }

  private addDnsTags(tags: string[][], dnsData: any): void {
    if (!dnsData) return;

    ['ipv4', 'ipv6'].forEach((type) => {
      if (dnsData[type]?.length) {
        tags.push(['L', `dns.${type}`]);
        dnsData[type].forEach((ip: string) =>
          tags.push(['l', ip, `dns.${type}`])
        );
      }
    });
  }

  private addGeoTags(tags: string[][], geoData?: GeoData[]): void {
    if (!geoData || !Array.isArray(geoData)) return;

    let ispTags: string[][] = [];
    let geoTags: string[][] = [];

    geoData.forEach((geo) => {
      ispTags = this.addGeoIspTags(ispTags, geo);
      geoTags = this.addGeoLocationTags(geoTags, geo);
    });

    geoTags = [...this.removeLabels(geoTags), ...this.dedupLabels(geoTags)];
    ispTags = this.dedupLabels(ispTags);
    tags.push(...ispTags, ...geoTags);
  }

  private addGeoIspTags(tags: string[][], geo: GeoData): string[][] {
    const ispFields = [
      { key: 'isp', label: 'host.isp' },
      { key: 'as', label: 'host.as' },
      { key: 'asname', label: 'host.asn' },
    ];

    ispFields.forEach(({ key, label }) => {
      if (geo[key]) {
        tags.push(['L', label]);
        tags.push(['l', geo[key], label]);
      }
    });

    return tags;
  }

  private addGeoLocationTags(tags: string[][], geo: GeoData): string[][] {
    const gOpts = {
      isoAsNamespace: false,
      geohash: true,
      gps: false,
      countryCode: true,
      countryName: true,
      regionCode: true,
    };
    const geoTags = ngeotags(geo, gOpts) as string[][];
    return tags.concat(geoTags);
  }
}
