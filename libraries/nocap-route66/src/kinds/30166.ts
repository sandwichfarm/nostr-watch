  // Kind30166.ts
  import { type ITransform, Transform } from '../Transform.js';
  import ngeotags from 'nostr-geotags';

  import type { IResult, IResultDataData } from "@nostrwatch/nocap"

  export interface GeoData {
    isp?: string;
    as?: string;
    asname?: string;
    [key: string]: any;
  }

  export class Kind30166 extends Transform implements ITransform {
    private child: boolean = false;
    
    constructor(pubkey: string) {
      super(30166, pubkey);
    }

    generateTags(check: IResult): string[][] {
      this.child = check?.parent ? true : false;

      let tags: string[][] = [];
      const { protocol } = new URL(check.url);

      tags = this.addBasicTags(tags, check);
      tags = this.addNetworkTags(tags, check);
      tags = this.addInfoTags(tags, check.info?.data);
      tags = this.addGeoTags(tags, check.geo?.data);

      // if(!this.child)
      tags = this.addSslTags(tags, check.ssl?.data, protocol);
      tags = this.addDnsTags(tags, check.dns?.data);
      
      if(this.child)
        tags = this.addParentReferenceTags(tags, check);

      tags.push(['l', 'draft7', 'route66.draft']);

      return this.dedupLabels(tags);
    }

    private addParentReferenceTags(tags: string[][], check: IResult): string[][] {
      tags.push(['a', `30166:${this.pubkey}:${check.parent}`])
      return tags
    }

    private addBasicTags(tags: string[][], check: IResult): string[][] {
      tags.push(['d', check.url]);

      const durations: Array<'open' | 'read' | 'write'> = ['open', 'read', 'write'];
      durations.forEach((type) => {
        const duration = check[type]?.duration;
        if (duration && duration > 0) {
          tags.push([`rtt-${type}`, String(Math.round(duration))]);
        }
      });
      return tags
    }

    private addNetworkTags(tags: string[][], check: IResult): string[][] {
      if (check.network) {
        tags.push(['n', check.network]);
      }
      return tags
    }

    private addInfoTags(tags: string[][], info?: any): string[][] {
      if (!info) return tags;
      this.addPubkeyTag(tags, info.pubkey);
      this.addSupportedNips(tags, info.supported_nips);
      this.addLanguageTags(tags, info.language_tags);
      this.addCustomTags(tags, info.tags);
      this.addLimitationTags(tags, info.limitation);
      this.addSoftwareTags(tags, info.software, info.version);
      return tags
    }

    private addPubkeyTag(tags: string[][], pubkey?: string): string[][] {
      if (pubkey && /^[0-9a-f]{64}$/.test(pubkey)) {
        tags.push(['p', pubkey]);
      }
      return tags
    }

    private addSupportedNips(tags: string[][], nips?: number[]): string[][] {
      if (nips) {
        nips.forEach((nip) => tags.push(['N', String(nip)]));
      }
      return tags
    }

    private addLanguageTags(tags: string[][], languages?: string[]): string[][] {
      if (languages) {
        tags.push(['L', 'ISO-639-1']);
        languages.forEach((lang) => tags.push(['l', lang, 'ISO-639-1']));
      }

      return tags
    }

    private addCustomTags(tags: string[][], customTags?: string[]): string[][] {
      if (customTags) {
        customTags.forEach((tag) => tags.push(['t', tag]));
      }

      return tags
    }

    private addLimitationTags(
      tags: string[][],
      limitation?: { auth_required?: boolean; payment_required?: boolean }
    ): string[][] 
    {
      if (limitation) {
        tags.push(['R', limitation.auth_required ? 'auth' : '!auth']);
        tags.push(['R', limitation.payment_required ? 'payment' : '!payment']);
      }

      return tags
    }

    private addSoftwareTags(
      tags: string[][],
      software?: string,
      version?: string
    ): string[][] 
    {
      if (software) {
        tags.push(['s', software]);
      }
      if (version) {
        tags.push(['L', 'nip11.version']);
        tags.push(['l', version, 'nip11.version']);
      }

      return tags
    }

    private addSslTags(
      tags: string[][],
      sslData: any,
      protocol: string
    ): string[][] {
      if (protocol === 'wss:' && sslData) {
        const validFrom = new Date(sslData.valid_from).getTime();
        const validTo = new Date(sslData.valid_to).getTime();
        const isValid = validFrom < Date.now() && validTo > Date.now();
        tags.push(['R', isValid ? 'ssl' : '!ssl']);
      } else {
        tags.push(['R', '!ssl']);
      }

      return tags
    }

    private addDnsTags(tags: string[][], dnsData: any): string[][] {
      if (!dnsData) return tags;

      ['ipv4', 'ipv6'].forEach((type) => {
        if (dnsData[type]?.length) {
          tags.push(['L', `dns.${type}`]);
          dnsData[type].forEach((ip: string) =>
            tags.push(['l', ip, `dns.${type}`])
          );
        }
      });

      return tags
    }

    private addGeoTags(tags: string[][], geoData?: IResultDataData): string[][] {
      if (!geoData || !Array.isArray(geoData)) return tags;

      let ispTags: string[][] = [];
      let geoTags: string[][] = [];

      geoData.forEach((geo) => {
        ispTags = this.addGeoIspTags(ispTags, geo);
        geoTags = this.addGeoLocationTags(geoTags, geo);
      });

      geoTags = [...this.removeLabels(geoTags), ...this.dedupLabels(geoTags)];
      ispTags = this.dedupLabels(ispTags);
      tags.push(...ispTags, ...geoTags);
      return tags
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
      return [...tags, ...geoTags];
    }

    dedupLabels(tags: string[][]): string[][] {
      const dedupedTags: string[][] = [];
      const keys: Map<string, Set<string>> = new Map();
  
      tags.forEach((item) => {
        if (item[0] === 'L') {
          const key = item[1];
          if (!keys.has(key)) {
            keys.set(key, new Set());
            dedupedTags.push(item);
          }
        } else if (item[0] === 'l') {
          const key = item[2];
          const value = item[1];
          if (keys.has(key) && !keys.get(key)!.has(value)) {
            keys.get(key)!.add(value);
            dedupedTags.push(item);
          }
        } else {
          dedupedTags.push(item);
        }
      });
  
      return dedupedTags;
    }
  
    removeLabels(tags: string[][]): string[][] {
      return tags.filter((t) => t[0] !== 'l' && t[0] !== 'L');
    }
  }
